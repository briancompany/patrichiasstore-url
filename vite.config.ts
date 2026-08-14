import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mcpPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Patrichia's Store",
        short_name: "Patrichia's",
        description: "Quality school uniforms for Kenyan schools",
        theme_color: "#10b981",
        background_color: "#0f1419",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [
          /^\/\.lovable\/oauth/,
          /^\/\.well-known\//,
          /^\/sitemap\.xml$/,
          /^\/robots\.txt$/,
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Code splitting — separate chunks for admin, staff, customer, vendor
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor libraries — cached separately, rarely change
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-select",
            "@radix-ui/react-toast",
          ],
          "vendor-supabase": ["@supabase/supabase-js"],

          // App chunks — only load when needed
          "chunk-admin": [
            "./src/pages/admin/Dashboard",
            "./src/pages/admin/Products",
            "./src/pages/admin/Orders",
            "./src/pages/admin/Schools",
            "./src/pages/admin/Analytics",
            "./src/pages/admin/Settings",
            "./src/pages/admin/Payments",
            "./src/pages/admin/SystemMonitor",
            "./src/pages/admin/ReviewsManager",
            "./src/pages/admin/StoreContent",
            "./src/pages/admin/Staff",
            "./src/pages/admin/Users",
            "./src/pages/admin/Discounts",
            "./src/pages/admin/PricingChart",
          ],
          "chunk-staff": [
            "./src/pages/staff/Dashboard",
            "./src/pages/staff/QuotationNew",
            "./src/pages/staff/QuotationHistory",
            "./src/pages/staff/Customers",
            "./src/pages/staff/PriceBook",
            "./src/pages/staff/Reports",
            "./src/pages/staff/Settings",
          ],
          "chunk-checkout": [
            "./src/pages/Checkout",
            "./src/pages/Payment",
            "./src/pages/Order",
            "./src/pages/TrackOrder",
            "./src/pages/OrderHistory",
          ],
        },
      },
    },
    // Increase warning threshold (admin chunk is intentionally large)
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging
    sourcemap: false,
    // Minify aggressively
    minify: "esbuild",
    target: "es2020",
  },
}));
