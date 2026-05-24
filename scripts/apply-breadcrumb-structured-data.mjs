import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const BASE_URL = "https://www.carkey.com.tw";
const EXCLUDED_DIRS = new Set([
  ".git",
  ".uv-cache",
  ".uv-python",
  "backup",
  "backups",
  "drafts",
  "local",
  "node_modules",
  "secrets",
  "__pycache__",
]);

const COUNTY_PAGE_LABELS = new Map([
  ["taipei-car-key.html", "台北市汽車鑰匙服務"],
  ["new-taipei-car-key.html", "新北市汽車鑰匙服務"],
  ["keelung-car-key.html", "基隆市汽車鑰匙服務"],
  ["taoyuan-car-key.html", "桃園市汽車鑰匙服務"],
  ["hsinchu-city-car-key.html", "新竹市汽車鑰匙服務"],
  ["hsinchu-county-car-key.html", "新竹縣汽車鑰匙服務"],
  ["miaoli-car-key.html", "苗栗縣汽車鑰匙服務"],
  ["taichung-car-key.html", "台中市汽車鑰匙服務"],
  ["changhua-car-key.html", "彰化縣汽車鑰匙服務"],
  ["nantou-car-key.html", "南投縣汽車鑰匙服務"],
  ["yunlin-car-key.html", "雲林縣汽車鑰匙服務"],
  ["chiayi-city-car-key.html", "嘉義市汽車鑰匙服務"],
  ["chiayi-county-car-key.html", "嘉義縣汽車鑰匙服務"],
  ["tainan-car-key.html", "台南市汽車鑰匙服務"],
  ["kaohsiung-car-key.html", "高雄市汽車鑰匙服務"],
  ["pingtung-car-key.html", "屏東縣汽車鑰匙服務"],
  ["yilan-car-key.html", "宜蘭縣汽車鑰匙服務"],
  ["hualien-car-key.html", "花蓮縣汽車鑰匙服務"],
  ["taitung-car-key.html", "台東縣汽車鑰匙服務"],
  ["penghu-car-key.html", "澎湖縣汽車鑰匙服務"],
  ["kinmen-car-key.html", "金門縣汽車鑰匙服務"],
  ["lienchiang-car-key.html", "連江縣汽車鑰匙服務"],
]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

async function walk(dir, output = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        await walk(path.join(dir, entry.name), output);
      }
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      output.push(toPosix(path.relative(ROOT, path.join(dir, entry.name))));
    }
  }
  return output;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getAttr(tag, attrName) {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(["'])(.*?)\\1`, "i");
  const match = tag.match(re);
  return match ? decodeHtmlEntities(match[2]) : "";
}

function getCanonical(html, relPath) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = getAttr(tag, "rel").toLowerCase().split(/\s+/);
    if (rel.includes("canonical")) return getAttr(tag, "href");
  }
  return `${BASE_URL}${routeFromRelPath(relPath)}`;
}

function getRobots(html) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if (getAttr(tag, "name").toLowerCase() === "robots") return getAttr(tag, "content").toLowerCase();
  }
  return "";
}

function extractTitle(html) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1 || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!title) return "極致核心 ProCore Auto Key";
  return decodeHtmlEntities(title[1].replace(/<[^>]+>/g, " ")).split(/[｜|]/)[0].trim();
}

function routeFromRelPath(relPath) {
  if (relPath === "index.html") return "/";
  return `/${relPath.replace(/\.html$/i, "").replace(/\/index$/i, "")}`;
}

function fileNameFromLink(link) {
  if (!link) return "";
  const pathname = link.startsWith("http") ? new URL(link).pathname : link;
  return `${pathname.replace(/^\/+/, "").replace(/\/$/, "")}.html`;
}

