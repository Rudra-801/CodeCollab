const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
async function deleteWorkspace(tx, ref, uid) {
  const members = await tx.get(ref.collection("members").limit(201));
  if (members.size > 200)
    throw new HttpsError(
      "resource-exhausted",
      "This workspace requires a bulk cleanup job.",
    );
  for (const member of members.docs) {
    tx.delete(member.ref);
    tx.delete(
      ref.firestore.doc(
        "users/" + member.id + "/" + ref.parent.id + "/" + ref.id,
      ),
    );
  }
  tx.update(ref, {
    deleted: true,
    archived: true,
    deletedBy: uid,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
module.exports = { deleteWorkspace };
