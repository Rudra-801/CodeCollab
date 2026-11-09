import Assistant from "./Assistant";
import Cases from "./Cases";
import GitPanel from "./GitPanel";
import HtmlPreview from "./HtmlPreview";
import BrowserRun from "./BrowserRun";
import React, { useState } from "react";
import { invokeTool } from "./firebase";
const languages = {
  py: "python",
  js: "javascript",
  ts: "typescript",
  java: "java",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  go: "go",
  rs: "rust",
  php: "php",
  rb: "ruby",
};
export const languageFor = (name) =>
  languages[name.split(".").pop()] || "plaintext";
export default function Tools({ editor, path, name }) {
  const project = path.split("/")[1],
    [panel,setPanel] = useState("output"),
    [job, J] = useState(""),
    [input, I] = useState(""),
    [output, O] = useState(null),
    [err, E] = useState("");
  const lang = languageFor(name),
    execution = import.meta.env.VITE_EXECUTION_ENABLED === "true";
  async function run() {
    const id = crypto.randomUUID();
    J(id);
    E("");
    O(null);
    try {
      O(
        await invokeTool("runner", {
          project,
          job: id,
          language: lang,
          stdin: input,
          source: editor.current.model.getValue(),
        }),
      );
    } catch (e) {
      E(e.message);
    } finally {
      J("");
    }
  }
  return (
    <details className="worktools" open onClickCapture={e=>{if(e.target.closest("[data-run]"))setPanel("output")}}>
      <summary>Workspace panel</summary>
      <nav className="tool-tabs" aria-label="Workspace panels">
        {[["output","Output"],["tests","Tests"],["git","Source Control"],["ai","AI Assistant"]].map(([id,label])=><button type="button" key={id} aria-pressed={panel===id} onClick={()=>setPanel(id)}>{label}</button>)}
      </nav>
      <div hidden={panel!=="output"}>
      <h3>Run {name}</h3>
      {/\.html?$/i.test(name) && <HtmlPreview editor={editor} />}
      {["python", "javascript", "typescript"].includes(lang) ? (
        <BrowserRun
          language={lang}
          source={() => editor.current.model.getValue()}
        />
      ) : execution && lang !== "plaintext" ? (
        <>
          <label>
            Standard input
            <textarea
              value={input}
              maxLength={8192}
              onChange={(e) => I(e.target.value)}
            />
          </label>
          <button disabled={!!job} onClick={run}>
            Run
          </button>
          {job && (
            <button
              onClick={() =>
                invokeTool("runner", { project, job, action: "stop" }).catch(
                  (e) => E(e.message),
                )
              }
            >
              Stop
            </button>
          )}
          {output && (
            <>
              <p>
                Exit {output.exitCode} · {output.elapsedMs} ms
              </p>
              <pre>{output.stdout}</pre>
              <pre>{output.stderr}</pre>
            </>
          )}
        </>
      ) : (
        <p>
          {execution
            ? "This file type has no configured runtime."
            : "Execution provider is unconfigured."}
        </p>
      )}
      </div>
      <div hidden={panel!=="tests"}>{["python","javascript","typescript"].includes(lang)?<Cases language={lang} source={()=>editor.current.model.getValue()}/>:<p>No test runtime is configured for this file.</p>}</div>
      <div hidden={panel!=="git"}><GitPanel project={project} editor={editor}/></div>
      <div hidden={panel!=="ai"}><Assistant project={project} editor={editor}/>      </div><p role="alert">{err}</p>
    </details>
  );
}

