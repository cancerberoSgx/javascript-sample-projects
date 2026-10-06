import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // The frontend calls /api/... on its own origin; Vite forwards it to the backend (no CORS needed).
    // docker-compose sets VITE_API_PROXY=http://backend:8000. ws: game WebSockets (/api/games/:id/ws) too.
    proxy: {
      "/api": { target: process.env.VITE_API_PROXY ?? "http://localhost:8000", ws: true },
      // Background images (rules.md BKG-8): static files the backend serves from MEDIA_DIR
      "/media": { target: process.env.VITE_API_PROXY ?? "http://localhost:8000" },
    },
  },
});
