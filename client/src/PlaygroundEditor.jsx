import React, { useEffect, useRef } from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import Worker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution";
import "monaco-editor/esm/vs/editor/contrib/find/browser/findController";

globalThis.MonacoEnvironment ??= { getWorker: () => new Worker() };

export default function PlaygroundEditor({ language, value, onChange }) {
  const container = useRef(null);
  const model = useRef(null);
  const latest = useRef({value, onChange});
  latest.current = {value, onChange};
  useEffect(() => {
    const document = monaco.editor.createModel(latest.current.value, language);
    model.current = document;
    const editor = monaco.editor.create(container.current, {
      model: document, ariaLabel: "Source code", theme: "vs-dark",
      automaticLayout: true, minimap: {enabled: false}, fontSize: 14,
      lineNumbersMinChars: 3, wordWrap: "on", scrollBeyondLastLine: false,
      padding: {top: 14}, fixedOverflowWidgets: true
    });
    const listener = document.onDidChangeContent(() => latest.current.onChange(document.getValue()));
    return () => {listener.dispose(); editor.dispose(); document.dispose(); model.current = null;};
  }, [language]);
  useEffect(() => {
    if (model.current && model.current.getValue() !== value) model.current.setValue(value);
  }, [value]);
  return <div className="pg-monaco" ref={container}/>;
}
