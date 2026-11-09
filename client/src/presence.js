import {
  Awareness,
  applyAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import { auth } from "./firebase";
export function connectPresence(doc, path, onPeers) {
  const awareness = new Awareness(doc),
    clocks = new Map();
  let closed = false,
    socket,
    retry,
    ready = false;
  const [, project, , file] = path.split("/");
  function send() {
    if (ready && socket.readyState === 1)
      socket.send(
        JSON.stringify({
          selection: awareness.getLocalState()?.selection || null,
        }),
      );
  }
  let queued;
  function schedule(changes, origin) {
    if (origin === "remote") return;
    clearTimeout(queued);
    queued = setTimeout(send, 85);
  }
  async function connect() {
    try {
      const token = await auth.currentUser.getIdToken();
      if (closed) return;
      const endpoint=new URL(import.meta.env.VITE_PRESENCE_URL);
      if(endpoint.pathname==="/presence"){endpoint.searchParams.set("project",project);endpoint.searchParams.set("file",file);}
      socket = new WebSocket(endpoint);
      socket.onopen = () =>
        socket.send(
          JSON.stringify({ token, project, file, client: doc.clientID }),
        );
      socket.onmessage = ({ data }) => {
        const m = JSON.parse(data);
        if (m.ready) {
          ready = true;
          send();
          return;
        }
        if (!m.peers) return;
        const peers = m.peers.filter((p) => p.client !== doc.clientID),
          ids = new Set(peers.map((p) => p.client));
        removeAwarenessStates(
          awareness,
          [...awareness.getStates().keys()].filter(
            (id) => id !== doc.clientID && !ids.has(id),
          ),
          "remote",
        );
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, peers.length);
        for (const p of peers) {
          const n = (clocks.get(p.client) || 0) + 1;
          clocks.set(p.client, n);
          encoding.writeVarUint(encoder, p.client);
          encoding.writeVarUint(encoder, n);
          encoding.writeVarString(
            encoder,
            JSON.stringify({ selection: p.selection, user: { name: p.uid } }),
          );
        }
        applyAwarenessUpdate(
          awareness,
          encoding.toUint8Array(encoder),
          "remote",
        );
        onPeers([...new Set(m.peers.map((p) => p.uid))]);
      };
      socket.onclose = () => {
        ready = false;
        onPeers([]);
        if (!closed) retry = setTimeout(connect, 3000);
      };
    } catch {
      if (!closed) retry = setTimeout(connect, 3000);
    }
  }
  if (import.meta.env.VITE_PRESENCE_URL) connect();
  awareness.on("change", schedule);
  const heartbeat = setInterval(send, 15000);
  return {
    awareness,
    close() {
      closed = true;
      clearTimeout(retry);
      clearTimeout(queued);
      clearInterval(heartbeat);
      awareness.off("change", schedule);
      socket?.close();
      awareness.destroy();
    },
  };
}
