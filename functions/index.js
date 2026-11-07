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
    await db.recursiveDelete(profile);
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
    const grant = (user, value) => {
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
      return { id: ref.id };
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
      return { id: ref.id };
    }
    const authority = membership.get("role");
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
      tx.delete(member(uid));
      tx.delete(index(uid));
      log();
      return {};
    }
    if (!["owner", "admin"].includes(authority))
      fail("permission-denied", "Administrator required.");
    if (action === "delete") {
      if (authority !== "owner") fail("permission-denied", "Owner required.");
      await require("./deletion").deleteWorkspace(tx, ref, uid);
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
