#!/usr/bin/env node
/**
 * Static GitHub Pages build. Prerenders the SPA, copies Nitro/Vercel static
 * assets, and writes 404.html so client routes resolve on project pages.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "dist");
const basePath = process.env.BASE_PATH || "/media-manager/";

process.env.GITHUB_PAGES = "1";
process.env.BASE_PATH = basePath;

const build = spawnSync("node", ["scripts/with-app-env.mjs", "vite", "build"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const candidates = [
  join(root, ".vercel", "output", "static"),
  join(root, ".output", "public"),
  join(root, "dist"),
];
const staticDir = candidates.find((p) => existsSync(p));
if (!staticDir) {
  console.error("No static output found after vite build");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
if (staticDir !== outDir) {
  cpSync(staticDir, outDir, { recursive: true });
}

const nojekyll = join(outDir, ".nojekyll");
writeFileSync(nojekyll, "");

const indexPath = join(outDir, "index.html");
if (!existsSync(indexPath)) {
  const assetsDir = join(outDir, "assets");
  const js = existsSync(assetsDir)
    ? readdirSync(assetsDir).find((f) => f.startsWith("index-") && f.endsWith(".js"))
    : null;
  const css = existsSync(assetsDir)
    ? readdirSync(assetsDir).find((f) => f.startsWith("styles-") && f.endsWith(".css"))
    : null;
  if (!js) {
    console.error("Prerender did not emit index.html and no index-*.js was found");
    process.exit(1);
  }
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0A0A0B" />
    <title>Media Manager</title>
    <link rel="icon" type="image/svg+xml" href="${basePath}favicon.svg" />
    <link rel="apple-touch-icon" href="${basePath}icon-180.png" />
    <link rel="manifest" href="${basePath}manifest.webmanifest" />
    ${css ? `<link rel="stylesheet" href="${basePath}assets/${css}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${basePath}assets/${js}"></script>
  </body>
</html>
`;
  writeFileSync(indexPath, html);
}

writeFileSync(join(outDir, "404.html"), readFileSync(indexPath));
console.log(`GitHub Pages static site written to ${outDir}`);
