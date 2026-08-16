/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt", // never auto-reloads silently; app shows its own update prompt (see app/providers/PwaUpdateProvider)
      injectRegister: null, // we register the SW ourselves so we control the update-prompt UX
      workbox: {
        // Precache only the built app shell (JS/CSS/HTML/icons). Business data lives in
        // IndexedDB and must never be part of the service worker cache - see ARCHITECTURE.md §7.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        cleanupOutdatedCaches: true,
        clientsClaim: false, // do not take control immediately; avoids surprising an open tab mid-session
        skipWaiting: false // update is applied only when the user confirms via the update prompt
      },
      manifest: {
        name: "Plans",
        short_name: "Plans",
        description: "Georgian work-order, loading, and worker-tracking tool.",
        display: "standalone",
        background_color: "#f6f8f7",
        theme_color: "#1d3fa0",
        orientation: "portrait",
        lang: "ka",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      devOptions: {
        enabled: false // keep the SW out of the way during `npm run dev`
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src")
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"]
  }
});
