import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ensurePagesSeo, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "./pages-seo.mjs";

test("adds missing canonical, social, and description tags once", () => {
  const once = ensurePagesSeo(
    "<html><head><title>Media Manager</title></head><body></body></html>",
  );
  assert.match(once, new RegExp(`rel="canonical" href="${SITE_URL}"`));
  assert.match(once, /property="og:title"/);
  assert.match(once, /name="twitter:card" content="summary_large_image"/);
  assert.match(once, /application\/ld\+json/);
  const twice = ensurePagesSeo(once);
  assert.equal(twice.split('rel="canonical"').length - 1, 1);
  assert.equal(twice.split('property="og:title"').length - 1, 1);
});

test("published head copy matches the React document", () => {
  const root = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  const meta = readFileSync(new URL("../src/lib/site-meta.ts", import.meta.url), "utf8");
  assert.match(root, /site-meta/);
  assert.match(meta, new RegExp(SITE_TITLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(meta, new RegExp(SITE_DESCRIPTION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(meta, /https:\/\/tajoor621\.github\.io\/media-manager\//);
});
