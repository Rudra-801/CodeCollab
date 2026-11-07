import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
export async function createPersonalProject(db, uid, name) {
  const label = name.trim();
  if (!label || label.length > 80)
    throw Error("Enter a name of 1–80 characters.");
  const ref = doc(collection(db, "projects")),
    batch = writeBatch(db),
    timestamp = serverTimestamp();
  batch.set(ref, {
    name: label,
    owner: uid,
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  batch.set(doc(ref, "members", uid), { uid, role: "owner" });
  batch.set(doc(db, "users", uid, "projects", ref.id), {
    id: ref.id,
    role: "owner",
  });
  batch.set(doc(ref, "activity", "created"), {
    action: "create",
    uid,
    createdAt: timestamp,
  });
  await batch.commit();
  return { id: ref.id, kind: "projects" };
}
