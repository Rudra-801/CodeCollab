import Landscape from "./Landscape";
import Landing, { Brand } from "./Landing";
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
import "./product.css";
const Playground = lazy(() => import("./Playground"));
const Dashboard = lazy(() => import("./Dashboard"));
const modes = ["login", "register", "forgot"];
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
    <div className="auth-stage"><div className="workspace-atmosphere" aria-hidden="true"><Landscape/></div>
      <main className="account">
        <a href="/">
          <Brand />
        </a>
        <h2>{mode === "register" ? <>Create your <em>account</em></> : title}</h2>
        <p className="auth-desc">
          {
            {
              login: "Sign in to your collaborative workspace.",
              register: "Create your CodeCollab workspace account.",
              forgot: "Request a secure password-reset link.",
              resetPassword: "Choose a new password for your account.",
              verifyEmail: "Confirm your account email address.",
            }[mode]
          }
        </p>{" "}
        {["login", "register"].includes(mode) && (
          <button
            disabled={busy}
            onClick={() =>
              run(() => signInWithPopup(auth, new GoogleAuthProvider()))
            }
          >
            <span className="google-letter" aria-hidden="true">
              G
            </span>{" "}
            Continue with Google
          </button>
        )}
        {["login", "register"].includes(mode) && (
          <div className="or-line">or</div>
        )}
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
              <input required placeholder="Enter your email" type="email" name="email" autoComplete="email" />
            </label>
          )}
          {["register", "login", "resetPassword"].includes(mode) && (
            <>
              <label>
                Password
                <input
                  required
                  name="password"
                  placeholder={mode==="login" ? "Enter your password" : "Create a strong password"}
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
            <small>
              Use at least eight characters and a unique passphrase.
            </small>
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
        <p role="alert">{error}</p>
        <p role="status">{info}</p>
        <nav>
          <a href={code ? "/#login" : location.search + "#login"}>Login</a>
          <a href={location.search + "#register"}>Register</a>
          <a href="/#forgot">Forgot password?</a>
        </nav>
      </main>
    </div>
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
  useEffect(()=>{if(user&&["login","register"].includes(route)&&sessionStorage.getItem("cc-playground-resume")==="yes"){sessionStorage.removeItem("cc-playground-resume");location.hash="playground"}},[user,route]);
  if (new URLSearchParams(location.search).has("oobCode"))
    return <Account route={route} />;
  if (route.split("?")[0] === "playground")
    return (
      <Suspense fallback={<main>Loading playground…</main>}>
        <Playground user={user}/>
      </Suspense>
    );
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


