import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Owly — pain journal for kids who can't say it hurts",
        short_name: "Owly",
        description:
          "A private, on-device pain observation journal (FLACC) for children who can't self-report pain.",
        theme_color: "#f5f5f7",
        background_color: "#f5f5f7",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // ttf/otf covers the vendored Noto faces the PDF report embeds;
        // the SC subset (~4 MB) needs a raised per-file precache limit.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,ttf,otf}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: false,
    // Embedding/subsetting multi-script fonts is CPU-heavy.
    testTimeout: 30000,
  },
} as never);
