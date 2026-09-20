import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const authMode = env.VITE_AUTH_MODE ?? (command === "serve" ? "local" : "");
  if (!["local", "personal"].includes(authMode)) throw new Error("Set VITE_AUTH_MODE explicitly to local or personal.");
  if (authMode === "personal") {
    let url: URL;
    try { url = new URL(env.VITE_API_BASE_URL); } catch { throw new Error("Personal mode requires VITE_API_BASE_URL=https://<api-host>/api"); }
    if (url.protocol !== "https:" || url.pathname !== "/api" || url.search || url.hash || url.username || url.password) {
      throw new Error("Personal mode requires an HTTPS API URL ending in /api without credentials, query, or fragment.");
    }
  }
  return {
  define: { "import.meta.env.VITE_AUTH_MODE": JSON.stringify(authMode) },
  plugins: [react()],
  server: {
    port: 5173,
  },
  };
});
