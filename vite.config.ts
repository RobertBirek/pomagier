import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /\/api\/(health|company)/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "api-cache", expiration: { maxAgeSeconds: 300 } },
          },
          {
            urlPattern: /\/api\/.*/,
            handler: "NetworkFirst",
            options: { cacheName: "api-dynamic", networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  resolve: { tsconfigPaths: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("@tanstack")) return "vendor-react";
            if (id.includes("@radix-ui")) return "vendor-radix";
            if (id.includes("zod") || id.includes("date-fns") || id.includes("lucide"))
              return "vendor-utils";
          }
        },
      },
    },
  },
  server: {
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: true } },
    allowedHosts: ["pomagier.local", "localhost", ".local"],
  },
});
