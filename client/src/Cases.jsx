import React,{useEffect,useState,useRef} from "react";
import {startRun} from "./startRun";
const blank=()=>({id:crypto.randomUUID(),input:"",expected:"",result:null});
export default function Cases({source,language}){
 const [cases,C]=useState(()=>[blank()]),[busy,B]=useState(false),[msg,M]=useState("");const suite=useRef(null);
 function stop(){if(suite.current){suite.current.cancelled=true;suite.current.job?.cancel()}}
 useEffect(()=>stop,[]);
 function patch(id,fields){C(rows=>rows.map(r=>r.id===id?{...r,...fields}:r))}
 async function run(failed){const session={cancelled:false};suite.current=session;B(true);M("");try{const code=source();for(const row of cases){if(session.cancelled)break;if(failed&&row.result?.pass!==false)continue;
 session.job=startRun(code,row.input,language);const output=await session.job.result;patch(row.id,{result:{...output,pass:output.exitCode===0&&(output.stdout||"").replace(/\r\n/g,"\n").replace(/\n$/,"")===row.expected.replace(/\r\n/g,"\n").replace(/\n$/,"")}})}}catch(e){M(e.message)}finally{suite.current=null;B(false)}}
 return <details className="test-cases"><summary>Test cases ({cases.length})</summary>{cases.map((r,i)=><fieldset key={r.id} disabled={busy}><legend>Case {i+1}</legend><label>Case input<textarea maxLength={8192} value={r.input} onChange={e=>patch(r.id,{input:e.target.value,result:null})}/></label><label>Expected output<textarea maxLength={8192} value={r.expected} onChange={e=>patch(r.id,{expected:e.target.value,result:null})}/></label>{r.result&&<div><strong>{r.result.pass?"Passed":"Failed"}</strong><pre>{r.result.stdout}{r.result.stderr}</pre></div>}<button onClick={()=>C(rows=>rows.filter(x=>x.id!==r.id))}>Remove case</button></fieldset>)}<button disabled={busy||cases.length>=8} onClick={()=>C(rows=>[...rows,blank()])}>Add case</button><button disabled={busy||!cases.length} onClick={()=>run(false)}>Run all cases</button>{cases.some(r=>r.result?.pass===false)&&<button disabled={busy} onClick={()=>run(true)}>Rerun failed</button>}{busy&&<button onClick={stop}>Stop tests</button>}<p role="alert">{msg}</p></details>
}
