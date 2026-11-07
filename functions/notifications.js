const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const {
  getFirestore,
  FieldValue,
  FieldPath,
} = require("firebase-admin/firestore");
exports.notifyMessage = onDocumentCreated(
  { document: "projects/{project}/messages/{message}", retry: true },
  async (event) => {
    const db = getFirestore(),
      { project, message } = event.params,
      data = event.data.data();
    const members = db.collection("projects/" + project + "/members");
    let last;
    for (;;) {
      let query = members.orderBy(FieldPath.documentId()).limit(100);
      if (last) query = query.startAfter(last);
      const page = await query.get();
      if (page.empty) return;
      await Promise.all(
        page.docs
          .filter((m) => m.id !== data.uid)
          .map((m) =>
            db.runTransaction(async (tx) => {
              const profile = db.doc("users/" + m.id),
                note = profile
                  .collection("notifications")
                  .doc(project + "_" + message);
              const [current, settings, exists] = await Promise.all([
                tx.get(m.ref),
                tx.get(profile),
                tx.get(note),
              ]);
              if (
                !current.exists ||
                exists.exists ||
                settings.get("notifications") === false
              )
                return;
              tx.create(note, {
                project,
                createdAt: FieldValue.serverTimestamp(),
                read: false,
                type: "message",
              });
            }),
          ),
      );
      last = page.docs.at(-1);
    }
  },
);
