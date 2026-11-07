import React, { useState } from "react";
import { invokeTool } from "./firebase";
export default function GitPanel({ project, editor }) {
  const [repo, R] = useState(""),
    [branch, B] = useState("main"),
    [path, P] = useState(""),
    [entries, L] = useState([]),
    [remote, F] = useState(null),
    [pending, D] = useState(null),
    [status, S] = useState(""),
    [busy, W] = useState(false);
  async function call(action, extra = {}, onDone) {
    W(true);
    S("");
    try {
      const data = await invokeTool("github", {
        project,
        repo,
        branch,
        path,
        action,
        ...extra,
      });
      if (onDone) onDone(data);
      else S("Done.");
    } catch (e) {
      S(e.message);
    } finally {
      W(false);
    }
  }
  function browse(target) {
    P(target);
    F(null);
    call("read", { path: target }, (d) => {
      L(d.entries || []);
      F(d.content === undefined ? null : { ...d, target, repo, branch });
    });
  }
  return (
    <details>
      <summary>GitHub</summary>
      {import.meta.env.VITE_GITHUB_ENABLED !== "true" ? (
        <p>GitHub App is unconfigured.</p>
      ) : (
        <fieldset disabled={busy}>
          <button onClick={() => call("connect", {}, D)}>Connect GitHub</button>
          {pending && (
            <p>
              Enter <code>{pending.code}</code> at{" "}
              <a
                href="https://github.com/login/device"
                target="_blank"
                rel="noreferrer"
              >
                GitHub device authorization
              </a>
              .{" "}
              <button
                onClick={() =>
                  call("finish", { session: pending.session }, () => {
                    D(null);
                    S("Connected.");
                  })
                }
              >
                Check connection
              </button>
            </p>
          )}
          <button
            onClick={() =>
              call("disconnect", {}, () => {
                F(null);
                L([]);
                S("Disconnected.");
              })
            }
          >
            Disconnect
          </button>
          <label>
            Repository
            <input
              placeholder="owner/repository"
              value={repo}
              onChange={(e) => {
                R(e.target.value);
                F(null);
                L([]);
              }}
            />
          </label>
          <label>
            Branch
            <input
              value={branch}
              onChange={(e) => {
                B(e.target.value);
                F(null);
                L([]);
              }}
            />
          </label>
          <button onClick={() => browse("")}>Browse repository</button>
          {path && (
            <button
              onClick={() => browse(path.split("/").slice(0, -1).join("/"))}
            >
              Parent directory
            </button>
          )}
          {entries.map((e) => (
            <button key={e.path} onClick={() => browse(e.path)}>
              {e.type === "dir" ? "▸ " : ""}
              {e.path}
            </button>
          ))}
          {remote && (
            <section>
              <h4>{remote.target}</h4>
              <details>
                <summary>Review remote and current file</summary>
                <small>Remote</small>
                <pre>{remote.content}</pre>
                <small>Current editor</small>
                <pre>{editor.current?.model.getValue()}</pre>
              </details>
              <button
                onClick={() =>
                  call("import", { path: remote.target }, () =>
                    S("Imported as a separate workspace file."),
                  )
                }
              >
                Pull into new file
              </button>
              <button
                onClick={() => {
                  const msg = prompt(
                    "Commit current editor to " +
                      repo +
                      "/" +
                      remote.target +
                      " on " +
                      branch +
                      ". Enter commit message:",
                  );
                  if (msg)
                    call(
                      "push",
                      {
                        path: remote.target,
                        sha: remote.sha,
                        source: editor.current.model.getValue(),
                        message: msg,
                      },
                      (d) => {
                        F(null);
                        S("Pushed commit " + d.commit);
                      },
                    );
                }}
              >
                Commit and push current file
              </button>
            </section>
          )}
        </fieldset>
      )}
      {status&&<p role="status">{status}</p>}
    </details>
  );
}

