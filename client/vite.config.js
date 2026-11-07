import { defineConfig } from "vite";
export default defineConfig({
  plugins: [{
    name: "codecollab-release",
    transformIndexHtml() {
      const commit = process.env.CODECOLLAB_RELEASE;
      return /^[a-f0-9]{40}$/.test(commit || "") ? [{tag:"meta",attrs:{name:"codecollab-release",content:commit},injectTo:"head"}] : [];
    }
  }],
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

