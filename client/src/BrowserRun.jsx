import React, { useEffect, useRef, useState } from "react";
export default function BrowserRun({ source, language }) {
  const [input, I] = useState(""),
    [busy, B] = useState(false),
    [result, R] = useState(null),
    running = useRef(null);
  function stop() {
    if (!running.current) return;
    const { worker, timer } = running.current;
    worker.terminate();
    clearTimeout(timer);
    running.current = null;
    B(false);
  }
  useEffect(
    () => () => {
      if (running.current) {
        clearTimeout(running.current.timer);
        running.current.worker.terminate();
      }
    },
    [],
  );
  function run() {
    const code = source();
    if (code.length > 65536) {
      R({ stderr: "Program exceeds 64 KiB.", exitCode: 1 });
      return;
    }
    stop();
    R(null);
    B(true);
    const worker = new Worker(
      new URL("./browserRunner.worker.js", import.meta.url),
      { type: "module" },
    );
    const timer = setTimeout(() => {
      stop();
      R({ stderr: "Worker deadline exceeded.", exitCode: 124 });
    }, 15000);
    running.current = { worker, timer };
    worker.onmessage = (e) => {
      stop();
      R(e.data);
    };
    worker.onerror = () => {
      stop();
      R({ stderr: "The runtime could not load.", exitCode: 1 });
    };
    worker.postMessage({ source: code, input, language });
  }
  return (
    <section className="worktools">
      <small>Browser runtime · QuickJS · 24 MiB</small>
      <label>
        Standard input
        <textarea
          aria-label="Standard input"
          value={input}
          maxLength={8192}
          onChange={(e) => I(e.target.value)}
        />
      </label>
      <button disabled={busy} onClick={run}>
        Run program
      </button>
      {busy && (
        <button
          onClick={() => {
            stop();
            R({ stderr: "Cancelled", exitCode: 130 });
          }}
        >
          Stop program
        </button>
      )}
      {result && (
        <div role="status">
          <small>
            Exit {result.exitCode}
            {result.elapsedMs != null && " · " + result.elapsedMs + " ms"}
          </small>
          <pre>{result.stdout}</pre>
          <pre>{result.stderr}</pre>
        </div>
      )}
    </section>
  );
}
