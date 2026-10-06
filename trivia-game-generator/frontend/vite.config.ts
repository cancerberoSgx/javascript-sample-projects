import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite rejects requests for unknown hostnames. Allow ngrok tunnels (readme.md "Play with friends over the
// internet") and any extra comma-separated hosts in VITE_ALLOWED_HOSTS (a leading "." allows subdomains).
const allowedHosts = [
  ".ngrok-free.app",
  ".ngrok-free.dev",
  ".ngrok.app",
  ".ngrok.dev",
  ".ngrok.io",
  ...(process.env.VITE_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean),
];

export default defineConfig({
  plugins: [react()],
  // `vite preview` reuses server.proxy and server.allowedHosts
  server: {
    allowedHosts,
    // The frontend calls /api/... on its own origin; Vite forwards it to the backend (no CORS needed).
    // docker-compose sets VITE_API_PROXY=http://backend:8000. ws: game WebSockets (/api/games/:id/ws) too.
    proxy: {
      "/api": { target: process.env.VITE_API_PROXY ?? "http://localhost:8000", ws: true },
      // Background images (rules.md BKG-8): static files the backend serves from MEDIA_DIR
      "/media": { target: process.env.VITE_API_PROXY ?? "http://localhost:8000" },
    },
  },
});
