import React, {useEffect,useRef,useState} from "react";
import {auth} from "./firebase";
import {readEvents} from "../../gateway/providers.mjs";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import {editor as monacoEditor} from "monaco-editor/esm/vs/editor/editor.api.js";
import {DiffEditor,loader} from "@monaco-editor/react";
loader.config({monaco});
export default function Assistant({project,editor}) {
  const endpoint=import.meta.env.VITE_AI_GATEWAY_URL;
  const [providers,P]=useState([]),[provider,S]=useState("auto"),[model,M]=useState("");
  const historyKey="cc-ai-history-"+auth.currentUser?.uid+"-"+project;
  const [question,Q]=useState(""),[history,H]=useState(()=>{
    try{const saved=JSON.parse(sessionStorage.getItem(historyKey)||"[]");return Array.isArray(saved)?saved.filter(m=>["user","assistant"].includes(m.role)&&typeof m.content==="string").slice(-12):[];}catch{return []}
  }),[busy,B]=useState(false),[error,E]=useState(""),[proposal,D]=useState(null);
  const running=useRef(null);
  useEffect(()=>{try{sessionStorage.setItem(historyKey,JSON.stringify(history.slice(-12)))}catch{}},[history,historyKey]);
  useEffect(()=>()=>running.current?.abort(),[]);
  async function request(data,signal) {
    const token=await auth.currentUser.getIdToken();
    return fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({project,...data}),signal});
  }
  async function models(){
    E("");try{
      const r=await request({action:"models"},AbortSignal.timeout(15000));const data=await r.json();
      if(!r.ok)throw Error(data.error||"Gateway unavailable.");P(data.providers);
    }catch(e){E(e.message)}
  }
  async function send(){
    const current=editor.current;
    if(!question.trim()||busy||!current)return;
    const controller=new AbortController();running.current=controller;B(true);E("");D(null);
    const context=current.model.getValueInRange(current.instance.getSelection())||current.model.getValue();
    const next=[...history,{role:"user",content:question}];H([...next,{role:"assistant",content:""}]);
    let answer="";
    try {
      const r=await request({question,context,history:history.slice(-10),provider,model},controller.signal);
      if(!r.ok){const data=await r.json();throw Error(data.error||"AI unavailable.")}
      for await(const item of readEvents(r.body)){
        if(item.error)throw Error(item.error);
        if(item.text){answer+=item.text;H([...next,{role:"assistant",content:answer}]);}
      }
      Q("");
      const block=answer.match(/```[^\n]*\n([\s\S]*?)```/);
      if(block)D({original:current.model.getValue(),code:block[1],uri:current.model.uri.toString()});
    }catch(e){E(controller.signal.aborted?"Cancelled.":e.message)}
    finally{running.current=null;B(false);}
  }
  function apply(){
    const current=editor.current;
    if(!current||current.model.uri.toString()!==proposal.uri||current.model.getValue()!==proposal.original){E("File changed. Request a fresh proposal before applying.");return}
    if(current.instance.getOption(monacoEditor.EditorOption.readOnly)===true){E("This editor is read-only.");return}
    current.instance.pushUndoStop();
    current.instance.executeEdits("ai-reviewed-edit",[{range:current.model.getFullModelRange(),text:proposal.code,forceMoveMarkers:true}]);
    current.instance.pushUndoStop();D(null);
  }
  if(!endpoint)return <p>AI is not configured. A secure gateway and provider credentials are required.</p>;
  return <section className="assistant-panel">
    <p>Selected code, or the current file when no selection exists, is sent to the provider you choose. Fallback may send it to another configured provider.</p>
    <button disabled={busy} onClick={models}>Load available models</button>
    <label>Provider<select aria-label="Provider" value={provider} onChange={e=>{S(e.target.value);M("")}}><option value="auto">Auto fallback</option>{providers.map(p=><option key={p.provider}>{p.provider}</option>)}</select></label>
    {provider!=="auto"&&<label>Model<select aria-label="Model" value={model} onChange={e=>M(e.target.value)}><option value="">Provider default</option>{providers.find(p=>p.provider===provider)?.models.map(m=><option key={m}>{m}</option>)}</select></label>}
    <div className="assistant-actions">{["Explain","Debug","Fix","Refactor","Generate code","Generate tests"].map(action=><button key={action} disabled={busy} onClick={()=>Q(action+" the selected code. For replacements return the complete file in one fenced code block.")}>{action}</button>)}</div>
    <div aria-live="polite">{history.map((m,i)=><article key={i}><strong>{m.role==="user"?"You":"Assistant"}</strong><pre>{m.content}</pre></article>)}</div>
    <label>Question<textarea value={question} maxLength={2000} onChange={e=>Q(e.target.value)}/></label>
    <button disabled={busy||!question.trim()} onClick={send}>Send selected context</button>
    {busy&&<button onClick={()=>running.current?.abort()}>Cancel response</button>}
    <button disabled={busy} onClick={()=>{H([]);D(null)}}>Clear conversation</button>
    {proposal&&<section><h3>Review full-file replacement</h3><DiffEditor height="260px" original={proposal.original} modified={proposal.code} theme="vs-dark" options={{readOnly:true,renderSideBySide:false,minimap:{enabled:false}}}/><button onClick={apply}>Apply reviewed replacement</button><button onClick={()=>D(null)}>Discard</button></section>}
    <p role="alert">{error}</p>
  </section>;
}
