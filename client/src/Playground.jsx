import React, { useState } from "react";
import BrowserRun from "./BrowserRun";
const templates = {
  javascript:
    'const name = readline() || "team";\nconsole.log("Hello, " + name + "!");',
  typescript:
    'const name: string = readline() || "team";\nconsole.log("Hello, " + name + "!");',
};
export default function Playground() {
  const [language, L] = useState("javascript"),
    [docs, D] = useState(templates);
  return (
    <main className="content">
      <a href="#">← CodeCollab</a>
      <h1>Code playground</h1>
      <label>
        Language
        <select value={language} onChange={(e) => L(e.target.value)}>
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
        </select>
      </label>
      <label>
        Source code
        <textarea
          className="demo-source"
          spellCheck={false}
          value={docs[language]}
          onChange={(e) => D({ ...docs, [language]: e.target.value })}
        />
      </label>
      <BrowserRun
        key={language}
        source={() => docs[language]}
        language={language}
      />
    </main>
  );
}
