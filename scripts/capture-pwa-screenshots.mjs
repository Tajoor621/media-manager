#!/usr/bin/env node
/**
 * Capture genuine PWA screenshots from the built GitHub Pages app.
 * This runs in GitHub Actions after build:pages and uses its installed Chrome.
 * No fabricated marketing mockups; the actual rendered UI is captured.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve, extname, sep } from "node:path";

const root = resolve(process.cwd(), "dist");
const base = (process.env.BASE_PATH || "/media-manager/").replace(/\\?\/$/, "/");
const out = join(root, "screenshots");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".json": "application/json" };
if (!existsSync(join(root, "index.html"))) throw new Error("Run npm run build:pages first.");
mkdirSync(out, { recursive: true });
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\/+/, "");
  const candidate = resolve(root, relative || "index.html");
  const file = candidate.startsWith(root + sep) && existsSync(candidate) ? candidate : join(root, "index.html");
  res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(file));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const port = server.address().port;
const chrome = process.env.CHROME_PATH || ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(chrome ? { executablePath: chrome } : {}), args: ["--no-sandbox"] });
  for (const target of [
    { file: "media-manager-desktop.png", width: 1280, height: 800, mobile: false },
    { file: "media-manager-mobile.png", width: 390, height: 844, mobile: true },
  ]) {
    const context = await browser.newContext({ viewport: { width: target.width, height: target.height }, deviceScaleFactor: 1, isMobile: target.mobile, hasTouch: target.mobile, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}${base}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, target.file), fullPage: false, animations: "disabled" });
    await context.close();
    console.log(`Captured genuine screenshot: ${target.file}`);
  }
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
