const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const {
  getFirestore,
  FieldValue,
  Timestamp,
} = require("firebase-admin/firestore");
const { randomBytes, createHash } = require("node:crypto");
initializeApp();
const db = getFirestore();
const now = () => FieldValue.serverTimestamp();
const fail = (code, message) => {
  throw new HttpsError(code, message);
};
const key = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const digest = (value) => createHash("sha256").update(value).digest("hex");
exports.workspace = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) fail("unauthenticated", "Sign in again.");
  const token = request.rawRequest.headers.authorization?.split(" ")[1];
  await getAuth().verifyIdToken(token, true);
  const {
    action,
    kind = "projects",
    id,
    name,
    role,
    code,
    target,
  } = request.data || {};
  if (action === "deleteAccount") {
    if (Date.now() / 1000 - request.auth.token.auth_time > 300)
      fail(
        "failed-precondition",
        "Sign in again before deleting your account.",
      );
    const profile = db.doc("users/" + uid);
    await db.runTransaction(async (tx) => {
      const [projects, teams] = await Promise.all(
        ["projects", "teams"].map((k) =>
          tx.get(profile.collection(k).limit(1)),
        ),
      );
      if (!projects.empty || !teams.empty)
        fail(
          "failed-precondition",
          "Transfer ownership or delete owned workspaces, then leave all remaining workspaces.",
        );
      tx.set(db.doc("accountClosures/" + uid), { createdAt: now() });
    });
    await db.doc("githubConnections/"+uid).delete();await db.recursiveDelete(profile);
    await getAuth().revokeRefreshTokens(uid);
    await getAuth().deleteUser(uid);
    return {};
  }
  if (!["projects", "teams"].includes(kind))
    fail("invalid-argument", "Invalid workspace.");
  const label = typeof name === "string" ? name.trim() : "";
  if (["create", "rename"].includes(action) && (!label || label.length > 80))
    fail("invalid-argument", "Use a name of 1–80 characters.");
  if (
    action === "join" &&
    (typeof code !== "string" || !/^[a-f0-9]{64}$/.test(code))
  )
    fail("invalid-argument", "Invalid invitation.");
  const invites = db.collection("invitations");
  return db.runTransaction(async (tx) => {
    if ((await tx.get(db.doc("accountClosures/" + uid))).exists)
      fail("permission-denied", "Account closure in progress.");
    let ref, invite;
    if (action === "join") {
      invite = await tx.get(invites.doc(digest(code)));
      if (!invite.exists || invite.get("expiresAt").toMillis() <= Date.now())
        fail("not-found", "Invitation expired or revoked.");
      ref = db.doc(invite.get("path"));
    } else if (action === "create") ref = db.collection(kind).doc();
    else {
      if (!key(id)) fail("invalid-argument", "Invalid identifier.");
      ref = db.collection(kind).doc(id);
    }
    const member = (user) => ref.collection("members").doc(user);
    const index = (user) =>
      db.doc("users/" + user + "/" + ref.parent.id + "/" + ref.id);
    const linked =
      ref.parent.id === "teams"
        ? (await tx.get(ref.collection("projects").limit(21))).docs.map(
            (link) => db.collection("projects").doc(link.id),
          )
        : [];
    function mirror(user, value) {
      for (const project of linked) {
        const membership = project.collection("members").doc(user),
          entry = db.doc("users/" + user + "/projects/" + project.id);
        if (value) {
          tx.set(membership, { uid: user, role: value });
          tx.set(entry, { id: project.id, role: value });
          if (value === "owner") tx.update(project, { owner: user });
        } else {
          tx.delete(membership);
          tx.delete(entry);
        }
      }
    }
    const grant = (user, value) => {
      mirror(user, value);
      tx.set(member(user), { uid: user, role: value });
      tx.set(index(user), { id: ref.id, role: value });
    };
    const log = () =>
      tx.create(ref.collection("activity").doc(), {
        action,
        uid,
        createdAt: now(),
      });
    if (action === "create") {
      tx.create(ref, {
        name: label,
        owner: uid,
        archived: false,
        createdAt: now(),
        updatedAt: now(),
      });
      grant(uid, "owner");
      log();
      return { id: ref.id, kind: ref.parent.id };
    }
    const [resource, membership] = await Promise.all([
      tx.get(ref),
      tx.get(member(uid)),
    ]);
    if (!resource.exists || resource.get("deleted") === true)
      fail("not-found", "Workspace unavailable.");
    if (action === "join") {
      if (!membership.exists) grant(uid, invite.get("role"));
      tx.delete(invite.ref);
      log();
      return { id: ref.id, kind: ref.parent.id };
    }
    if (
      resource.get("teamId") &&
      ["role", "transfer", "invite", "remove", "leave"].includes(action)
    )
      fail("failed-precondition", "Manage membership in the parent team.");
    const authority = membership.get("role");
    if (action === "createTeamProject") {
      if (ref.parent.id !== "teams" || !["owner", "admin"].includes(authority))
        fail("permission-denied", "Team administrator required.");
      if (!label || label.length > 80 || linked.length >= 20)
        fail(
          "invalid-argument",
          "Use a valid name and up to 20 projects per team.",
        );
      const roster = await tx.get(ref.collection("members").limit(201));
      if (roster.size > 200)
        fail("resource-exhausted", "Team size exceeds the project limit.");
      const project = db.collection("projects").doc();
      tx.create(project, {
        name: label,
        owner: resource.get("owner"),
        teamId: ref.id,
        archived: false,
        createdAt: now(),
        updatedAt: now(),
      });
      tx.create(ref.collection("projects").doc(project.id), { id: project.id });
      for (const m of roster.docs) {
        tx.create(project.collection("members").doc(m.id), m.data());
        tx.create(db.doc("users/" + m.id + "/projects/" + project.id), {
          id: project.id,
          role: m.get("role"),
        });
      }
      log();
      return { id: project.id };
    }
    if (!authority) fail("permission-denied", "Membership required.");
    if (
      kind === "projects" &&
      ["snapshot", "restoreVersion", "duplicate"].includes(action)
    ) {
      const result = await require("./versions").versionAction({
        action,
        tx,
        project: ref,
        uid,
        role: authority,
        target,
      });
      log();
      return result;
    }
    if (
      kind === "projects" &&
      ["createFolder", "renameFolder", "deleteFolder"].includes(action)
    ) {
      if (
        !["owner", "admin", "editor"].includes(authority) ||
        resource.get("archived")
      )
        fail("permission-denied", "Editing access required.");
      if (target && !key(target)) fail("invalid-argument", "Invalid folder.");
      if (
        action !== "deleteFolder" &&
        (!label || label.length > 100 || label.includes("/"))
      )
        fail(
          "invalid-argument",
          "Enter a folder name of up to 100 characters.",
        );
      const folders = ref.collection("folders"),
        folder = target ? folders.doc(target) : null;
      if (folder && !(await tx.get(folder)).exists)
        fail("not-found", "Folder unavailable.");
      if (action === "createFolder") {
        const child = folders.doc();
        tx.create(child, {
          parent: target || "",
          name: label,
          createdAt: now(),
        });
        log();
        return { id: child.id };
      }
      if (!folder) fail("invalid-argument", "Select a folder.");
      if (action === "renameFolder") tx.update(folder, { name: label });
      else {
        const children = await Promise.all(
          [folders, ref.collection("files")].map((rows) =>
            tx.get(rows.where("parent", "==", target).limit(1)),
          ),
        );
        if (children.some((s) => !s.empty))
          fail("failed-precondition", "Empty the folder first.");
        tx.delete(folder);
      }
      log();
      return {};
    }
    if (action === "deleteFile" && kind === "projects") {
      if (
        !["editor", "admin", "owner"].includes(authority) ||
        resource.get("archived") ||
        !key(target)
      )
        fail("permission-denied", "Editing access required.");
      const file = ref.collection("files").doc(target);
      if (!(await tx.get(file)).exists) fail("not-found", "File unavailable.");
      tx.create(ref.collection("deletedFiles").doc(target), {
        uid,
        createdAt: now(),
      });
      tx.delete(file);
      log();
      return {};
    }
    if (action === "leave" && authority !== "owner") {
      mirror(uid, null);
      tx.delete(member(uid));
      tx.delete(index(uid));
      log();
      return {};
    }
    if (!["owner", "admin"].includes(authority))
      fail("permission-denied", "Administrator required.");
    if (action === "delete") {
      if (authority !== "owner") fail("permission-denied", "Owner required.");
      if (linked.length)
        fail(
          "failed-precondition",
          "Delete the team projects before deleting the team.",
        );
      await require("./deletion").deleteWorkspace(tx, ref, uid);
      if (resource.get("teamId"))
        tx.delete(
          db.doc("teams/" + resource.get("teamId") + "/projects/" + ref.id),
        );
      log();
      return {};
    }
    if (action === "invite") {
      if (!["editor", "viewer"].includes(role))
        fail("invalid-argument", "Invalid invite role.");
      const secret = randomBytes(32).toString("hex");
      tx.create(invites.doc(digest(secret)), {
        path: ref.path,
        role,
        expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
      });
      log();
      return { code: secret };
    }
    if (action === "revoke") {
      if (typeof code !== "string" || code.length !== 64)
        fail("invalid-argument", "Invalid invitation.");
      const row = await tx.get(invites.doc(digest(code)));
      if (row.get("path") !== ref.path)
        fail("not-found", "Invitation unavailable.");
      tx.delete(row.ref);
    } else if (action === "rename")
      tx.update(ref, { name: label, updatedAt: now() });
    else if (action === "archive" || action === "restore")
      tx.update(ref, { archived: action === "archive", updatedAt: now() });
    else if (["remove", "role", "transfer"].includes(action)) {
      if (authority !== "owner" || !key(target) || target === uid)
        fail("permission-denied", "Owner required.");
      if (!(await tx.get(member(target))).exists)
        fail("not-found", "Member unavailable.");
      if (action === "remove") {
        mirror(target, null);
        tx.delete(member(target));
        tx.delete(index(target));
      } else if (action === "transfer") {
        grant(uid, "admin");
        grant(target, "owner");
        tx.update(ref, { owner: target });
      } else {
        if (!["admin", "editor", "viewer"].includes(role))
          fail("invalid-argument", "Invalid role.");
        grant(target, role);
      }
    } else fail("invalid-argument", "Unknown operation.");
    log();
    return {};
  });
});

exports.notifyMessage = require("./notifications").notifyMessage;

exports.archiveSnapshot = require("./backups").archiveSnapshot;

exports.compactUpdates = require("./compaction").compactUpdates;
exports.runner = require("./runner").runner;
exports.assistant = require("./assistant").assistant;
exports.github = require("./github").github;

