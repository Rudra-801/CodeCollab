const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createHash } = require("node:crypto");
const Y = require("yjs");
exports.compactUpdates = onDocumentCreated(
  { document: "projects/{p}/files/{f}/updates/{id}", retry: true },
  async (event) => {
    const { p, f, id } = event.params;
    if (
      id.startsWith("merged_") ||
      createHash("sha256").update(id).digest()[0] % 32 !== 0
    )
      return;
    const db = getFirestore(),
      file = db.doc("projects/" + p + "/files/" + f),
      updates = file.collection("updates");
    await db.runTransaction(async (tx) => {
      if (!(await tx.get(file)).exists) return;
      const batch = await tx.get(updates.orderBy("createdAt").limit(96));
      if (batch.size < 64) return;
      const rows = [];
      let total = 0;
      for (const row of batch.docs) {
        const bytes = row.get("bytes");
        if (total + bytes.length > 700000) break;
        rows.push(row);
        total += bytes.length;
      }
      if (rows.length < 2) return;
      const merged = Buffer.from(
        Y.mergeUpdates(rows.map((r) => new Uint8Array(r.get("bytes")))),
      );
      tx.create(updates.doc("merged_" + updates.doc().id), {
        bytes: merged,
        createdAt: FieldValue.serverTimestamp(),
        uid: "system",
      });
      rows.forEach((r) => tx.delete(r.ref));
    });
  },
);
