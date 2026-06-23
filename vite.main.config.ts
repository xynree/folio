import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // better-sqlite3 is a native Node.js addon and must not be bundled by Vite.
      // Electron loads it at runtime from node_modules.
      external: ["better-sqlite3"],
    },
  },
});
