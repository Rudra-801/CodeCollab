import React, { useEffect, useState, lazy, Suspense } from "react";
import {
  onIdTokenChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, configured } from "./firebase";
import "./workspace.css";
const Dashboard = lazy(() => import("./Dashboard"));
const modes = ["login", "register", "forgot"];
function Landing() {
  return (
    <>
      <header>
        <a href="#">
          CodeCollab<span> ·</span>
        </a>
        <nav>
          <a href="#features">Features</a>
          <a href="#solutions">Solutions</a>
          <a href="#docs">Documentation</a>
          <a href="#login">Login</a>
          <a className="button" href="#register">
            Get Started
          </a>
        </nav>
      </header>
      <main className="intro">
        <section>
          <small>REAL-TIME DEVELOPMENT</small>
          <h1>
            Code Together.
            <br />
            <em>Build Faster.</em>
          </h1>
          <p>
            A real-time collaborative coding workspace for developers, students,
            and engineering teams.
          </p>
          <a className="button" href="#register">
            Get Started Free
          </a>{" "}
          <a href="#demo">View Demo ↓</a>
        </section>
        <article id="demo">
          <aside>
            EXPLORER
            <br />
            <br />⌄ workspace
            <br />　 main.js
          </aside>
          <div>
            <small>main.js · Editor preview</small>
            <pre>
              <b>export function</b> collaborate(team) {"{"}
              <br />　<strong>return</strong> team.map(member =&gt;
              <br />
              　　 member.contribute()
              <br />
              　);
              <br />
              {"}"}
            </pre>
          </div>
        </article>
      </main>
      <section className="details" id="features">
        <h2>One shared workspace</h2>
        <p>
          Edit together in Monaco, organize files and keep project discussions
          beside the code.
        </p>
        <h2 id="solutions">For teams and classrooms</h2>
        <p>
          Invite collaborators as editors or viewers. Owners manage access to
          their workspace.
        </p>
        <h2 id="docs">Getting started</h2>
        <p>
          Create an account, create a project, then add a file. Use Invite to
          share a single-use workspace code.
        </p>
        <a className="button" href="#register">
          Create your workspace
        </a>
      </section>
      <footer>CodeCollab</footer>
    </>
  );
}
function Account({ route }) {
  const params = new URLSearchParams(location.search),
    code = params.get("oobCode"),
    mode = params.get("mode") || route;
  const [error, E] = useState(""),
    [info, I] = useState(""),
    [busy, B] = useState(false),
    [show, S] = useState(false),
    [ready, R] = useState(!code),
    [until, U] = useState(0);
  useEffect(() => {
    if (!code || !auth) return;
    let active = true;
    const check =
      mode === "resetPassword"
        ? verifyPasswordResetCode(auth, code)
        : mode === "verifyEmail"
          ? applyActionCode(auth, code)
          : Promise.reject();
    check
      .then(() => {
        if (active) {
          R(true);
          if (mode === "verifyEmail") I("Email verified. Continue to sign in.");
        }
      })
      .catch(() => {
        if (active)
          E("This link is invalid or has expired. Request a fresh email.");
      });
    return () => {
      active = false;
    };
  }, [code, mode]);
  useEffect(() => {
    if (until) {
      const timer = setTimeout(() => U(0), Math.max(0, until - Date.now()));
      return () => clearTimeout(timer);
    }
  }, [until]);
  async function run(fn) {
    B(true);
    E("");
    try {
      if (!configured)
        throw Error(
          "Firebase configuration is required for this installation.",
        );
      await fn();
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  const title = {
    login: "Welcome back",
    register: "Create your account",
    forgot: "Recover your account",
    resetPassword: "Choose a new password",
    verifyEmail: "Verify your email",
  }[mode];
  return (
    <main className="account">
      <a href="/">CodeCollab</a>
      <h2>{title}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const { email, password, confirmation } = Object.fromEntries(
            new FormData(e.currentTarget),
          );
          run(async () => {
            if (mode === "forgot") {
              try {
                await sendPasswordResetEmail(auth, email);
              } catch (e) {
                if (e.code !== "auth/user-not-found") throw e;
              }
              I(
                "If the address is registered, a reset link will arrive by email.",
              );
              U(Date.now() + 60000);
            } else if (mode === "resetPassword") {
              if (password !== confirmation)
                throw Error("Passwords must match.");
              await confirmPasswordReset(auth, code, password);
              location.replace("/#login");
            } else if (mode === "register") {
              const credential = await createUserWithEmailAndPassword(
                auth,
                email,
                password,
              );
              await sendEmailVerification(credential.user);
            } else await signInWithEmailAndPassword(auth, email, password);
          });
        }}
      >
        {modes.includes(mode) && (
          <label>
            Email
            <input required type="email" name="email" autoComplete="email" />
          </label>
        )}
        {["register", "login", "resetPassword"].includes(mode) && (
          <>
            <label>
              Password
              <input
                required
                name="password"
                type={show ? "text" : "password"}
                minLength={mode === "login" ? 1 : 8}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={show}
                onChange={(e) => S(e.target.checked)}
              />{" "}
              Show password
            </label>
          </>
        )}
        {mode === "resetPassword" && (
          <label>
            Confirm password
            <input
              required
              type={show ? "text" : "password"}
              name="confirmation"
            />
          </label>
        )}
        {["register", "resetPassword"].includes(mode) && (
          <small>Use at least eight characters and a unique passphrase.</small>
        )}
        {mode !== "verifyEmail" && (
          <button disabled={busy || !ready || !!until}>
            {busy
              ? "Working…"
              : mode === "forgot"
                ? "Send reset link"
                : "Continue"}
          </button>
        )}
      </form>
      {modes.includes(mode) && (
        <button
          disabled={busy}
          onClick={() =>
            run(() => signInWithPopup(auth, new GoogleAuthProvider()))
          }
        >
          Continue with Google
        </button>
      )}
      <p role="alert">{error}</p>
      <p role="status">{info}</p>
      <nav>
        <a href="/#login">Login</a>
        <a href="/#register">Register</a>
        <a href="/#forgot">Forgot password?</a>
      </nav>
    </main>
  );
}
export default function Workspace() {
  const [user, U] = useState(undefined),
    [route, R] = useState(location.hash.slice(1));
  useEffect(() => {
    const change = () => R(location.hash.slice(1));
    window.addEventListener("hashchange", change);
    const unsub = auth ? onIdTokenChanged(auth, U) : null;
    if (!auth) U(null);
    return () => {
      unsub?.();
      window.removeEventListener("hashchange", change);
    };
  }, []);
  if (new URLSearchParams(location.search).has("oobCode"))
    return <Account route={route} />;
  if (user === undefined) return <main>Loading workspace…</main>;
  if (user)
    return (
      <Suspense fallback={<main>Loading projects…</main>}>
        <Dashboard user={user} logout={() => signOut(auth)} />
      </Suspense>
    );
  return modes.includes(route) ? (
    <Account key={route} route={route} />
  ) : (
    <Landing />
  );
}
