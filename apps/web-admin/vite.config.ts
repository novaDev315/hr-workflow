import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/graphql": {
        // Local dev talks to a local backend by default; never point this at production.
        target: process.env.VITE_DEV_API_PROXY ?? "http://localhost:4001",
        changeOrigin: true,
      },
    },
  },
});
