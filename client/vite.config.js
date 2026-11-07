import { defineConfig } from "vite";
export default defineConfig({
  worker: { format: "es" },
  resolve: { dedupe: ["yjs", "y-protocols", "lib0", "monaco-editor"] },
  optimizeDeps: {
    include: [
      "yjs",
      "y-monaco",
      "y-protocols/awareness",
      "lib0/encoding",
      "monaco-editor/esm/vs/editor/editor.api.js",
    ],
  },
});
