import React, { useState, useEffect } from "react";
import { ref, uploadBytes, getBlob, list } from "firebase/storage";
import { storage } from "./firebase";
export default function Assets({ uid, project, writable = true }) {
  const [rows, R] = useState([]),
    [avatar, A] = useState(""),
    [message, M] = useState(""),
    [revision, V] = useState(0);
  useEffect(() => {
    if (!storage) return;
    let active = true,
      url;
    if (uid)
      getBlob(ref(storage, "avatars/" + uid + "/profile"))
        .then((blob) => {
          if (active) {
            url = URL.createObjectURL(blob);
            A(url);
          }
        })
        .catch((e) => {
          if (active && e.code !== "storage/object-not-found") M(e.message);
        });
    else
      list(ref(storage, "projects/" + project + "/assets"), { maxResults: 100 })
        .then((s) => {
          if (active) R(s.items);
        })
        .catch((e) => {
          if (active) M(e.message);
        });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [uid, project, revision]);
  if (!storage) return <p>Storage requires a configured bucket.</p>;
  return (
    <details>
      <summary>{uid ? "Profile image" : "Project assets"}</summary>
      {avatar && <img src={avatar} width="64" height="64" alt="Profile" />}
      {writable && (
        <label>
          Upload {uid ? "image" : "asset"}
          <input
            type="file"
            accept={uid ? "image/png,image/jpeg,image/webp" : undefined}
            onChange={async (e) => {
              const f = e.target.files[0];
              if (!f) return;
              try {
                M("Uploading…");
                await uploadBytes(
                  ref(
                    storage,
                    uid
                      ? "avatars/" + uid + "/profile"
                      : "projects/" + project + "/assets/" + f.name,
                  ),
                  f,
                );
                M("Upload complete");
                V((v) => v + 1);
              } catch (err) {
                M(err.message);
              }
            }}
          />
        </label>
      )}
      {rows.map((r) => (
        <button
          key={r.fullPath}
          onClick={async () => {
            try {
              const url = URL.createObjectURL(await getBlob(r)),
                a = document.createElement("a");
              a.href = url;
              a.download = r.name;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (e) {
              M(e.message);
            }
          }}
        >
          {r.name}
        </button>
      ))}
      <p role="status">{message}</p>
    </details>
  );
}
