import React, { useState } from "react";
import { command } from "./firebase";
import { useRows } from "./Dashboard";
export default function Folders({
  project,
  current,
  select,
  writable,
  onError,
}) {
  const folders = useRows("projects/" + project + "/folders"),
    [busy, B] = useState(false);
  const currentFolder = folders.rows?.find((f) => f.id === current);
  async function change(action) {
    const name =
      action === "deleteFolder"
        ? ""
        : prompt(
            "Folder name",
            action === "renameFolder" ? currentFolder?.name : "",
          );
    if (
      action === "deleteFolder" ? !confirm("Delete this empty folder?") : !name
    )
      return;
    try {
      B(true);
      const result = await command({
        action,
        id: project,
        target: current,
        name,
      });
      if (action === "createFolder") select(result.id);
      if (action === "deleteFolder") select(currentFolder.parent || "");
    } catch (e) {
      onError(e.message);
    } finally {
      B(false);
    }
  }
  return (
    <section>
      <small>{currentFolder?.name || "Project root"}</small>
      {currentFolder && (
        <button onClick={() => select(currentFolder.parent)}>↑ Parent</button>
      )}
      {folders.rows
        ?.filter((f) => f.parent === current)
        .map((f) => (
          <button key={f.id} onClick={() => select(f.id)}>
            ▸ {f.name}
          </button>
        ))}
      {writable && (
        <>
          <button disabled={busy} onClick={() => change("createFolder")}>
            + Folder
          </button>
          {currentFolder && (
            <>
              <button onClick={() => change("renameFolder")}>
                Rename folder
              </button>
              <button onClick={() => change("deleteFolder")}>
                Delete folder
              </button>
            </>
          )}
        </>
      )}
      <p role="alert">{folders.error}</p>
    </section>
  );
}
