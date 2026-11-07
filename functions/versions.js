const Y = require("yjs");
const { FieldValue } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const invalid = (message) => {
  throw new HttpsError("failed-precondition", message);
};
async function capture(tx, project) {
  const files = await tx.get(project.collection("files").limit(65));
  if (files.size > 64) invalid("Snapshot limit is 64 files.");
  const directory = await tx.get(project.collection("folders").limit(65));
  if (directory.size > 64) invalid("Snapshot limit is 64 folders.");
  const output = directory.docs.map((d) => ({
    kind: "folder",
    id: d.id,
    name: d.get("name"),
    parent: d.get("parent"),
  }));
  let size = 0;
  for (const file of files.docs) {
    const updates = await tx.get(file.ref.collection("updates").limit(1001));
    if (updates.size > 1000)
      invalid("Compact this file before taking a snapshot.");
    const bytes = Buffer.from(
      Y.mergeUpdates(updates.docs.map((d) => new Uint8Array(d.get("bytes")))),
    );
    size += bytes.length;
    if (size > 700000) invalid("Snapshot exceeds the inline backup limit.");
    output.push({
      name: file.get("name"),
      parent: file.get("parent") || "",
      bytes,
    });
  }
  return output;
}
function writeFiles(tx, project, files, uid) {
  for (const file of files) {
    if (file.kind === "folder") {
      tx.create(project.collection("folders").doc(file.id), {
        name: file.name,
        parent: file.parent,
        createdAt: FieldValue.serverTimestamp(),
      });
      continue;
    }
    const ref = project.collection("files").doc();
    tx.create(ref, {
      parent: file.parent || "",
      name: file.name,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.create(ref.collection("updates").doc(), {
      uid,
      bytes: file.bytes,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}
async function versionAction({ action, tx, project, uid, role, target }) {
  if (!["owner", "admin", "editor"].includes(role))
    throw new HttpsError("permission-denied", "Editing access required.");
  const versions = project.collection("versions");
  if (action === "snapshot") {
    const files = await capture(tx, project),
      ref = versions.doc();
    tx.create(ref, {
      uid,
      fileCount: files.filter((f) => f.kind !== "folder").length,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.create(ref.collection("backup").doc("files"), { files });
    return {};
  }
  if (
    action === "restoreVersion" &&
    (!target || !/^[a-zA-Z0-9_-]{1,128}$/.test(target))
  )
    invalid("Invalid version.");
  const files =
    action === "duplicate"
      ? await capture(tx, project)
      : (
          await tx.get(versions.doc(target).collection("backup").doc("files"))
        ).get("files");
  if (!files) invalid("Version unavailable.");
  const source = await tx.get(project),
    copy = project.parent.doc();
  tx.create(copy, {
    name: (
      source.get("name") + (action === "duplicate" ? " · Copy" : " · Restored")
    ).slice(0, 80),
    owner: uid,
    archived: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  tx.create(copy.collection("members").doc(uid), { uid, role: "owner" });
  tx.create(project.firestore.doc("users/" + uid + "/projects/" + copy.id), {
    id: copy.id,
    role: "owner",
  });
  writeFiles(tx, copy, files, uid);
  return { id: copy.id };
}
module.exports = { versionAction };
