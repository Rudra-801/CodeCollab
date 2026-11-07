const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { WebSocketServer } = require("ws");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore(),
  server = http.createServer((req, res) => {
    res.end("CodeCollab presence");
  });
const sockets = new WebSocketServer({ server, maxPayload: 16384 });
sockets.on("connection", (socket) => {
  let initialized = false,
    record,
    unsubscribe,
    permission,
    expired,
    uid,
    project,
    file,
    client,
    ready = false,
    states = new Map();
  const deadline = setTimeout(() => socket.close(1008), 8000);
  let pending,
    writing = false,
    last = 0;
  async function flush() {
    if (writing || !pending || !ready) return;
    writing = true;
    const current = pending;
    pending = null;
    try {
      await record.set({
        client,
        uid,
        selection: current.selection,
        expiresAt: Timestamp.fromMillis(Date.now() + 45000),
      });
    } catch {
      socket.close(1011);
    } finally {
      writing = false;
    }
  }
  const interval = setInterval(flush, 250);
  socket.on("message", async (bytes) => {
    try {
      const m = JSON.parse(bytes.toString());
      if (!initialized) {
        initialized = true;
        if (
          ![m.project, m.file].every(
            (v) => typeof v === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(v),
          ) ||
          !Number.isSafeInteger(m.client) ||
          m.client < 0 ||
          m.client > 0xffffffff
        )
          throw Error();
        const token = await getAuth().verifyIdToken(m.token, true);
        uid = token.uid;
        client = m.client;
        project = db.doc("projects/" + m.project);
        file = project.collection("files").doc(m.file);
        const membership = project.collection("members").doc(uid);
        if (
          !(await membership.get()).exists ||
          !(await file.get()).exists ||
          socket.readyState !== 1
        )
          throw Error();
        clearTimeout(deadline);
        expired = setTimeout(
          () => socket.close(1008),
          Math.max(0, token.exp * 1000 - Date.now()),
        );
        const rows = file.collection("presence");
        record = rows.doc(randomUUID());
        permission = membership.onSnapshot(
          (s) => {
            if (!s.exists) socket.close(1008);
          },
          () => socket.close(1008),
        );
        unsubscribe = rows.onSnapshot(
          (s) => {
            states = new Map(s.docs.map((d) => [d.id, d.data()]));
            publish();
          },
          () => socket.close(1011),
        );
        ready = true;
        pending = { selection: null };
        socket.send(JSON.stringify({ ready: true }));
        return;
      }
      if (!ready || Date.now() - last < 40) return;
      last = Date.now();
      const selection = m.selection;
      if (
        selection != null &&
        (!selection.anchor ||
          !selection.head ||
          JSON.stringify(selection).length > 1500)
      )
        return;
      pending = { selection: selection || null };
    } catch {
      socket.close(1008);
    }
  });
  function publish() {
    if (ready && socket.readyState === 1)
      socket.send(
        JSON.stringify({
          peers: [...states.values()]
            .filter((r) => r.expiresAt.toMillis() > Date.now())
            .map(({ uid, client, selection }) => ({ uid, client, selection })),
        }),
      );
  }
  const heartbeat = setInterval(publish, 15000);
  socket.on("error", () => socket.close());
  socket.on("close", () => {
    ready = false;
    clearTimeout(deadline);
    clearTimeout(expired);
    clearInterval(interval);
    clearInterval(heartbeat);
    unsubscribe?.();
    permission?.();
    record?.delete().catch(() => {});
  });
});
server.listen(Number(process.env.PORT) || 8081);
