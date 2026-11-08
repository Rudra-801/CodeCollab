import Landscape from "./Landscape";
import { Brand } from "./Landing";
import CreateWorkspace from "./CreateWorkspace";
import {
  LayoutDashboard,
  FolderCode,
  Users,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import Assets from "./Assets";
import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  updateDoc,
  query,
  limit,
  orderBy,
} from "firebase/firestore";
import { sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";
import { auth, db, command } from "./firebase";
const IDE = lazy(() => import("./IDE"));
export function useRows(path, sort, cap = 100) {
  const [state, S] = useState({});
  useEffect(() => {
    if (!path) return;
    let q = collection(db, path);
    q = sort
      ? query(q, orderBy(sort, "desc"), limit(cap))
      : query(q, limit(cap));
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (s) =>
        S({
          path,
          rows: s.docs
            .filter((d) => !d.metadata.hasPendingWrites)
            .map((d) => ({ ...d.data(), id: d.id })),
        }),
      (e) => S({ path, error: e.message }),
    );
  }, [path, sort, cap]);
  return state.path === path ? state : { rows: [] };
}
function Item({ path, role, open, search }) {
  const [row, R] = useState(null);
  useEffect(
    () =>
      onSnapshot(
        doc(db, path),
        (s) => R(s.data()),
        () => R(null),
      ),
    [path],
  );
  return row && row.name.toLowerCase().includes(search.toLowerCase()) ? (
    <button className="item" onClick={open}>
      <strong>
        <FolderCode size={16} /> {row.name}
      </strong>
      {row.updatedAt?.toDate && (
        <time>{row.updatedAt.toDate().toLocaleDateString()}</time>
      )}
      <small>
        {role} · {row.archived ? "Archived" : "Active"}
      </small>
    </button>
  ) : null;
}
export default function Dashboard({ user, logout }) {
  const [kind, K] = useState("projects"),
    [id, P] = useState(""),
    [search, Q] = useState(""),
    [filter, H] = useState("all"),
    [inviteToken, I] = useState(
      new URLSearchParams(location.search).get("invite") || "",
    ),
    [notice, N] = useState(""),
    [tab, T] = useState("work"),
    [prefs, F] = useState({
      name: "",
      minimap: false,
      theme: "vs-dark",
      notifications: true,
    });
  const notifications = useRows(
    "users/" + user.uid + "/notifications",
    "createdAt",
    30,
  );
  const index = useRows("users/" + user.uid + "/" + kind),
    base = id ? kind + "/" + id : null,
    members = useRows(base && base + "/members"),
    activity = useRows(base && base + "/activity", "createdAt", 15);
  const [resource, V] = useState(null),
    [code, C] = useState("");
  useEffect(() => {
    if (!base) return;
    V(null);
    return onSnapshot(
      doc(db, base),
      (s) => V(s.data()),
      (e) => {
        N(e.message);
        P("");
      },
    );
  }, [base]);
  useEffect(
    () =>
      onSnapshot(
        doc(db, "users", user.uid),
        (s) => {
          if (s.exists()) F(s.data());
        },
        (e) => N(e.message),
      ),
    [user.uid],
  );
  async function run(fn) {
    try {
      N("");
      await fn();
    } catch (e) {
      N(e.message);
    }
  }
  const act = (action, extra = {}) => command({ action, kind, id, ...extra });
  const teamProjects = useRows(
    kind === "teams" && base ? base + "/projects" : null,
  );
  const versions = useRows(
    kind === "projects" && base ? base + "/versions" : null,
    "createdAt",
    30,
  );
  const role = members.rows?.find((m) => m.uid === user.uid)?.role,
    admin = ["owner", "admin"].includes(role);
  const [creating, setCreating] = useState(false);
  function navigate(next, collection) {
    P("");
    T(next);
    if (collection) K(collection);
  }
  return (
    <div className={"app-layout" + (id && tab === "work" ? " editing" : "")}>
      <aside className="app-nav">
        <a href="#" onClick={() => navigate("work", "projects")}>
          <Brand />
        </a>
        <small>Workspace</small>
        <nav>
          {[
            [LayoutDashboard, "Dashboard", () => navigate("work", "projects")],
            [FolderCode, "Projects", () => navigate("work", "projects")],
            [Users, "Teams", () => navigate("work", "teams")],
            [Bell, "Notifications", () => T("notifications")],
            [Settings, "Settings", () => T("settings")],
          ].map(([Icon, label, go]) => (
            <button
              key={label}
              aria-current={
                (label === "Dashboard" &&
                  tab === "work" &&
                  kind === "projects" &&
                  !id) ||
                (label === "Teams" && tab === "work" && kind === "teams") ||
                label.toLowerCase() === tab
                  ? "page"
                  : undefined
              }
              onClick={go}
            >
              <Icon size={17} />
              {label}
              {label === "Notifications" && (
                <span>
                  ({notifications.rows?.filter((n) => !n.read).length || 0})
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="app-profile">
          <b>{(prefs.name || user.email || "U")[0].toUpperCase()}</b>
          <span>{prefs.name || user.email?.split("@")[0]}</span>
          <button aria-label="Log out" onClick={() => run(logout)}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="work-area"><div className="workspace-atmosphere" aria-hidden="true"><Landscape/></div>
        <div className="crumb">
          <span>Workspace</span>
          <ChevronRight size={13} />
          {tab === "work" ? kind : tab}
          {id && resource && tab === "work" && <> / {resource.name}</>}
        </div>
        {creating && (
          <CreateWorkspace
            kind={kind}
            close={() => setCreating(false)}
            create={async (name, template) => {
              const r = await act("create", { name, template });
              P(r.id);
            }}
          />
        )}
        <div role="alert">
          {notice || index.error || members.error || activity.error}
        </div>
        {tab === "notifications" ? (
          <main className="content">
            <small className="section-kicker">WORKSPACE UPDATES</small><h1>Notifications</h1><p className="page-description">Project activity and team updates, together in one place.</p>
            {notifications.rows?.length ? (
              notifications.rows.map((n) => (
                <p key={n.id}>
                  <button
                    onClick={() =>
                      run(async () => {
                        await updateDoc(
                          doc(
                            db,
                            "users/" + user.uid + "/notifications/" + n.id,
                          ),
                          { read: true },
                        );
                        K("projects");
                        P(n.project);
                        T("work");
                      })
                    }
                  >
                    {n.read ? "Read" : "Unread"} · Project message ·{" "}
                    {n.createdAt?.toDate().toLocaleString()}
                  </button>
                </p>
              ))
            ) : (
              <section className="notification-empty"><span aria-hidden="true">◇</span><h2>No notifications yet</h2><p>Your project and team updates will appear here.</p><button className="primary" onClick={()=>{T("work");K("projects");P("")}}>Browse Projects</button></section>
            )}
          </main>
        ) : tab === "settings" ? (
          <main className="content">
            <small className="section-kicker">ACCOUNT SETTINGS</small><h1>Settings</h1><p className="page-description">Manage your account, preferences and workspace experience.</p>
            <div className="settings-columns"><form className="preferences-panel"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await setDoc(doc(db, "users", user.uid), prefs);
                  N("Preferences saved.");
                });
              }}
            >
              <h2>Preferences</h2><p>Customize your workspace and editor experience.</p><label>
                Display name
                <input
                  value={prefs.name}
                  maxLength={80}
                  onChange={(e) => F({ ...prefs, name: e.target.value })}
                />
              </label>
              <label>
                Editor theme
                <select
                  value={prefs.theme}
                  onChange={(e) => F({ ...prefs, theme: e.target.value })}
                >
                  <option>vs-dark</option>
                  <option>hc-black</option>
                </select>
              </label>
              {["minimap", "notifications"].map((k) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={prefs[k]}
                    onChange={(e) => F({ ...prefs, [k]: e.target.checked })}
                  />
                  {k}
                </label>
              ))}
              <button>Save preferences</button>
            </form><div className="settings-account"><section className="settings-card"><h2>Account</h2><p>Your account and security settings.</p><p>{user.email}</p>
            {!user.emailVerified && (
              <button
                onClick={() =>
                  run(async () => {
                    await sendEmailVerification(user);
                    N("Verification email sent.");
                  })
                }
              >
                Send verification email
              </button>
            )}
            <button
              onClick={() =>
                run(async () => {
                  await sendPasswordResetEmail(auth, user.email);
                  N("Password reset requested.");
                })
              }
            >
              Reset password
            </button>
            </section><section className="settings-card"><h2>Sign-in Providers</h2><p>Manage how you sign in to CodeCollab.</p>{user.providerData.map(p=><div className="provider-row" key={p.providerId}><span>{p.providerId}</span><strong>Connected</strong></div>)}</section><section className="settings-card danger-card"><h2>Delete Account</h2><p>Permanently delete your account and associated data.</p>
            <button
              onClick={() => {
                if (confirm("Permanently delete your account and preferences?"))
                  run(async () => {
                    await command({ action: "deleteAccount" });
                    await logout();
                  });
              }}
            >
              Delete account
            </button></section><section className="settings-card"><h2>Profile image</h2><Assets uid={user.uid}/></section></div></div>
          </main>
        ) : !id ? (
          <main className="content">
            <small className="section-kicker">
              {kind === "teams" ? "TEAM WORKSPACES" : "PROJECT OVERVIEW"}
            </small>
            <h1>
              Welcome,{" "}
              {prefs.name || user.displayName || user.email?.split("@")[0]}
            </h1>
            <nav>
              {["projects", "teams"].map((k) => (
                <button aria-pressed={k === kind} key={k} onClick={() => K(k)}>
                  {k}
                </button>
              ))}
            </nav>
            <div className="summary-strip">
              {[
                [
                  FolderCode,
                  "Owned",
                  index.rows?.filter((r) => r.role === "owner").length,
                ],
                [
                  Users,
                  "Shared with me",
                  index.rows?.filter((r) => r.role !== "owner").length,
                ],
                [
                  Bell,
                  "Unread notifications",
                  notifications.rows?.filter((n) => !n.read).length,
                ],
              ].map(([Icon, label, value]) => (
                <div key={label}>
                  <Icon size={18} />
                  <span>
                    {value ?? "…"}
                    <small>{label}</small>
                  </span>
                </div>
              ))}
            </div>
            <section className="toolbar">
              <select
                aria-label="Workspace filter"
                value={filter}
                onChange={(e) => H(e.target.value)}
              >
                <option value="all">All workspaces</option>
                <option value="mine">My workspaces</option>
                <option value="shared">Shared with me</option>
              </select>
              {inviteToken && (
                <button
                  onClick={() =>
                    run(async () => {
                      const r = await act("join", { code: inviteToken });
                      I("");
                      history.replaceState(null, "", location.pathname);
                      K(r.kind);
                      P(r.id);
                    })
                  }
                >
                  Accept invitation
                </button>
              )}
              <input
                aria-label="Search by name"
                placeholder={"Search " + kind}
                value={search}
                onChange={(e) => Q(e.target.value)}
              />
              <button onClick={() => setCreating(true)} className="primary">
                Create {kind === "teams" ? "team" : "project"}
              </button>
              <button
                onClick={() => {
                  const code = prompt("Single-use invitation code");
                  if (code)
                    run(async () => {
                      await act("join", { code: code.trim() });
                      N("Invitation accepted.");
                    });
                }}
              >
                Join via invite
              </button>
            </section>
            <div className="list-label">
              <span>{kind === "teams" ? "Team" : "Project"} name</span>
              <span>Last modified</span>
              <span>Access</span>
            </div>
            <div className="grid">
              {index.rows
                ?.filter(
                  (row) =>
                    filter === "all" ||
                    (filter === "mine"
                      ? row.role === "owner"
                      : row.role !== "owner"),
                )
                .map((row) => (
                  <Item
                    key={row.id}
                    path={kind + "/" + row.id}
                    role={row.role}
                    open={() => {
                      C("");
                      P(row.id);
                    }}
                    search={search}
                  />
                ))}
            </div>
            {!index.rows?.length && <p>No {kind} yet.</p>}
          </main>
        ) : (
          resource && (
            <main className="content">
              <button onClick={() => P("")}>← Workspaces</button>
              <h2>{resource.name}</h2>
              {kind === "teams" && (
                <section>
                  <h3>Team projects</h3>
                  {teamProjects.rows?.map((p) => (
                    <Item
                      key={p.id}
                      path={"projects/" + p.id}
                      role={role}
                      search=""
                      open={() => {
                        K("projects");
                        P(p.id);
                      }}
                    />
                  ))}
                  {admin && (
                    <button
                      onClick={() => {
                        const name = prompt("Team project name");
                        if (name)
                          run(async () => {
                            const result = await act("createTeamProject", {
                              name,
                            });
                            K("projects");
                            P(result.id);
                          });
                      }}
                    >
                      Create team project
                    </button>
                  )}
                </section>
              )}
              {kind === "projects" && role && (
                <Suspense fallback={<p>Loading editor…</p>}>
                  <IDE
                    key={id}
                    onExit={()=>P("")}
                    project={id}
                    user={user}
                    prefs={prefs}
                    writable={!resource.archived && role !== "viewer"}
                  />
                </Suspense>
              )}
              {kind === "projects" && (
                <details className="project-assets"><summary>Project assets</summary><Assets
                  project={id}
                  writable={role !== "viewer" && !resource.archived}
                /></details>
              )}
              <details>
                <summary>Members and workspace settings</summary>
                {role === "owner" && (
                  <button
                    onClick={() => {
                      if (confirm("Delete this workspace for every member?"))
                        run(async () => {
                          await act("delete");
                          P("");
                        });
                    }}
                  >
                    Delete workspace
                  </button>
                )}
                <div className="toolbar">
                  {admin && (
                    <>
                      <button
                        onClick={() => {
                          const name = prompt("New name", resource.name);
                          if (name) run(() => act("rename", { name }));
                        }}
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Change archive status?"))
                            run(() =>
                              act(resource.archived ? "restore" : "archive"),
                            );
                        }}
                      >
                        {resource.archived ? "Restore" : "Archive"}
                      </button>
                      {["editor", "viewer"].map((role) => (
                        <button
                          key={role}
                          onClick={() =>
                            run(async () =>
                              C((await act("invite", { role })).code),
                            )
                          }
                        >
                          Invite {role}
                        </button>
                      ))}
                    </>
                  )}
                  {code && (
                    <p>
                      Invitation code <code>{code}</code>{" "}
                      <button
                        onClick={() =>
                          run(async () => {
                            await navigator.clipboard.writeText(
                              location.origin + "/?invite=" + code + "#login",
                            );
                            N("Invite link copied.");
                          })
                        }
                      >
                        Copy invite link
                      </button>{" "}
                      <button
                        onClick={() =>
                          run(async () => {
                            await act("revoke", { code });
                            C("");
                          })
                        }
                      >
                        Revoke
                      </button>
                    </p>
                  )}
                </div>
                {members.rows?.map((m) => (
                  <p key={m.id}>
                    {m.uid} · {m.role}{" "}
                    {role === "owner" && m.uid !== user.uid && (
                      <>
                        <select
                          value={m.role}
                          onChange={(e) =>
                            run(() =>
                              act("role", {
                                target: m.uid,
                                role: e.target.value,
                              }),
                            )
                          }
                        >
                          {["admin", "editor", "viewer"].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                        {["transfer", "remove"].map((action) => (
                          <button
                            key={action}
                            onClick={() => {
                              if (confirm(action + " membership?"))
                                run(() => act(action, { target: m.uid }));
                            }}
                          >
                            {action}
                          </button>
                        ))}
                      </>
                    )}
                  </p>
                ))}
                {role && role !== "owner" && (
                  <button
                    onClick={() => {
                      if (confirm("Leave this workspace?"))
                        run(async () => {
                          await act("leave");
                          P("");
                        });
                    }}
                  >
                    Leave workspace
                  </button>
                )}
              </details>
              {kind === "projects" && role !== "viewer" && (
                <details>
                  <summary>Version history</summary>
                  <button onClick={() => run(() => act("snapshot"))}>
                    Create snapshot
                  </button>
                  <button
                    onClick={() =>
                      run(async () => P((await act("duplicate")).id))
                    }
                  >
                    Duplicate project
                  </button>
                  {versions.rows?.map((v) => (
                    <p key={v.id}>
                      {v.createdAt?.toDate().toLocaleString()} · {v.fileCount}{" "}
                      files{" "}
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "Restore this version into a new private project?",
                            )
                          )
                            run(async () =>
                              P(
                                (await act("restoreVersion", { target: v.id }))
                                  .id,
                              ),
                            );
                        }}
                      >
                        Restore copy
                      </button>
                    </p>
                  ))}
                </details>
              )}
              <details>
                <summary>Recent activity</summary>
                {activity.rows?.map((a) => (
                  <p key={a.id}>
                    {a.action} · {a.uid} ·{" "}
                    {a.createdAt?.toDate().toLocaleString()}
                  </p>
                ))}
              </details>
            </main>
          )
        )}
      </div>
    </div>
  );
}
