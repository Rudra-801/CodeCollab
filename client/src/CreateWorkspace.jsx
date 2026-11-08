import React, { useEffect, useRef, useState } from "react";
import { FolderPlus, LockKeyhole, X } from "lucide-react";
export default function CreateWorkspace({ kind, close, create }) {
  const ref = useRef(null),
    [busy, B] = useState(false),
    [error, E] = useState("");
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      className="cc-dialog"
      ref={ref}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else close();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const name = e.currentTarget.elements.name.value.trim();
          const template = e.currentTarget.elements.template?.value;
          if (!name) return;
          B(true);
          try {
            await create(name,template);
            close();
          } catch (err) {
            E(err.message);
            B(false);
          }
        }}
      >
        <div className="dialog-head">
          <FolderPlus />
          <button
            type="button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={close}
          >
            <X size={16} />
          </button>
        </div>
        <h2>Create new {kind === "teams" ? "team" : "project"}</h2>
        <label>
          Workspace name
          <input
            name="name"
            autoFocus
            required
            maxLength={80}
            placeholder={kind === "teams" ? "Engineering team" : "My project"}
          />
        </label>
        {kind !== "teams" && <label>Language / template<select name="template" defaultValue="javascript"><option value="javascript">JavaScript starter</option><option value="typescript">TypeScript starter</option><option value="python">Python starter (subset)</option></select></label>}
        <div className="privacy">
          <LockKeyhole />
          <div>
            <strong>Private workspace</strong>
            <small>Only invited members can access it.</small>
          </div>
        </div>
        <div role="alert">{error}</div>
        <div className="dialog-actions">
          <button type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Creating…" : "Create workspace"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
