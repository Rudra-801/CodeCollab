import { createPersonalProject } from "../src/createPersonalProject.js";
import assert from "node:assert/strict";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  applyActionCode,
  confirmPasswordReset,
  signOut,
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
} from "firebase/auth";
import {
  collection, getDocs, getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";
import {
  getStorage,
  connectStorageEmulator,
  ref,
  uploadBytes,
  getBytes,
} from "firebase/storage";
const projectId = "demo-codecollab",
  tag = Date.now();
async function session(n) {
  const app = initializeApp(
    {
      apiKey: "demo-key",
      projectId,
      storageBucket: projectId + ".appspot.com",
    },
    n,
  );
  const auth = getAuth(app),
    db = getFirestore(app),
    fn = getFunctions(app),
    storage = getStorage(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(fn, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  const email = n + tag + "@example.test";
  const { user } = await createUserWithEmailAndPassword(
    auth,
    email,
    "Testing-8597",
  );
  return {
    uid: user.uid,
    email,
    db,
    auth,
    storage,
    tool: async (name,data) => (await httpsCallable(fn,name)(data)).data,
    cmd: async (data) => (await httpsCallable(fn, "workspace")(data)).data,
  };
}
async function test() {
  const a = await session("owner"),
    b = await session("viewer"),
    c = await session("outsider");
  const { id } = await a.cmd({ action: "create", name: "Integration" });
  for (const name of ["runner","assistant"]) {
    await assert.rejects(c.tool(name,{project:id,job:crypto.randomUUID(),question:"Explain",context:"print(1)"}),error=>error.code==="functions/permission-denied");
    await assert.rejects(a.tool(name,{project:id,job:crypto.randomUUID(),question:"Explain",context:"print(1)"}),error=>error.code==="functions/failed-precondition");
  }
  await assert.rejects(a.tool("github",{action:"status"}),error=>error.code==="functions/failed-precondition");
  console.log("PASS emulator tool authorization and fail-closed provider configuration");
  const action = (action, args = {}) => a.cmd({ action, id, ...args });
  const { code } = await action("invite", { role: "viewer" });
  await b.cmd({ action: "join", code });
  await assert.rejects(c.cmd({ action: "join", code }));
  const personal = await createPersonalProject(
    a.db,
    a.uid,
    "Personal workspace",
    {name: "main.py", source: "print(42)"},
  );
  const files = await getDocs(collection(a.db, "projects", personal.id, "files"));
  assert.equal(files.size, 1);
  assert.equal(files.docs[0].get("name"), "main.py");
  const updates = await getDocs(collection(files.docs[0].ref, "updates"));
  const Y = await import("yjs");
  const restored = new Y.Doc();
  updates.forEach(update => Y.applyUpdate(restored, update.get("bytes").toUint8Array()));
  assert.equal(restored.getText("content").toString(), "print(42)");
  restored.destroy();
  assert.equal(
    (await getDoc(doc(a.db, "projects/" + personal.id))).get("owner"),
    a.uid,
  );
  await assert.rejects(
    setDoc(doc(b.db, "projects/" + personal.id + "/members/" + b.uid), {
      uid: b.uid,
      role: "owner",
    }),
  );
  const folder = await action("createFolder", { target: "", name: "src" });
  await action("renameFolder", { target: folder.id, name: "source" });
  const file = "projects/" + id + "/files/main";
  await setDoc(doc(a.db, file), {
    name: "main.js",
    parent: folder.id,
    createdAt: serverTimestamp(),
  });
  await assert.rejects(
    setDoc(doc(b.db, file), { name: "changed" }, { merge: true }),
  );
  await assert.rejects(getDoc(doc(c.db, file)));
  await assert.rejects(
    setDoc(
      doc(b.db, "projects/" + id + "/members/" + b.uid),
      { role: "owner" },
      { merge: true },
    ),
  );
  await assert.rejects(b.cmd({ action: "transfer", id, target: b.uid }));
  await assert.rejects(action("deleteFolder", { target: folder.id }));
  await action("rename", { name: "Renamed workspace" });
  assert.equal(
    (await getDoc(doc(a.db, "projects/" + id))).get("name"),
    "Renamed workspace",
  );
  await action("archive");
  await assert.rejects(
    setDoc(doc(a.db, file), { name: "blocked" }, { merge: true }),
  );
  await action("restore");
  await action("snapshot");
  const { id: copy } = await action("duplicate");
  assert.equal(
    (await getDoc(doc(a.db, "projects/" + copy))).get("owner"),
    a.uid,
  );
  const asset = "projects/" + id + "/assets/test.txt";
  await uploadBytes(ref(a.storage, asset), new Uint8Array([7]));
  assert.equal(new Uint8Array(await getBytes(ref(b.storage, asset)))[0], 7);
  await assert.rejects(
    uploadBytes(ref(b.storage, asset + "2"), new Uint8Array([1])),
  );
  await action("remove", { target: b.uid });
  await assert.rejects(getDoc(doc(b.db, file)));
  await assert.rejects(getBytes(ref(b.storage, asset)));
  const team = await a.cmd({
    action: "create",
    kind: "teams",
    name: "Test team",
  });
  const invite = await a.cmd({
    action: "invite",
    kind: "teams",
    id: team.id,
    role: "editor",
  });
  const teamProject = await a.cmd({
    action: "createTeamProject",
    kind: "teams",
    id: team.id,
    name: "Shared engineering",
  });
  await b.cmd({ action: "join", code: invite.code });
  assert.equal(
    (await getDoc(doc(b.db, "projects/" + teamProject.id))).get("teamId"),
    team.id,
  );
  await a.cmd({
    action: "transfer",
    kind: "teams",
    id: team.id,
    target: b.uid,
  });
  await assert.rejects(
    a.cmd({ action: "transfer", kind: "teams", id: team.id, target: a.uid }),
  );
  await b.cmd({ action: "remove", kind: "teams", id: team.id, target: a.uid });
  await assert.rejects(getDoc(doc(a.db, "projects/" + teamProject.id)));
  await action("deleteFile", { target: "main" });
  await action("deleteFolder", { target: folder.id });
  await assert.rejects(
    setDoc(doc(a.db, file), {
      name: "reclaimed",
      createdAt: serverTimestamp(),
    }),
  );
  await a.cmd({ action: "delete", id: copy });
  await assert.rejects(getDoc(doc(a.db, "projects/" + copy)));
  await sendEmailVerification(a.auth.currentUser);
  async function oob(mode) {
    const r = await fetch(
      "http://127.0.0.1:9099/emulator/v1/projects/" + projectId + "/oobCodes",
    );
    const { oobCodes } = await r.json();
    return oobCodes
      .filter((x) => x.email === a.email && x.requestType === mode)
      .at(-1).oobCode;
  }
  await applyActionCode(a.auth, await oob("VERIFY_EMAIL"));
  await a.auth.currentUser.reload();
  assert.equal(a.auth.currentUser.emailVerified, true);
  await sendPasswordResetEmail(a.auth, a.email);
  const reset = await oob("PASSWORD_RESET");
  assert.equal(await verifyPasswordResetCode(a.auth, reset), a.email);
  await confirmPasswordReset(a.auth, reset, "Replacement-326");
  await assert.rejects(verifyPasswordResetCode(a.auth, reset));
  await signOut(a.auth);
  await signInWithEmailAndPassword(a.auth, a.email, "Replacement-326");
  console.log(
    "PASS emulator authentication, reset, verification, replay denial, cross-user access, viewer permissions, storage, snapshot creation, duplication and team ownership",
  );
}
test().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
