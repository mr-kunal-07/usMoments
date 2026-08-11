import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    // Increase chunk size warning limit (many icon imports are expected)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split vendor code into separate chunks for better long-term caching
        manualChunks: {
          // React core — changes least often → cached longest
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Supabase client
          "vendor-supabase": ["@supabase/supabase-js"],
          // Data fetching
          "vendor-query": ["@tanstack/react-query"],
          // UI — Radix primitives (large but stable)
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-popover",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-switch",
          ],
          // Charts (recharts) — loaded only on admin/analytics views
          // Map (leaflet) — loaded only on travel map view
          "vendor-map": ["leaflet"],
          // Animation
          "vendor-motion": ["framer-motion"],
          // Utilities
          "vendor-utils": ["date-fns", "clsx", "tailwind-merge", "class-variance-authority"],
        },
      },
    },
    // Enable source maps in production for error monitoring
    sourcemap: false,
    // Minify aggressively
    minify: "esbuild",
    target: "es2020",
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-icon-192.png", "pwa-icon-512.png"],
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/],
        // Inject push SW handler into the generated service worker
        importScripts: ["/push-sw.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Limit cache size to prevent stale bloat on mobile devices
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "script" || request.destination === "style",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-assets-cache",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "local-image-cache",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts — cache long-term (fonts don't change)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Storage media (images/videos/audio) — cache aggressively client-side
            // Reduces Supabase egress bandwidth significantly at scale
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-media-cache",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
              },
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200, 206] },
            },
          },
          {
            // Supabase REST API — NetworkFirst with short TTL
            // Falls back to cache when offline or slow
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 5 },
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase Auth endpoints — always network (security critical)
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: "NetworkOnly",
          },
        ],
      },
      manifest: {
        name: "usMoments",
        short_name: "usMoments",
        description: "A private shared space for couples — memories, love notes & more.",
        theme_color: "#171717",
        background_color: "#171717",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
