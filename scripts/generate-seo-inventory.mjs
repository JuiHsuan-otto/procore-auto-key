import fsp from "node:fs/promises";
import path from "node:path";
import {
  SITE_ORIGIN,
  collectInternalRoutes,
  csvEscape,
  fileToRoute,
  getCanonical,
  getFirstHeading,
  getImageStats,
  getMetaContent,
  getRootJsonLdTypes,
  getTitle,
  parseSitemapEntries,
  walkFiles,
} from "./seo-utils.mjs";

const ROOT = process.cwd();
const LOCATION_FILES = new Set([
  "taipei-car-key.html", "new-taipei-car-key.html", "keelung-car-key.html", "taoyuan-car-key.html",
  "hsinchu-city-car-key.html", "hsinchu-county-car-key.html", "miaoli-car-key.html", "taichung-car-key.html",
  "changhua-car-key.html", "nantou-car-key.html", "yunlin-car-key.html", "chiayi-city-car-key.html",
  "chiayi-county-car-key.html", "tainan-car-key.html", "kaohsiung-car-key.html", "pingtung-car-key.html",
  "yilan-car-key.html", "hualien-car-key.html", "taitung-car-key.html", "penghu-car-key.html",
  "kinmen-car-key.html", "lienchiang-car-key.html",
]);
const SERVICE_FILES = new Set([
  "all-keys-lost-service.html", "car-key-duplication-service.html", "car-key-lost-service.html",
  "car-key-shell-replacement-service.html", "chip-key-copy-by-mail-service.html", "key-not-detected-service.html",
  "non-chip-car-key-duplication-service.html", "smart-key-lost-service.html", "spare-car-key-service.html",
]);
const VEHICLE_FILES = new Set(["bmw-smart-key-service.html", "vw-car-key-service.html", "toyota-altis-car-key.html"]);
const GUIDE_HINTS = [
  "guide", "comparison", "checklist", "troubleshooting", "why-you-need", "market", "info-preparation",
  "key-safety", "consumer-impact", "owner-guide", "key-not-detected", "used-car",
];

function pageType(relPath) {
  if (relPath === "index.html") return "homepage";
  if (relPath === "blog.html") return "article-hub";
  if (relPath === "cases.html") return "case-hub";
  if (relPath === "service-areas.html") return "location-hub";
  if (relPath === "vcard.html") return "contact";
  if (relPath === "rescue-request.html") return "utility";
  if (relPath === "dich-vu-lam-khoa-xe-o-to-tai-dai-loan.html") return "language";
  if (LOCATION_FILES.has(relPath)) return "location";
  if (SERVICE_FILES.has(relPath)) return "service";
  if (VEHICLE_FILES.has(relPath)) return "brand-or-model";
  if (relPath.startsWith("case-")) return "case";
  if (relPath.startsWith("article-")) {
    return GUIDE_HINTS.some((hint) => relPath.includes(hint)) ? "guide" : "case";
  }
  return "other";
}

const htmlFiles = await walkFiles(ROOT, (relPath) => relPath.toLowerCase().endsWith(".html"));
const sitemapXml = await fsp.readFile(path.join(ROOT, "sitemap.xml"), "utf8");
const lastmodByUrl = new Map(parseSitemapEntries(sitemapXml).map((entry) => [entry.loc, entry.lastmod]));
const pages = [];
const knownRoutes = new Set(htmlFiles.map(fileToRoute));

for (const relPath of htmlFiles) {
  const html = await fsp.readFile(path.join(ROOT, relPath), "utf8");
  const route = fileToRoute(relPath);
  const canonical = getCanonical(html);
  const robots = getMetaContent(html, "name", "robots");
  const imageStats = getImageStats(html);
  const outgoingRoutes = collectInternalRoutes(html).filter((target) => knownRoutes.has(target) && target !== route);
  pages.push({
    url: canonical || `${SITE_ORIGIN}${route}`,
    file: relPath,
    page_type: pageType(relPath),
    title: getTitle(html),
    meta_description: getMetaContent(html, "name", "description"),
    canonical,
    h1: getFirstHeading(html),
    robots,
    indexable: !robots.toLowerCase().includes("noindex"),
    schema_types: getRootJsonLdTypes(html),
    internal_inlinks: 0,
    internal_outlinks: outgoingRoutes.length,
    image_count: imageStats.total,
    images_missing_alt: imageStats.missingAlt,
    images_missing_width: imageStats.missingWidth,
    images_missing_height: imageStats.missingHeight,
    images_missing_loading: imageStats.missingLoading,
    sitemap_lastmod: lastmodByUrl.get(canonical) || "",
    route,
    outgoingRoutes,
  });
}

const incoming = new Map(pages.map((page) => [page.route, new Set()]));
for (const page of pages) {
  for (const target of page.outgoingRoutes) incoming.get(target)?.add(page.route);
}
for (const page of pages) page.internal_inlinks = incoming.get(page.route)?.size || 0;
pages.sort((a, b) => a.url.localeCompare(b.url, "en"));

const publicRows = pages.map(({ route, outgoingRoutes, ...row }) => row);
const format = process.argv.includes("--format=json") ? "json" : "csv";

if (process.argv.includes("--check")) {
  const errors = [];
  for (const row of publicRows) {
    if (!row.url || !row.file || !row.page_type) errors.push(`${row.file || "unknown"}: missing identity fields`);
    if (row.indexable && (!row.title || !row.meta_description || !row.canonical || !row.h1)) {
      errors.push(`${row.file}: incomplete indexable SEO fields`);
    }
  }
  if (errors.length) {
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exit(1);
  }
  console.log(`SEO inventory check passed: ${publicRows.length} HTML pages`);
  process.exit(0);
}

if (format === "json") {
  console.log(JSON.stringify(publicRows, null, 2));
} else {
  const fields = Object.keys(publicRows[0] || {});
  console.log(fields.join(","));
  for (const row of publicRows) console.log(fields.map((field) => csvEscape(row[field])).join(","));
}
