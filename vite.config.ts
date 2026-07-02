import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getPlugins() {
  const plugins = [react()];

  const isDev = process.env.NODE_ENV !== "production" || process.env.REPL_ID !== undefined;

  if (isDev) {
    try {
      const mod = await import("@replit/vite-plugin-runtime-error-modal");
      if (mod.default) plugins.push(mod.default());
    } catch {}

    if (process.env.REPL_ID !== undefined) {
      try {
        const cartographer = await import("@replit/vite-plugin-cartographer");
        if (cartographer.cartographer) plugins.push(cartographer.cartographer());
      } catch {}
      try {
        const devBanner = await import("@replit/vite-plugin-dev-banner");
        if (devBanner.devBanner) plugins.push(devBanner.devBanner());
      } catch {}
    }
  }

  return plugins;
}

export default defineConfig(async () => ({
  plugins: await getPlugins(),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
}));
