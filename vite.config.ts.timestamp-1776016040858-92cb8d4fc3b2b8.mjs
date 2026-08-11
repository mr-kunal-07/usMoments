// vite.config.ts
import { defineConfig } from "file:///C:/Users/Kunal/Desktop/Jadhav%20Group/itsusmoment/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Kunal/Desktop/Jadhav%20Group/itsusmoment/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/Kunal/Desktop/Jadhav%20Group/itsusmoment/node_modules/lovable-tagger/dist/index.js";
import { VitePWA } from "file:///C:/Users/Kunal/Desktop/Jadhav%20Group/itsusmoment/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\Kunal\\Desktop\\Jadhav Group\\itsusmoment";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    }
  },
  build: {
    // Increase chunk size warning limit (many icon imports are expected)
    chunkSizeWarningLimit: 1e3,
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
            "@radix-ui/react-switch"
          ],
          // Charts (recharts) — loaded only on admin/analytics views
          // Map (leaflet) — loaded only on travel map view
          "vendor-map": ["leaflet"],
          // Animation
          "vendor-motion": ["framer-motion"],
          // Utilities
          "vendor-utils": ["date-fns", "clsx", "tailwind-merge", "class-variance-authority"]
        }
      }
    },
    // Enable source maps in production for error monitoring
    sourcemap: false,
    // Minify aggressively
    minify: "esbuild",
    target: "es2020"
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-icon-192.png", "pwa-icon-512.png"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        // Inject push SW handler into the generated service worker
        importScripts: ["/push-sw.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Limit cache size to prevent stale bloat on mobile devices
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // 3 MB
        runtimeCaching: [
          {
            // Google Fonts — cache long-term (fonts don't change)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            // Storage media (images/videos/audio) — cache aggressively client-side
            // Reduces Supabase egress bandwidth significantly at scale
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-media-cache",
              expiration: {
                maxEntries: 300,
                // up from 200
                maxAgeSeconds: 60 * 60 * 24 * 60
                // 60 days
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Supabase REST API — NetworkFirst with short TTL
            // Falls back to cache when offline or slow
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 2 },
              // 2 min TTL
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Supabase Auth endpoints — always network (security critical)
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: "NetworkOnly"
          }
        ]
      },
      manifest: {
        name: "usMoments",
        short_name: "usMoments",
        description: "A private shared space for couples \u2014 memories, love notes & more.",
        theme_color: "#171717",
        background_color: "#171717",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxLdW5hbFxcXFxEZXNrdG9wXFxcXEphZGhhdiBHcm91cFxcXFxpdHN1c21vbWVudFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcS3VuYWxcXFxcRGVza3RvcFxcXFxKYWRoYXYgR3JvdXBcXFxcaXRzdXNtb21lbnRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0t1bmFsL0Rlc2t0b3AvSmFkaGF2JTIwR3JvdXAvaXRzdXNtb21lbnQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcclxuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA4MDgwLFxyXG4gICAgaG1yOiB7XHJcbiAgICAgIG92ZXJsYXk6IGZhbHNlLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICAvLyBJbmNyZWFzZSBjaHVuayBzaXplIHdhcm5pbmcgbGltaXQgKG1hbnkgaWNvbiBpbXBvcnRzIGFyZSBleHBlY3RlZClcclxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgLy8gU3BsaXQgdmVuZG9yIGNvZGUgaW50byBzZXBhcmF0ZSBjaHVua3MgZm9yIGJldHRlciBsb25nLXRlcm0gY2FjaGluZ1xyXG4gICAgICAgIG1hbnVhbENodW5rczoge1xyXG4gICAgICAgICAgLy8gUmVhY3QgY29yZSBcdTIwMTQgY2hhbmdlcyBsZWFzdCBvZnRlbiBcdTIxOTIgY2FjaGVkIGxvbmdlc3RcclxuICAgICAgICAgIFwidmVuZG9yLXJlYWN0XCI6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCIsIFwicmVhY3Qtcm91dGVyLWRvbVwiXSxcclxuICAgICAgICAgIC8vIFN1cGFiYXNlIGNsaWVudFxyXG4gICAgICAgICAgXCJ2ZW5kb3Itc3VwYWJhc2VcIjogW1wiQHN1cGFiYXNlL3N1cGFiYXNlLWpzXCJdLFxyXG4gICAgICAgICAgLy8gRGF0YSBmZXRjaGluZ1xyXG4gICAgICAgICAgXCJ2ZW5kb3ItcXVlcnlcIjogW1wiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCJdLFxyXG4gICAgICAgICAgLy8gVUkgXHUyMDE0IFJhZGl4IHByaW1pdGl2ZXMgKGxhcmdlIGJ1dCBzdGFibGUpXHJcbiAgICAgICAgICBcInZlbmRvci1yYWRpeFwiOiBbXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LWRpYWxvZ1wiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC1kcm9wZG93bi1tZW51XCIsXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXNlbGVjdFwiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC10YWJzXCIsXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXBvcG92ZXJcIixcclxuICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3QtdG9vbHRpcFwiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC1zY3JvbGwtYXJlYVwiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC1hdmF0YXJcIixcclxuICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3QtY2hlY2tib3hcIixcclxuICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3Qtc3dpdGNoXCIsXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgICAgLy8gQ2hhcnRzIChyZWNoYXJ0cykgXHUyMDE0IGxvYWRlZCBvbmx5IG9uIGFkbWluL2FuYWx5dGljcyB2aWV3c1xyXG4gICAgICAgICAgLy8gTWFwIChsZWFmbGV0KSBcdTIwMTQgbG9hZGVkIG9ubHkgb24gdHJhdmVsIG1hcCB2aWV3XHJcbiAgICAgICAgICBcInZlbmRvci1tYXBcIjogW1wibGVhZmxldFwiXSxcclxuICAgICAgICAgIC8vIEFuaW1hdGlvblxyXG4gICAgICAgICAgXCJ2ZW5kb3ItbW90aW9uXCI6IFtcImZyYW1lci1tb3Rpb25cIl0sXHJcbiAgICAgICAgICAvLyBVdGlsaXRpZXNcclxuICAgICAgICAgIFwidmVuZG9yLXV0aWxzXCI6IFtcImRhdGUtZm5zXCIsIFwiY2xzeFwiLCBcInRhaWx3aW5kLW1lcmdlXCIsIFwiY2xhc3MtdmFyaWFuY2UtYXV0aG9yaXR5XCJdLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgLy8gRW5hYmxlIHNvdXJjZSBtYXBzIGluIHByb2R1Y3Rpb24gZm9yIGVycm9yIG1vbml0b3JpbmdcclxuICAgIHNvdXJjZW1hcDogZmFsc2UsXHJcbiAgICAvLyBNaW5pZnkgYWdncmVzc2l2ZWx5XHJcbiAgICBtaW5pZnk6IFwiZXNidWlsZFwiLFxyXG4gICAgdGFyZ2V0OiBcImVzMjAyMFwiLFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIG1vZGUgPT09IFwiZGV2ZWxvcG1lbnRcIiAmJiBjb21wb25lbnRUYWdnZXIoKSxcclxuICAgIFZpdGVQV0Eoe1xyXG4gICAgICByZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxyXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbXCJmYXZpY29uLmljb1wiLCBcInB3YS1pY29uLTE5Mi5wbmdcIiwgXCJwd2EtaWNvbi01MTIucG5nXCJdLFxyXG4gICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgbmF2aWdhdGVGYWxsYmFja0RlbnlsaXN0OiBbL15cXC9+b2F1dGgvXSxcclxuICAgICAgICAvLyBJbmplY3QgcHVzaCBTVyBoYW5kbGVyIGludG8gdGhlIGdlbmVyYXRlZCBzZXJ2aWNlIHdvcmtlclxyXG4gICAgICAgIGltcG9ydFNjcmlwdHM6IFtcIi9wdXNoLXN3LmpzXCJdLFxyXG4gICAgICAgIGdsb2JQYXR0ZXJuczogW1wiKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZjJ9XCJdLFxyXG4gICAgICAgIC8vIExpbWl0IGNhY2hlIHNpemUgdG8gcHJldmVudCBzdGFsZSBibG9hdCBvbiBtb2JpbGUgZGV2aWNlc1xyXG4gICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiAzICogMTAyNCAqIDEwMjQsIC8vIDMgTUJcclxuICAgICAgICBydW50aW1lQ2FjaGluZzogW1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICAvLyBHb29nbGUgRm9udHMgXHUyMDE0IGNhY2hlIGxvbmctdGVybSAoZm9udHMgZG9uJ3QgY2hhbmdlKVxyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2ZvbnRzXFwuZ29vZ2xlYXBpc1xcLmNvbVxcLy4qL2ksXHJcbiAgICAgICAgICAgIGhhbmRsZXI6IFwiQ2FjaGVGaXJzdFwiLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiBcImdvb2dsZS1mb250cy1jYWNoZVwiLFxyXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHsgbWF4RW50cmllczogMTAsIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NSB9LFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgLy8gU3RvcmFnZSBtZWRpYSAoaW1hZ2VzL3ZpZGVvcy9hdWRpbykgXHUyMDE0IGNhY2hlIGFnZ3Jlc3NpdmVseSBjbGllbnQtc2lkZVxyXG4gICAgICAgICAgICAvLyBSZWR1Y2VzIFN1cGFiYXNlIGVncmVzcyBiYW5kd2lkdGggc2lnbmlmaWNhbnRseSBhdCBzY2FsZVxyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcLy4qXFwuc3VwYWJhc2VcXC5jb1xcL3N0b3JhZ2VcXC92MVxcL29iamVjdFxcL3B1YmxpY1xcLy4qL2ksXHJcbiAgICAgICAgICAgIGhhbmRsZXI6IFwiQ2FjaGVGaXJzdFwiLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiBcInN1cGFiYXNlLW1lZGlhLWNhY2hlXCIsXHJcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogMzAwLCAvLyB1cCBmcm9tIDIwMFxyXG4gICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogNjAsIC8vIDYwIGRheXNcclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7IHN0YXR1c2VzOiBbMCwgMjAwXSB9LFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgLy8gU3VwYWJhc2UgUkVTVCBBUEkgXHUyMDE0IE5ldHdvcmtGaXJzdCB3aXRoIHNob3J0IFRUTFxyXG4gICAgICAgICAgICAvLyBGYWxscyBiYWNrIHRvIGNhY2hlIHdoZW4gb2ZmbGluZSBvciBzbG93XHJcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvLipcXC5zdXBhYmFzZVxcLmNvXFwvcmVzdFxcL3YxXFwvLiovaSxcclxuICAgICAgICAgICAgaGFuZGxlcjogXCJOZXR3b3JrRmlyc3RcIixcclxuICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogXCJzdXBhYmFzZS1hcGktY2FjaGVcIixcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDEwMCwgbWF4QWdlU2Vjb25kczogNjAgKiAyIH0sIC8vIDIgbWluIFRUTFxyXG4gICAgICAgICAgICAgIG5ldHdvcmtUaW1lb3V0U2Vjb25kczogNCxcclxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZTogeyBzdGF0dXNlczogWzAsIDIwMF0gfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIC8vIFN1cGFiYXNlIEF1dGggZW5kcG9pbnRzIFx1MjAxNCBhbHdheXMgbmV0d29yayAoc2VjdXJpdHkgY3JpdGljYWwpXHJcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvLipcXC5zdXBhYmFzZVxcLmNvXFwvYXV0aFxcLy4qL2ksXHJcbiAgICAgICAgICAgIGhhbmRsZXI6IFwiTmV0d29ya09ubHlcIixcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgfSxcclxuICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICBuYW1lOiBcInVzTW9tZW50c1wiLFxyXG4gICAgICAgIHNob3J0X25hbWU6IFwidXNNb21lbnRzXCIsXHJcbiAgICAgICAgZGVzY3JpcHRpb246IFwiQSBwcml2YXRlIHNoYXJlZCBzcGFjZSBmb3IgY291cGxlcyBcdTIwMTQgbWVtb3JpZXMsIGxvdmUgbm90ZXMgJiBtb3JlLlwiLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiBcIiMxNzE3MTdcIixcclxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiBcIiMxNzE3MTdcIixcclxuICAgICAgICBkaXNwbGF5OiBcInN0YW5kYWxvbmVcIixcclxuICAgICAgICBvcmllbnRhdGlvbjogXCJwb3J0cmFpdFwiLFxyXG4gICAgICAgIHNjb3BlOiBcIi9cIixcclxuICAgICAgICBzdGFydF91cmw6IFwiL1wiLFxyXG4gICAgICAgIGljb25zOiBbXHJcbiAgICAgICAgICB7IHNyYzogXCIvcHdhLWljb24tMTkyLnBuZ1wiLCBzaXplczogXCIxOTJ4MTkyXCIsIHR5cGU6IFwiaW1hZ2UvcG5nXCIgfSxcclxuICAgICAgICAgIHsgc3JjOiBcIi9wd2EtaWNvbi01MTIucG5nXCIsIHNpemVzOiBcIjUxMng1MTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiwgcHVycG9zZTogXCJhbnkgbWFza2FibGVcIiB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICB9KSxcclxuICBdLmZpbHRlcihCb29sZWFuKSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgIH0sXHJcbiAgfSxcclxufSkpO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTZVLFNBQVMsb0JBQW9CO0FBQzFXLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxlQUFlO0FBSnhCLElBQU0sbUNBQW1DO0FBT3pDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxPQUFPO0FBQUEsRUFDekMsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sS0FBSztBQUFBLE1BQ0gsU0FBUztBQUFBLElBQ1g7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUE7QUFBQSxJQUVMLHVCQUF1QjtBQUFBLElBQ3ZCLGVBQWU7QUFB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
