#!/usr/bin/env node
/** Fail deployment when the published manifest advertises missing or invalid assets. */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "dist");
const manifest = JSON.parse(readFileSync(join(dir, "manifest.webmanifest"), "utf8"));
const index = readFileSync(join(dir, "index.html"), "utf8");
assert.match(index, /rel=["']manifest["']/i, "App HTML must link a manifest");
assert.match(index, /manifest\.webmanifest/, "App HTML must link the Media Manager manifest");
assert.ok(!index.includes('href="/__grok/manifest.webmanifest"'), "Competing Grok manifest detected");
for (const key of ["name", "short_name", "description", "id", "start_url", "scope", "display", "theme_color", "background_color", "lang"]) {
  assert.ok(manifest[key], `Missing manifest field: ${key}`);
}
assert.equal(manifest.display, "standalone");
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 2);
assert.ok(Array.isArray(manifest.screenshots) && manifest.screenshots.length >= 2);
for (const item of [...manifest.icons, ...manifest.screenshots, ...manifest.shortcuts.flatMap((s) => s.icons || [])]) {
  assert.ok(!item.src.startsWith("/") && !item.src.includes(".."), "Asset must resolve inside GitHub Pages scope");
  const file = join(dir, item.src);
  assert.ok(existsSync(file), `Missing manifest asset: ${item.src}`);
  if (item.type === "image/png") {
    const data = readFileSync(file);
    assert.equal(data.subarray(1, 4).toString("ascii"), "PNG", `Invalid PNG: ${item.src}`);
    const size = `${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`;
    assert.equal(size, item.sizes, `Incorrect declared size for ${item.src}`);
  }
}
assert.ok(existsSync(join(dir, "sw.js")), "Service worker missing");
console.log("PWA manifest, icons, screenshots, shortcuts, service worker and head link validated.");