async function readLinkedEntries(fileName) {
  try {
    const raw = await fs.readFile(path.join(ROOT, fileName), "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return new Set();
    return new Set(data.map((item) => fileNameFromLink(item.link || item.url)).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function readHtmlArticleLinks(fileName) {
  try {
    const html = await fs.readFile(path.join(ROOT, fileName), "utf8");
    const links = new Set();
    for (const match of html.matchAll(/<a\b[^>]*href=(["'])(.*?)\1/gi)) {
      const href = match[2];
      if (!/^\/?(article-|case-)/.test(href)) continue;
      links.add(fileNameFromLink(href));
    }
    return links;
  } catch {
    return new Set();
  }
}

function breadcrumbParent(relPath, casesLinks) {
  const name = path.posix.basename(relPath);
  if (name === "blog.html") return null;
  if (name === "cases.html") return null;
  if (name === "service-areas.html") return null;
  if (name === "vcard.html") return null;
  if (COUNTY_PAGE_LABELS.has(name)) {
    return { name: "服務區域", item: `${BASE_URL}/service-areas` };
  }
  if (name.startsWith("article-") || name.startsWith("case-")) {
    if (casesLinks.has(name) || name.startsWith("case-")) {
      return { name: "到場處理紀錄", item: `${BASE_URL}/cases` };
    }
    return { name: "車主指南", item: `${BASE_URL}/blog` };
  }
  return null;
}

function topLevelName(relPath, fallbackTitle) {
  const name = path.posix.basename(relPath);
  if (name === "blog.html") return "車主指南";
  if (name === "cases.html") return "到場處理紀錄";
  if (name === "service-areas.html") return "服務區域";
  if (name === "vcard.html") return "電子名片";
  return COUNTY_PAGE_LABELS.get(name) || fallbackTitle;
}

function breadcrumbJsonLd(relPath, html, casesLinks) {
  const canonical = getCanonical(html, relPath);
  const fallbackTitle = extractTitle(html);
  const parent = breadcrumbParent(relPath, casesLinks);
  const currentName = topLevelName(relPath, fallbackTitle);
  const itemListElement = [
    {
      "@type": "ListItem",
      position: 1,
      name: "首頁",
      item: `${BASE_URL}/`,
    },
  ];

  if (parent) {
    itemListElement.push({
      "@type": "ListItem",
      position: itemListElement.length + 1,
      name: parent.name,
      item: parent.item,
    });
  }

  itemListElement.push({
    "@type": "ListItem",
    position: itemListElement.length + 1,
    name: currentName,
    item: canonical,
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
    itemListElement,
  };
}

function jsonLdTypeIncludes(node, typeName) {
  const type = node && node["@type"];
  return type === typeName || (Array.isArray(type) && type.includes(typeName));
}

function stripLegacyBreadcrumbNodes(html) {
  return html.replace(
    /<script\b([^>]*type=["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi,
    (full, attrs, payload) => {
      if (/data-seo=["']breadcrumb["']/i.test(attrs)) return "";
      let parsed;
      try {
        parsed = JSON.parse(payload.trim());
      } catch {
        return full;
      }

      let changed = false;
      if (Array.isArray(parsed?.["@graph"])) {
        const filtered = parsed["@graph"].filter((node) => !jsonLdTypeIncludes(node, "BreadcrumbList"));
        changed = filtered.length !== parsed["@graph"].length;
        parsed["@graph"] = filtered;
      } else if (jsonLdTypeIncludes(parsed, "BreadcrumbList")) {
        return "";
      }

      if (!changed) return full;
      return `<script${attrs}>${JSON.stringify(parsed, null, 2).replace(/<\//g, "<\\/")}</script>`;
    },
  );
}

function insertBreadcrumb(html, relPath, casesLinks) {
  const payload = JSON.stringify(breadcrumbJsonLd(relPath, html, casesLinks), null, 2).replace(/<\//g, "<\\/");
  const script = `<script type="application/ld+json" data-seo="breadcrumb">\n${payload}\n</script>`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `\n${script}\n</head>`);
  }
  return `${script}\n${html}`;
}

async function main() {
  const htmlFiles = await walk(ROOT);
  const casesLinks = await readLinkedEntries("cases.json");
  for (const link of await readHtmlArticleLinks("cases.html")) {
    casesLinks.add(link);
  }
  let changed = 0;
  let skipped = 0;

  for (const relPath of htmlFiles) {
    const fullPath = path.join(ROOT, relPath);
    const html = await fs.readFile(fullPath, "utf8");
    if (relPath === "index.html" || getRobots(html).includes("noindex")) {
      skipped += 1;
      continue;
    }

    const withoutBreadcrumb = stripLegacyBreadcrumbNodes(html);
    const nextHtml = insertBreadcrumb(withoutBreadcrumb, relPath, casesLinks);
    if (nextHtml !== html) {
      await fs.writeFile(fullPath, nextHtml, "utf8");
      changed += 1;
    }
  }

  console.log(`Breadcrumb JSON-LD updated: ${changed}`);
  console.log(`Skipped noindex/root pages: ${skipped}`);
}

await main();
