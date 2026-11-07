const { HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const fail = (code, message) => {
  throw new HttpsError(code, message);
};
async function authorize(req) {
  const uid = req.auth?.uid,
    id = req.data?.project;
  if (!uid) fail("unauthenticated", "Sign in.");
  await getAuth().verifyIdToken(
    req.rawRequest.headers.authorization.slice(7),
    true,
  );
  if (typeof id !== "string" || !/^[-\w]{1,128}$/.test(id))
    fail("invalid-argument", "Invalid project.");
  const member = await getFirestore()
    .doc("projects/" + id + "/members/" + uid)
    .get();
  if (!member.exists) fail("permission-denied", "Membership required.");
  return uid;
}
async function reserve(ref, job) {
  await getFirestore().runTransaction(async (tx) => {
    const row = (await tx.get(ref)).data() || {},
      now = Date.now(),
      day = new Date(now).toISOString().slice(0, 10);
    const used = row.day === day ? row.used : 0;
    if (row.until > now || used >= 50 || now - (row.started || 0) < 3000)
      fail("resource-exhausted", "Usage limit reached. Try again later.");
    tx.set(ref, {
      job,
      day,
      used: used + 1,
      started: now,
      until: now + 90000,
      sandbox: null,
      cancelled: false,
    });
  });
}
module.exports = { authorize, reserve, fail };
