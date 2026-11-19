import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Local movement relay (`bun run dev` in apps/relay), proxied at /relay. */
const relayPort = process.env.RELAY_DEV_PORT ?? "8787";

export default defineConfig({
  plugins: [tailwindcss(), tanstackStart(), react()],
  server: {
    proxy: {
      "/relay": {
        target: `http://127.0.0.1:${relayPort}`,
        ws: true,
        rewrite: (path) => path.replace(/^\/relay/, ""),
      },
    },
  },
});
