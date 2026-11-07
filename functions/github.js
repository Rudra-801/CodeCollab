const crypto = require("node:crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const Y = require("yjs");
const fail = (code, message) => {
  throw new HttpsError(code, message);
};
function seal(value, key) {
  const nonce = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  return Buffer.concat([
    nonce,
    cipher.update(value, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
function open(value, key) {
  const buf = Buffer.from(value, "base64"),
    dec = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  dec.setAuthTag(buf.subarray(-16));
  return Buffer.concat([
    dec.update(buf.subarray(12, -16)),
    dec.final(),
  ]).toString("utf8");
}
async function request(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(12000),
    headers: {
      Accept: "application/json",
      "User-Agent": "CodeCollab",
      ...options.headers,
    },
  });
  if (!r.ok)
    fail(
      r.status === 409 || r.status === 422 ? "aborted" : "failed-precondition",
      "GitHub rejected the request (HTTP " +
        r.status +
        "). Check repository permissions and pull the latest revision.",
    );
  return r.status === 204 ? {} : r.json();
}
function validateFilePath(value) {
  return (
    typeof value === "string" &&
    value.length <= 220 &&
    value
      .split("/")
      .every(
        (s) =>
          /^[\w. @()+-]{1,100}$/.test(s) &&
          s !== "." &&
          s !== ".." &&
          s.toLowerCase() !== ".git",
      )
  );
}
exports.github = onCall(
  { maxInstances: 4, timeoutSeconds: 60,secrets: process.env.CODECOLLAB_ENABLE_GITHUB==="true"?["GITHUB_APP_CLIENT_SECRET","GITHUB_TOKEN_KEY"]:[] },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) fail("unauthenticated", "Sign in first.");
    await getAuth().verifyIdToken(
      req.rawRequest.headers.authorization.slice(7),
      true,
    );
    const {
      action,
      repo,
      path,
      branch = "main",
      project,
      file,
      sha,
      message,
      source,
    } = req.data || {};
    const db = getFirestore(),
      ref = db.doc("githubConnections/" + uid),
      client = process.env.GITHUB_APP_CLIENT_ID,
      key = Buffer.from(process.env.GITHUB_TOKEN_KEY || "", "base64");
    if (!client || key.length !== 32 || !process.env.GITHUB_APP_CLIENT_SECRET)
      fail("failed-precondition", "GitHub App is unconfigured.");
    const snapshot = await ref.get(),
      row = snapshot.data() || {};
    if (action === "status")
      return { connected: !!row.token && row.expiresAt > Date.now() };
    if (action === "connect") {
      const device = await request("https://github.com/login/device/code", {
        method: "POST",
        body: new URLSearchParams({ client_id: client }),
      });
      if (!device.device_code || !device.user_code)
        fail("failed-precondition", "Enable device flow for the GitHub App.");
      const session = crypto.randomUUID();
      await ref.set(
        {
          session,
          device: seal(device.device_code, key),
          deviceExpires: Date.now() + device.expires_in * 1000,
          interval: device.interval || 5,
          nextPoll: 0,
        },
        { merge: true },
      );
      return {
        code: device.user_code,
        url: "https://github.com/login/device",
        session,
      };
    }
    if (action === "finish") {
      await db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (
          s.get("session") !== req.data.session ||
          !s.get("device") ||
          s.get("deviceExpires") <= Date.now()
        )
          fail("failed-precondition", "Connection request expired.");
        if (s.get("nextPoll") > Date.now())
          fail("resource-exhausted", "Wait before checking authorization.");
        tx.update(ref, { nextPoll: Date.now() + 1000 * s.get("interval") });
      });
      const result = await request(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          body: new URLSearchParams({
            client_id: client,
            device_code: open(row.device, key),
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          }),
        },
      );
      if (!result.access_token)
        fail(
          "failed-precondition",
          result.error === "authorization_pending"
            ? "Approve the code at GitHub first."
            : "GitHub authorization is incomplete.",
        );
      await db.runTransaction(async (tx) => {
        if ((await tx.get(ref)).get("session") !== req.data.session)
          fail("aborted", "Connection changed.");
        tx.set(ref, {
          token: seal(result.access_token, key),
          expiresAt: Date.now() + 1000 * (result.expires_in || 28800),
        });
      });
      return { connected: true };
    }
    if (!row.token || row.expiresAt <= Date.now())
      fail("unauthenticated", "Connect GitHub again.");
    const token = open(row.token, key),
      headers = {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };
    if (action === "disconnect") {
      await request(
        "https://api.github.com/applications/" + client + "/token",
        {
          method: "DELETE",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(
                client + ":" + process.env.GITHUB_APP_CLIENT_SECRET,
              ).toString("base64"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ access_token: token }),
        },
      );
      await ref.delete();
      return {};
    }
    if (
      typeof repo !== "string" ||
      !/^[-\w.]+\/[-\w.]+$/.test(repo) ||
      repo.split("/").some((s) => s === "." || s === "..") ||
      typeof branch !== "string" ||
      !branch.length ||
      branch.length > 160
    )
      fail("invalid-argument", "Enter owner/repository and branch.");
    if (typeof project !== "string" || !/^[-\w]{1,128}$/.test(project))
      fail("invalid-argument", "Invalid project.");
    const projectRef = db.doc("projects/" + project),
      member = projectRef.collection("members").doc(uid);
    async function access(tx, write) {
      const [m, p] = await Promise.all([
        tx ? tx.get(member) : member.get(),
        tx ? tx.get(projectRef) : projectRef.get(),
      ]);
      if (
        !m.exists ||
        !p.exists ||
        (write && (p.get("archived") || m.get("role") === "viewer"))
      )
        fail("permission-denied", "Workspace access denied.");
    }
    await access(null, action === "import" || action === "push");
    if (path !== "" && !validateFilePath(path))
      fail("invalid-argument", "Invalid repository path.");
    const url =
      "https://api.github.com/repos/" +
      repo +
      "/contents/" +
      path.split("/").map(encodeURIComponent).join("/");
    if (action === "push") {
      if (
        !/^[a-f0-9]{40}$/.test(sha) ||
        typeof source !== "string" ||
        Buffer.byteLength(source) > 65536 ||
        typeof message !== "string" ||
        !message.trim() ||
        message.length > 180
      )
        fail(
          "invalid-argument",
          "Review the remote revision and provide a commit message.",
        );
      const r = await request(url, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          branch,
          sha,
          message,
          content: Buffer.from(source).toString("base64"),
        }),
      });
      return { commit: r.commit.sha, sha: r.content.sha };
    }
    const result = await request(url + "?ref=" + encodeURIComponent(branch), {
      headers,
    });
    if (Array.isArray(result))
      return {
        entries: result
          .filter((f) => ["dir", "file"].includes(f.type))
          .slice(0, 200)
          .map(({ path, type }) => ({ path, type })),
      };
    if (
      result.type !== "file" ||
      result.encoding !== "base64" ||
      result.size > 65536
    )
      fail("invalid-argument", "Choose a text file of at most 64 KiB.");
    const bytes = Buffer.from(result.content, "base64");
    let content;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      fail("invalid-argument", "Choose a UTF-8 text file.");
    }
    if (action === "read") return { content, sha: result.sha };
    if (action !== "import") fail("invalid-argument", "Unsupported operation.");
    const doc = new Y.Doc();
    doc.getText("content").insert(0, content);
    const update = Buffer.from(Y.encodeStateAsUpdate(doc));
    doc.destroy();
    const entry = projectRef.collection("files").doc();
    await db.runTransaction(async (tx) => {
      await access(tx, true);
      tx.create(entry, {
        name: path.slice(0, 160),
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.create(entry.collection("updates").doc(), {
        bytes: update,
        uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.create(projectRef.collection("activity").doc(), {
        action: "github-import",
        uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return { id: entry.id };
  },
);

