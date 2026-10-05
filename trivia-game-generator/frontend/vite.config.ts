import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // The frontend calls /api/... on its own origin; Vite forwards it to the backend (no CORS needed).
    // docker-compose sets VITE_API_PROXY=http://backend:8000.
    proxy: {
      "/api": process.env.VITE_API_PROXY ?? "http://localhost:8000",
    },
  },
});
