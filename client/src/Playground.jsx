import React,{lazy,Suspense,useEffect,useState} from "react";
import {formatProgram} from "./formatProgram";
import BrowserRun from "./BrowserRun";
import Cases from "./Cases";
import {Brand} from "./Landing";
import {db} from "./firebase";
import {createPersonalProject} from "./createPersonalProject";
const PlaygroundEditor=lazy(()=>import("./PlaygroundEditor"));
const templates={python:"n = int(input())\nprint(n * n)",javascript:'const name = readline() || "team";\nconsole.log("Hello, " + name + "!");',typescript:'const name: string = readline() || "team";\nconsole.log("Hello, " + name + "!");'};
const titles={python:"Python",javascript:"JavaScript",typescript:"TypeScript"},files={python:"main.py",javascript:"main.js",typescript:"main.ts"};
function initial(){
 try{const shared=new URLSearchParams(location.hash.split("?")[1]).get("snippet");const data=shared?JSON.parse(shared):JSON.parse(sessionStorage.getItem("cc-playground")||"null");
 if(data&&Object.hasOwn(templates,data.language)&&typeof data.source==="string"&&data.source.length<=65536)return {language:data.language,docs:{...templates,[data.language]:data.source}};
 }catch{}return {language:"python",docs:{...templates}}
}
export default function Playground({user}){
 const [draft,D]=useState(initial),[notice,N]=useState(""),[busy,B]=useState(false);
 const {language,docs}=draft,source=docs[language];const snippet=()=>({language,source});
 useEffect(()=>{try{sessionStorage.setItem("cc-playground",JSON.stringify({language,source}))}catch{}},[language,source]);
 async function format(){
   const original=source;
   try{const formatted=await formatProgram(original,files[language]);
   D(current=>current.language===language && current.docs[language]===original ? {...current,docs:{...current.docs,[language]:formatted}} : current);
   }catch(error){N(error.message)}
 }
 function edit(language,docs){D({language,docs})}
 async function save(){if(!user){sessionStorage.setItem("cc-playground",JSON.stringify(snippet()));sessionStorage.setItem("cc-playground-resume","yes");location.hash="login";return}
 const name=prompt("New project name",titles[language]+" playground");if(!name?.trim())return;B(true);try{await createPersonalProject(db,user.uid,name,{name:files[language],source});N("Saved "+name+". Open Workspaces to continue.")}catch(e){N(e.message)}finally{B(false)}}
 async function copy(share){try{if(share&&source.length>6000)throw Error("Share links support up to 6,000 characters.");await navigator.clipboard.writeText(share?location.origin+location.pathname+"#playground?"+new URLSearchParams({snippet:JSON.stringify(snippet())}):source);N(share?"Link copied. Anyone with the link can read this code.":"Code copied.")}catch(e){N(e.message)}}
 return <main className="pg-shell"><header><a href="#"><Brand/></a><strong>Playground</strong><a href={user?"#":"#login"}>{user?"Workspaces":"Sign in"}</a></header><section className="pg-layout"><aside><h1>Playground</h1><label>Language<select value={language} onChange={e=>edit(e.target.value,docs)}>{Object.keys(templates).map(k=><option key={k} value={k}>{titles[k]}</option>)}</select></label><button disabled={busy} onClick={save}>{user?"Save as project":"Sign in to save"}</button><button onClick={()=>copy(true)}>Share code link</button></aside><section><div className="pg-tab"><strong>{files[language]}</strong>{language!=="python"&&<button onClick={format}>Format</button>}<button onClick={()=>{const url=URL.createObjectURL(new Blob([source],{type:"text/plain"}));const link=document.createElement("a");link.href=url;link.download=files[language];link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}>Download</button><button onClick={()=>copy(false)}>Copy</button><button onClick={()=>{if(confirm("Reset this program to its starter template?"))edit(language,{...docs,[language]:templates[language]})}}>Reset</button></div><Suspense fallback={<p>Loading editor...</p>}><PlaygroundEditor language={language} value={source} onChange={value=>edit(language,{...docs,[language]:value})}/></Suspense></section><section className="pg-output"><h2>Execution</h2><BrowserRun key={language} source={()=>source} language={language}/><Cases key={language+"-cases"} source={()=>source} language={language}/></section></section><p role="alert">{notice}</p></main>
}
