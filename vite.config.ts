import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({mode}) => {
  const base = loadEnv(mode, '.', 'APP_').APP_BASE || '/';
  if (!/^\/(?:[A-Za-z0-9._~-]+\/)*$/.test(base) || base.split('/').some(part=>part==='.'||part==='..')) throw Error('APP_BASE must be a root-relative directory ending in /');
  return {
  base,
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
  optimizeDeps: { include: ["tesseract.js"] },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      scope: base,
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "BetterLumi",
        short_name: "BetterLumi",
        description: "BetterLumi — personal wellness journal",
        theme_color: "#F4F2ED",
        background_color: "#F4F2ED",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          { src: base + "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: base + "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globIgnores: ["ocr/**"],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith(new URL("ocr/", self.location.href).pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "betterlumi-ocr-v7",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 24, maxAgeSeconds: 31536000 },
            },
          },
        ],
        globPatterns: ["**/*.{js,css,html,png,jpg,webp,svg,woff2}"],
        navigateFallback: base + "index.html",
        navigateFallbackAllowlist: [new RegExp("^" + base.replaceAll(".", "\\."))],
      },
    }),
  ],
};
});
