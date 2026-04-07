import { defineNitroConfig } from "nitropack/config";

export default defineNitroConfig({
  srcDir: ".",
  routesDir: "routes",
  middlewareDir: "middleware",
  pluginsDir: "plugins",
  compatibilityDate: "2025-01-01",
  publicAssets: [
    {
      dir: "../web/dist",
      baseURL: "/",
      fallthrough: true,
    },
  ],
  routeRules: {
    "/api/**": { cors: true },
  },
  experimental: {
    asyncContext: true,
  },
  typescript: {
    strict: true,
  },
});
