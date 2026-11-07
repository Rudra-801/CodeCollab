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
    [job, J] = useState(""),
    [input, I] = useState(""),
    [output, O] = useState(null),
    [err, E] = useState(""),
    [question, Q] = useState(""),
    [answer, A] = useState(""),
    [pending, P] = useState(false);
  const lang = languageFor(name),
    execution = import.meta.env.VITE_EXECUTION_ENABLED === "true",
    ai = import.meta.env.VITE_AI_ENABLED === "true";
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
  async function ask() {
    P(true);
    A("");
    E("");
    try {
      const model = editor.current.model,
        selection = editor.current.instance.getSelection(),
        context = model.getValueInRange(selection);
      A((await invokeTool("assistant", { project, question, context })).answer);
    } catch (e) {
      E(e.message);
    } finally {
      P(false);
    }
  }
  return (
    <details className="worktools">
      <summary>Execution and code assistance</summary>
      <h3>Run {name}</h3>
      {/\.html?$/i.test(name) && <HtmlPreview editor={editor} />}
      {["javascript", "typescript"].includes(lang) ? (
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
      <GitPanel project={project} editor={editor} />
      <h3>Ask about selected code</h3>
      {ai ? (
        <>
          <label>
            Question
            <textarea
              value={question}
              onChange={(e) => Q(e.target.value)}
              maxLength={2000}
            />
          </label>
          <button disabled={pending || !question.trim()} onClick={ask}>
            Send selection
          </button>
          <pre>{answer}</pre>
        </>
      ) : (
        <p>AI provider is unconfigured.</p>
      )}
      <p role="alert">{err}</p>
    </details>
  );
}
