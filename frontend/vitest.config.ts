import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_AUTH_MODE": JSON.stringify("personal"),
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify("https://api.example.invalid/api"),
  },
  test: { environment: "jsdom", restoreMocks: true, clearMocks: true },
});
