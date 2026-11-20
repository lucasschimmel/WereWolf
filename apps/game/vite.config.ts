import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const fingerprintedAsset = /-[\w-]{8}\.[\w.]+$/;
const immutableCache = "public, max-age=31536000, immutable";

function cacheBuildAssets(): Plugin {
  return {
    name: "werewolf-asset-cache",
    configurePreviewServer({ config, middlewares }) {
      const { outDir, assetsDir } = config.environments.client.build;
      const directory = resolve(config.root, outDir, assetsDir);
      if (!existsSync(directory)) return;
      const prefix = `${config.base}${assetsDir}/`;
      const assets = new Set(
        readdirSync(directory, { withFileTypes: true })
          .filter(
            (entry) => entry.isFile() && fingerprintedAsset.test(entry.name),
          )
          .map((entry) => prefix + entry.name),
      );
      middlewares.use((request, response, next) => {
        const pathname = request.url?.split("?", 1)[0];
        if (
          pathname &&
          assets.has(pathname) &&
          (request.method === "GET" || request.method === "HEAD")
        ) {
          response.setHeader("Cache-Control", immutableCache);
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), tanstackStart(), react(), cacheBuildAssets()],
});
