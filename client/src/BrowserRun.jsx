import {startRun} from "./startRun";import React, { useEffect, useRef, useState } from "react";
export default function BrowserRun({ source, language }) {
  const [input, I] = useState(""),
    [busy, B] = useState(false),
    [result, R] = useState(null),
    [history, setHistory] = useState([]),
    running = useRef(null), outputRef=useRef(null);
  useEffect(()=>{if(result)outputRef.current?.scrollIntoView({block:"nearest"})},[result]);
  function stop(){running.current?.cancel()}
  useEffect(()=>()=>{running.current?.cancel();running.current=null},[]);
  async function run(){R(null);B(true);try{const job=startRun(source(),input,language);running.current=job;const value=await job.result;if(running.current===job){R(value);setHistory(items=>[{time:new Date().toLocaleTimeString(),...value},...items].slice(0,10))}}catch(e){R({exitCode:1,stderr:e.message})}finally{running.current=null;B(false)}}  return (
    <section className="worktools">
      <small>{language==="python"?"Python · Skulpt 1.2":"JavaScript engine · QuickJS"} · 24 MiB guest heap</small>
      <label>
        Standard input
        <textarea
          aria-label="Standard input"
          value={input}
          maxLength={8192}
          onChange={(e) => I(e.target.value)}
        />
      </label>
      <button data-run disabled={busy} onClick={run}>
        Run program
      </button>
      {busy && (
        <button data-stop
          onClick={() => {
            stop();
            R({ stderr: "Cancelled", exitCode: 130 });
          }}
        >
          Stop program
        </button>
      )}
      {result && (
        <div ref={outputRef} role="status">
          <small>
            Exit {result.exitCode}
            {result.elapsedMs != null && " · " + result.elapsedMs + " ms"}
          </small>
          <pre>{result.stdout}</pre>
          <pre>{result.stderr}</pre>
        </div>
      )}
      {history.length>0 && <details><summary>Execution history ({history.length})</summary><ol>{history.map((entry,i)=><li key={i}><button onClick={()=>R(entry)}>{entry.time} · Exit {entry.exitCode}{entry.elapsedMs!=null && " · "+entry.elapsedMs+" ms"}</button></li>)}</ol></details>}
    </section>
  );
}

