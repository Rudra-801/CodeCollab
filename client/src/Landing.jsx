import React, { useState } from "react";
import {
  Braces,
  ArrowUpRight,
  ArrowRight,
  Play,
  Files,
  GitBranch,
  FolderOpen,
  FileCode2,
  ChevronDown,
  MessageSquare,
  Users,
  PanelLeft,
  Terminal,
  ShieldCheck,
  History,
  Layers,
  Code2,
  Check,
  Menu,
  X,
  BookOpen,
} from "lucide-react";
export function Brand() {
  return (
    <span className="cc-brand">
      <span className="cc-mark">
        <Braces size={19} />
      </span>
      CodeCollab
    </span>
  );
}
const samples = {
  "main.cpp": [
    "#include <iostream>",
    "#include <vector>",
    "#include <string>",
    "",
    "int main() {",
    "  std::vector<std::string> team = {",
    '    "Ada", "Kai", "Mira"',
    "  };",
    "  for (const auto& dev : team) {",
    '    std::cout << "Hello, " << dev;',
    "  }",
    "  return 0;",
    "}",
  ],
  "utils.hpp": [
    "#pragma once",
    "#include <string>",
    "",
    "namespace workspace {",
    "  std::string greet(std::string name) {",
    '    return "Hello, " + name;',
    "  }",
    "}",
  ],
  "README.md": [
    "# Orbit workspace",
    "",
    "A small C++ collaboration example.",
    "",
    "## Files",
    "- main.cpp",
    "- utils.hpp",
  ],
};
function Highlight({ line }) {
  return line
    .split(
      /("[^"]*"|<[^>]+>|#\w+|\b(?:int|for|const|auto|return|namespace|std|string|vector)\b)/g,
    )
    .map((v, i) => (
      <span
        className={
          v[0] === '"' || v[0] === "<"
            ? "str"
            : /^(#|int$|for$|const$|auto$|return$|namespace$)/.test(v)
              ? "kw"
              : /^(std|string|vector)$/.test(v)
                ? "type"
                : ""
        }
        key={i}
      >
        {v}
      </span>
    ));
}
function StudioPreview() {
  const [file, F] = useState("main.cpp");
  return (
    <div className="preview-stage">
      <div className="studio">
        <div className="studio-head">
          <span className="lights">
            <i />
            <i />
            <i />
          </span>
          <span>orbit / workspace</span>
          <span className="studio-live">
            <span
              className="mini-avatars"
              aria-label="Demo collaborators: Ada, Kai, Mira"
            >
              <b>A</b>
              <b>K</b>
              <b>M</b>
            </span>
            3 online · Demo
          </span>
        </div>
        <div className="studio-body">
          <div className="studio-rail">
            <Files />
            <GitBranch />
            <MessageSquare />
            <Users />
          </div>
          <aside>
            <small>EXPLORER</small>
            <div>
              <ChevronDown /> orbit
            </div>
            <div>
              <FolderOpen /> src
            </div>
            {Object.keys(samples).map((name) => (
              <button
                key={name}
                aria-pressed={file === name}
                onClick={() => F(name)}
              >
                <FileCode2 />
                {name}
              </button>
            ))}
          </aside>
          <div className="studio-code">
            <div className="studio-tab">
              <Code2 />
              {file}
            </div>
            <div className="code-lines">
              {samples[file].map((line, i) => (
                <div key={i}>
                  <i>{i + 1}</i>
                  <code>
                    <Highlight line={line} />
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="studio-status">
          <GitBranch /> main{" "}
          <span>UTF-8　{file.endsWith(".md") ? "Markdown" : "C++"}</span>
        </div>
      </div>
      <div className="chat-note">
        <b>AK</b>
        <span>
          <strong>Ada</strong> <small>Sample chat</small>
          <br />
          Ready for a second pair of eyes?
        </span>
      </div>
    </div>
  );
}
const features = [
  [
    Users,
    "Real-time collaboration",
    "Edit a shared file together and follow selections as they move.",
  ],
  [
    Terminal,
    "Code execution",
    "Run Python, JavaScript and TypeScript with input, output and cancellation.",
  ],
  [
    Layers,
    "Multi-file workspaces",
    "Organize files and folders, switch tabs and pick up where you left off.",
  ],
  [
    History,
    "Version history",
    "Save a project snapshot and recover it into a separate workspace.",
  ],
];
export default function Landing() {
  const [menu, M] = useState(false);
  return (
    <div className="front">
      <header className="front-header">
        <a href="#" aria-label="CodeCollab home">
          <Brand />
        </a>
        <nav className={menu ? "expanded" : ""}>
          <a href="#features">Features</a>
          <a href="#solutions">Solutions</a>
          <a href="https://github.com/Rudra-801/CodeCollab#readme">
            Documentation
          </a>
        </nav>
        <div className="nav-actions">
          <a className="outline" href="#login">
            Sign in
          </a>
          <a className="primary" href="#register">
            Get started <ArrowUpRight />
          </a>
          <button
            className="mobile-menu"
            aria-label="Toggle navigation"
            aria-expanded={menu}
            onClick={() => M(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main>
        <section className="hero-scene">
          <div className="aurora a1" />
          <div className="aurora a2" />
          <div className="hero-inner">
            <div className="hero-copy">
              <small>
                <i /> Collaborative development
              </small>
              <h1>
                Code Together.
                <br />
                <em>Build Faster.</em>
              </h1>
              <p>
                A real-time coding workspace for teams, students, and
                developers. Create projects, write code together, and run it in
                your browser.
              </p>
              <div className="hero-actions">
                <a href="#register" className="primary">
                  Get started free <ArrowRight />
                </a>
                <a href="#playground" className="outline">
                  <Play /> Live demo
                </a>
              </div>
            </div>
            <StudioPreview />
          </div>
          <div className="capabilities">
            {[
              [Users, "Real-time collaboration"],
              [Terminal, "Browser compiler"],
              [Layers, "Cloud workspaces"],
              [ShieldCheck, "Team permissions"],
            ].map(([Icon, text]) => (
              <span key={text}>
                <Icon />
                {text}
              </span>
            ))}
          </div>
        </section>
        <section id="features" className="feature-section">
          <div>
            <small>Inside the workspace</small>
            <h2>Built for working together.</h2>
          </div>
          <div className="feature-list">
            {features.map(([Icon, title, copy]) => (
              <article key={title}>
                <Icon />
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section id="solutions" className="solution">
          <div>
            <small>Teams & classrooms</small>
            <h2>Start with a shared project.</h2>
            <p>
              Invite an editor to pair with you, or give a reviewer read-only
              access.
            </p>
          </div>
          <a href="#register" className="primary">
            Create a workspace <ArrowRight />
          </a>
        </section>
      </main>
      <footer>
        <Brand />
        <nav>
          <a href="#playground">Playground</a>
          <a href="https://github.com/Rudra-801/CodeCollab">
            GitHub <ArrowUpRight size={14} />
          </a>
          <a href="#login">Sign in</a>
        </nav>
      </footer>
    </div>
  );
}
