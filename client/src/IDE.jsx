import {Brand} from "./Landing";
import { Files, Search, MessageSquare } from "lucide-react";
import PanelDivider from "./PanelDivider";
import Tools, { languageFor } from "./Tools";
import Folders from "./Folders";
import { connectPresence } from "./presence";
import React, { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import Worker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import "monaco-editor/esm/vs/editor/contrib/quickAccess/browser/commandsQuickAccess";
import "monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  Bytes,
  serverTimestamp,
} from "firebase/firestore";
import { db, command } from "./firebase";
import { useRows } from "./Dashboard";
globalThis.MonacoEnvironment = { getWorker: () => new Worker() };
function Editor({ path, uid, name, writable, prefs }) {
  const container = useRef(),
    editor = useRef(),
    [status, S] = useState("Connecting"),
    [cursor, C] = useState("1:1"),
    [peers, P] = useState([]);
  const language = languageFor(name);
  useEffect(() => {
    let alive = true,
      queued = [],
      timer,
      ready = false;
    const ydoc = new Y.Doc(),
      model = monaco.editor.createModel("", language);
    // y-monaco indexes Y.Text in LF code units. Windows' default CRLF model
    // adds an extra offset for each line and can desynchronize remote edits.
    model.setEOL(monaco.editor.EndOfLineSequence.LF);
    const instance = monaco.editor.create(container.current, {
      model,
      automaticLayout: true,
      readOnly: true,
      theme: prefs.theme,
      minimap: { enabled: prefs.minimap },
      fontSize: 14,
    });
    editor.current = { instance, model, ready: false };
    const presence = connectPresence(ydoc, path, P);
    const binding = new MonacoBinding(
      ydoc.getText("content"),
      model,
      new Set([instance]),
      presence.awareness,
    );
    const changes = collection(db, path + "/updates");
    function flush() {
      clearTimeout(timer);
      if (!queued.length) return;
      const bytes = Y.mergeUpdates(queued);
      queued = [];
      addDoc(changes, {
        uid,
        bytes: Bytes.fromUint8Array(bytes),
        createdAt: serverTimestamp(),
      }).then(
        () => {
          if (alive) S("Saved");
        },
        (e) => {
          if (alive) {
            S("Save failed: " + e.message);
            instance.updateOptions({ readOnly: true });
          }
        },
      );
    }
    ydoc.on("update", (u, origin) => {
      if (origin === "remote") return;
      queued.push(u);
      S("Saving…");
      clearTimeout(timer);
      timer = setTimeout(flush, 200);
    });
    const unsub = onSnapshot(
      changes,
      { includeMetadataChanges: true },
      (snap) => {
        for (const change of snap.docChanges()) {
          if (change.type === "added")
            Y.applyUpdate(
              ydoc,
              change.doc.data().bytes.toUint8Array(),
              "remote",
            );
        }
        // Delete only CR characters in CRLF pairs. Concurrent normalization
        // deletes the same CRDT items and preserves every code character.
        const text=ydoc.getText("content").toString();
        if(text.includes("\r\n"))ydoc.transact(()=>{
          for(let i=text.length-2;i>=0;i--)if(text[i]==="\r"&&text[i+1]==="\n")ydoc.getText("content").delete(i,1);
        },writable?"line-ending-normalization":"remote");
        if (!ready && !snap.metadata.fromCache) {
          ready = true;
          editor.current.ready = true;
          instance.updateOptions({ readOnly: !writable });
        }
        if (!queued.length)
          S(
            snap.metadata.fromCache
              ? "Offline"
              : snap.metadata.hasPendingWrites
                ? "Saving…"
                : "Synced",
          );
      },
      (e) => {
        instance.updateOptions({ readOnly: true });
        S(e.message);
      },
    );
    const position = instance.onDidChangeCursorPosition((e) =>
      C(e.position.lineNumber + ":" + e.position.column),
    );
    instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, flush);
    const save=()=>flush();
    window.addEventListener("codecollab-save",save);
    return () => {
      window.removeEventListener("codecollab-save",save);
      alive = false;
      flush();
      unsub();
      position.dispose();
      binding.destroy();
      presence.close();
      instance.dispose();
      model.dispose();
      ydoc.destroy();
      editor.current = null;
    };
  }, [path, uid, writable]);
  useEffect(() => {
    if (editor.current) {
      monaco.editor.setModelLanguage(editor.current.model, language);
      editor.current.instance.updateOptions({
        minimap: { enabled: prefs.minimap },
      });
      monaco.editor.setTheme(prefs.theme);
    }
  }, [language, prefs]);
  return (
    <div className="editor-stack">
      <div ref={container} className="editor" />
      <small role="status">
        {language}　 Ln:Col {cursor}　 UTF-8　 {status}
      </small>
      <Tools editor={editor} path={path} name={name} />
      {peers.length > 0 && <small> · Online: {peers.join(`, `)}</small>}
    </div>
  );
}
export default function IDE({ project, user, writable, prefs, onExit }) {
  const [explorerVisible,setExplorerVisible]=useState(()=>{try{return localStorage.getItem("cc-explorer-"+user.uid)!=="false"}catch{return true}});
  const [chatVisible,setChatVisible]=useState(()=>{try{return localStorage.getItem("cc-chat-"+user.uid)==="true"}catch{return false}});
  useEffect(()=>{try{localStorage.setItem("cc-explorer-"+user.uid,String(explorerVisible));localStorage.setItem("cc-chat-"+user.uid,String(chatVisible))}catch{}},[explorerVisible,chatVisible,user.uid]);
  const [context,setContext]=useState(null);
  const [mode,setMode]=useState(()=>{try{return localStorage.getItem("cc-mode-"+user.uid)||"simple"}catch{return "simple"}});
  function changeMode(next){setMode(next);try{localStorage.setItem("cc-mode-"+user.uid,next)}catch{}}
  const [panels,setPanels]=useState(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem("cc-panel-widths-"+user.uid));
      if ([saved?.explorer,saved?.chat].every(n=>Number.isFinite(n)&&n>=12&&n<=30)) return saved;
    } catch {}
    return {explorer:18,chat:21};
  });
  useEffect(()=>{
    const timer=setTimeout(()=>{try{localStorage.setItem("cc-panel-widths-"+user.uid,JSON.stringify(panels))}catch{}},200);
    return ()=>clearTimeout(timer);
  },[panels]);
  const base = "projects/" + project,
    [active, A] = useState(()=>{try{return localStorage.getItem("cc-file-"+user.uid+"-"+project)||""}catch{return ""}}),
    [error, E] = useState(""),
    [count, L] = useState(30),
    [search, Q] = useState(""),
    [tabs, T] = useState([]),
    [folder, F] = useState("");
  const files = useRows(base + "/files"),
    chat = useRows(base + "/messages", "createdAt", count);
  useEffect(()=>{if(active)try{localStorage.setItem("cc-file-"+user.uid+"-"+project,active)}catch{}},[active,project,user.uid]);
  const file = files.rows?.find((f) => f.id === active) || files.rows?.[0];
  useEffect(() => {
    if (file) T((t) => (t.includes(file.id) ? t : [...t, file.id]));
  }, [file?.id]);
  async function run(fn) {
    try {
      E("");
      await fn();
    } catch (e) {
      E(e.message);
    }
  }
  return (
    <section className={"ide mode-"+mode+(!explorerVisible?" explorer-hidden":"")+(!chatVisible?" chat-hidden":"")} style={{"--explorer-width":panels.explorer+"%","--chat-width":panels.chat+"%"}}>
      <div className="ide-mode-toolbar"><a href="#" aria-label="CodeCollab home"><Brand/></a>
        <button title="Toggle Explorer" onClick={()=>setExplorerVisible(v=>!v)}><Files size={16}/></button>
        <button onClick={onExit}>Workspaces</button><strong>{file?.name || "Code workspace"}</strong>
        <div className="mode-segment" role="group" aria-label="Editor mode"><button aria-pressed={mode==="simple"} onClick={()=>changeMode("simple")}>Simple</button><button aria-pressed={mode==="pro"} onClick={()=>changeMode("pro")}>Pro</button></div>
        <button className="toolbar-run" onClick={e=>{const root=e.currentTarget.closest(".ide");root.querySelector(".worktools").open=true;root.querySelector(".worktools button[data-run]")?.click()}}>▶ Run</button>
        <button onClick={e=>e.currentTarget.closest(".ide").querySelector(".worktools [data-stop]")?.click()}>Stop</button>
        <button onClick={()=>window.dispatchEvent(new Event("codecollab-save"))}>Save</button>
        <button onClick={()=>{const section=document.querySelector(".content>details.project-settings");if(section){section.open=true;section.classList.add("workspace-drawer")}}}>Share / Settings</button>
        <button onClick={()=>setChatVisible(v=>!v)}>Chat</button>
        <button onClick={e=>{const tools=e.currentTarget.closest(".ide").querySelector(".worktools");tools.open=!tools.open}}>Output</button>
      </div>
      <nav className="activity-rail" aria-label="Editor navigation">
        <button
          aria-label="Focus file explorer"
          onClick={(e) =>
            e.currentTarget
              .closest(".ide")
              .querySelector("aside button")
              ?.focus()
          }
        >
          <Files />
        </button>
        <button
          aria-label="Search project files"
          onClick={(e) =>
            e.currentTarget
              .closest(".ide")
              .querySelector('[aria-label="Filter files"]')
              .focus()
          }
        >
          <Search />
        </button>
        <button
          aria-label="Open project chat"
          onClick={(e) => {
            const chat = e.currentTarget.closest(".ide").querySelector(".chat");
            chat.open = true;
            chat.querySelector("input").focus();
          }}
        >
          <MessageSquare />
        </button>
      </nav>
      <aside>
        <small>EXPLORER</small>
        <Folders
          project={project}
          current={folder}
          select={F}
          writable={writable}
          onError={E}
        />
        <input
          aria-label="Filter files"
          value={search}
          placeholder="Find file…"
          onChange={(e) => Q(e.target.value)}
        />
        {files.rows
          ?.filter((f) => search || (f.parent || "") === folder)
          .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
          .map((f) => (
            <button
              key={f.id}
              onContextMenu={e=>{e.preventDefault();A(f.id);setContext({x:Math.min(e.clientX,innerWidth-180),y:Math.min(e.clientY,innerHeight-140),file:f})}}
              aria-pressed={file?.id === f.id}
              onClick={() => A(f.id)}
            >
              {f.name}
            </button>
          ))}
        {writable && (
          <>
            <button
              onClick={() => {
                const name = prompt("New file path");
                if (name)
                  run(async () =>
                    A(
                      (
                        await addDoc(collection(db, base + "/files"), {
                          parent: folder,
                          name,
                          createdAt: serverTimestamp(),
                        })
                      ).id,
                    ),
                  );
              }}
            >
              + File
            </button>
            {file && (
              <button className="rename-file-action"
                onClick={() => {
                  const name = prompt("Rename file", file.name);
                  if (name)
                    run(() =>
                      updateDoc(doc(db, base + "/files/" + file.id), { name }),
                    );
                }}
              >
                Rename file
              </button>
            )}
            {file && (
              <button className="delete-file-action"
                onClick={() => {
                  if (
                    confirm(
                      "Delete this file? Create a project snapshot first to keep a recoverable copy.",
                    )
                  )
                    run(() =>
                      command({
                        action: "deleteFile",
                        id: project,
                        target: file.id,
                      }),
                    );
                }}
              >
                Delete file
              </button>
            )}
          </>
        )}
      </aside>
      <PanelDivider label="Explorer width" value={panels.explorer} onChange={explorer=>setPanels(p=>({...p,explorer}))}/>
      <div className="canvas">
        <nav aria-label="Open files">
          {tabs
            .map((id) => files.rows?.find((f) => f.id === id))
            .filter(Boolean)
            .map((f) => (
              <button
                key={f.id}
                aria-pressed={f.id === file?.id}
                onClick={() => A(f.id)}
              >
                {f.name}
              </button>
            ))}
        </nav>
        {file ? (
          <>
            <small>{file.name}</small>
            <Editor
              key={file.id}
              path={base + "/files/" + file.id}
              uid={user.uid}
              name={file.name}
              prefs={prefs}
              writable={writable}
            />
          </>
        ) : (
          <p>No files yet.</p>
        )}
      </div>
      <PanelDivider label="Chat width" value={panels.chat} reverse onChange={chat=>setPanels(p=>({...p,chat}))}/>
      <details className="chat" open>
        <summary>Project chat</summary>
        <div className="messages">
          {[...(chat.rows || [])].reverse().map((m) => (
            <p key={m.id}>
              <small>
                {m.uid === user.uid ? "You" : m.uid} ·{" "}
                {m.createdAt?.toDate().toLocaleTimeString()}
              </small>
              <br />
              {m.text}
            </p>
          ))}
        </div>
        {chat.rows?.length === count && (
          <button onClick={() => L(count + 30)}>Earlier messages</button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              text = form.message.value.trim();
            if (text)
              run(async () => {
                const button = form.querySelector("button");
                button.disabled = true;
                try {
                  await addDoc(collection(db, base + "/messages"), {
                    text,
                    uid: user.uid,
                    createdAt: serverTimestamp(),
                  });
                  form.reset();
                } finally {
                  button.disabled = false;
                }
              });
          }}
        >
          <input
            aria-label="Chat message"
            name="message"
            required
            maxLength={2000}
          />
          <button>Send</button>
        </form>
      </details>
      {context&&<div className="file-context" role="menu" style={{left:context.x,top:context.y}} onKeyDown={e=>{if(e.key==="Escape")setContext(null)}}>
        <button autoFocus role="menuitem" onClick={()=>{const name=prompt("Rename file",context.file.name);if(name)run(()=>updateDoc(doc(db,base+"/files/"+context.file.id),{name}));setContext(null)}}>Rename file</button>
        <button role="menuitem" onClick={()=>{setContext(null);document.querySelector(".ide aside .delete-file-action")?.click()}}>Delete file…</button>
        <button role="menuitem" onClick={()=>setContext(null)}>Close menu</button>
      </div>}
      <p role="alert">{error || files.error || chat.error}</p>
    </section>
  );
}

import "monaco-editor/esm/vs/basic-languages/java/java.contribution";
import "monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution";
import "monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution";
import "monaco-editor/esm/vs/basic-languages/go/go.contribution";
import "monaco-editor/esm/vs/basic-languages/rust/rust.contribution";
import "monaco-editor/esm/vs/basic-languages/php/php.contribution";
import "monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution";
