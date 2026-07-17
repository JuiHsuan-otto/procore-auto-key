import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { auditSitemapXml, walkFiles } from "./seo-utils.mjs";

const valid = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.carkey.com.tw/</loc><lastmod>2026-07-07</lastmod></url>
</urlset>`;
const invalid = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.carkey.com.tw/example.html</loc><lastmod>2026-12-24</lastmod></url>
  <url><loc>https://www.carkey.com.tw/example.html</loc><lastmod>2026-12-24</lastmod></url>
</urlset>`;

assert.deepEqual(
  auditSitemapXml(valid, { knownCanonicals: new Set(["https://www.carkey.com.tw/"]), today: "2026-07-16" }).errors,
  [],
);

const invalidErrors = auditSitemapXml(invalid, { today: "2026-07-16" }).errors.join("\n");
assert.match(invalidErrors, /clean route/);
assert.match(invalidErrors, /future lastmod/);
assert.match(invalidErrors, /duplicate loc/);

const inventoryArgs = ["scripts/generate-seo-inventory.mjs", "--format=json"];
const inventoryA = execFileSync(process.execPath, inventoryArgs, { encoding: "utf8" });
const inventoryB = execFileSync(process.execPath, inventoryArgs, { encoding: "utf8" });
assert.equal(inventoryA, inventoryB, "SEO inventory output must be deterministic");
const htmlFiles = await walkFiles(process.cwd(), (relPath) => relPath.toLowerCase().endsWith(".html"));
assert.equal(JSON.parse(inventoryA).length, htmlFiles.length, "SEO inventory must cover every HTML page");

console.log("SEO foundation unit checks passed");
