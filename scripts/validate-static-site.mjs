import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
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
const SITE_HOSTS = new Set(["carkey.com.tw", "www.carkey.com.tw"]);
const COUNTY_AREA_PAGES = new Set([
  "taipei-car-key.html",
  "new-taipei-car-key.html",
  "keelung-car-key.html",
  "taoyuan-car-key.html",
  "hsinchu-city-car-key.html",
  "hsinchu-county-car-key.html",
  "miaoli-car-key.html",
  "taichung-car-key.html",
  "changhua-car-key.html",
  "nantou-car-key.html",
  "yunlin-car-key.html",
  "chiayi-city-car-key.html",
  "chiayi-county-car-key.html",
  "tainan-car-key.html",
  "kaohsiung-car-key.html",
  "pingtung-car-key.html",
  "yilan-car-key.html",
  "hualien-car-key.html",
  "taitung-car-key.html",
  "penghu-car-key.html",
  "kinmen-car-key.html",
  "lienchiang-car-key.html",
]);
const SENSITIVE_PUBLIC_TERMS = [
  "解碼實績",
  "最新解碼實績",
  "防盜系統解碼",
  "解碼匹配",
  "免拆電腦",
  "FEM/BDC",
  "FEM",
  "BDC",
  "CAS4",
  "FBS3",
  "FBS4",
  "MQB",
  "底層密碼",
  "加密資料",
  "資料讀取",
  "動態密碼演算",
  "EIS",
  "電子點火開關",
  "密碼採集",
  "128 位元",
  "256 位元",
  "PATS",
  "Delete Keys",
  "密鑰",
  "演算法",
  "加密",
  "診斷接口",
  "數據協議",
  "讀寫",
  "註銷",
  "不鎖死電腦",
  "技術診斷",
  "安全安全",
  "車輛安全車輛系統",
  "BCM",
  "MCU",
  "繞過",
  "安全協議",
  "車輛安全 ID",
  "解密：",
  "流程如下",
  "授權碼",
  "通訊協議",
  "射頻邏輯",
  "防盜資料",
  "底層",
  "原始編碼",
  "對接點",
  "拆解後",
  "內部晶片",
  "十六進位",
  "重寫過程",
  "安全演算",
];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

async function walk(dir, matcher, output = []) {
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        await walk(path.join(dir, entry.name), matcher, output);
      }
      continue;
    }
    if (entry.isFile()) {
      const fullPath = path.join(dir, entry.name);
      const relPath = toPosix(path.relative(ROOT, fullPath));
      if (matcher(relPath)) output.push(relPath);
    }
  }
  return output;
}

function isExternal(value) {
  return /^(https?:)?\/\//i.test(value);
}

function normalizeLocalRef(value) {
  if (!value || /^(data|mailto|tel|sms):/i.test(value) || value.includes("${") || value.includes("{{")) {
    return null;
  }
  let ref = value.trim().split(/[?#]/, 1)[0];
  if (!ref) return null;

  if (/^https?:\/\//i.test(ref)) {
    try {
      const url = new URL(ref);
      if (!SITE_HOSTS.has(url.hostname)) return null;
      ref = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    } catch {
      return null;
    }
  } else if (ref.startsWith("//")) {
    return null;
  } else {
    ref = decodeURIComponent(ref.replace(/^\.?\//, ""));
  }

  if (!ref || ref.includes("..") || ref.startsWith("#")) return null;
  return ref;
}

function cleanUrlPathFromHtmlHref(href) {
  if (!href || href.startsWith("#") || /^(mailto|tel|sms):/i.test(href)) return null;
  if (href.includes("${") || href.includes("{{")) return null;
  if (isExternal(href)) return null;
  const ref = href.split(/[?#]/, 1)[0].replace(/^\/+/, "");
  if (!ref || ref.includes("..")) return null;
  return ref;
}

function fileExistsForRoute(ref) {
  const directPath = path.join(ROOT, ref);
  if (fs.existsSync(directPath)) return true;
  if (!path.extname(ref) && fs.existsSync(path.join(ROOT, `${ref}.html`))) return true;
  if (!path.extname(ref) && fs.existsSync(path.join(ROOT, ref, "index.html"))) return true;
  return false;
}

function htmlFileForRoute(ref) {
  if (!ref) return "index.html";
  if (ref.toLowerCase().endsWith(".html") && fs.existsSync(path.join(ROOT, ref))) return ref;
  if (!path.extname(ref) && fs.existsSync(path.join(ROOT, `${ref}.html`))) return `${ref}.html`;
  if (!path.extname(ref) && fs.existsSync(path.join(ROOT, ref, "index.html"))) {
    return toPosix(path.join(ref, "index.html"));
  }
  return null;
}

function parseJsonLdBlocks(html, relPath, errors) {
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const payload = match[1].trim();
    if (!payload) continue;
    try {
      JSON.parse(payload);
    } catch (error) {
      errors.push(`${relPath}: invalid JSON-LD (${error.message})`);
    }
  }
}

function collectJsonLdNodes(html) {
  const nodes = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const payload = match[1].trim();
    if (!payload) continue;
    try {
      appendJsonLdNodes(JSON.parse(payload), nodes);
    } catch {
      // parseJsonLdBlocks reports the exact error; this collector only powers SEO assertions.
    }
  }
  return nodes;
}

function appendJsonLdNodes(value, nodes) {
  if (Array.isArray(value)) {
    for (const item of value) appendJsonLdNodes(item, nodes);
    return;
  }
  if (!value || typeof value !== "object") return;
  nodes.push(value);
  if (Array.isArray(value["@graph"])) {
    for (const item of value["@graph"]) appendJsonLdNodes(item, nodes);
  }
}

function jsonLdHasType(html, typeName) {
  return collectJsonLdNodes(html).some((node) => {
    const type = node["@type"];
    return type === typeName || (Array.isArray(type) && type.includes(typeName));
  });
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

function getTitle(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "")) : "";
}

function getMetaContent(html, attrName, attrValue) {
  const tagRe = /<meta\b[^>]*>/gi;
  let match;
  while ((match = tagRe.exec(html)) !== null) {
    const tag = match[0];
    if (getAttr(tag, attrName).toLowerCase() === attrValue.toLowerCase()) {
      return getAttr(tag, "content");
    }
  }
  return "";
}

function getCanonical(html) {
  const tagRe = /<link\b[^>]*>/gi;
  let match;
  while ((match = tagRe.exec(html)) !== null) {
    const tag = match[0];
    const rel = getAttr(tag, "rel").toLowerCase().split(/\s+/);
    if (rel.includes("canonical")) return getAttr(tag, "href");
  }
  return "";
}

function extractSeoMetadata(relPath, html) {
  const robots = getMetaContent(html, "name", "robots").toLowerCase();
  return {
    relPath,
    noindex: robots.includes("noindex"),
    title: getTitle(html),
    description: getMetaContent(html, "name", "description"),
    canonical: getCanonical(html),
    h1Count: (html.match(/<h1\b/gi) || []).length,
    ogImage: getMetaContent(html, "property", "og:image"),
    twitterImage: getMetaContent(html, "name", "twitter:image"),
    hasBreadcrumbList: jsonLdHasType(html, "BreadcrumbList"),
  };
}

function collectInternalHtmlTargets(html) {
  const targets = [];
  const anchorRe = /<a\b[^>]*>/gi;
  let match;
  while ((match = anchorRe.exec(html)) !== null) {
    const href = getAttr(match[0], "href");
    const ref = cleanUrlPathFromHtmlHref(href);
    if (!ref && href !== "/") continue;
    const target = htmlFileForRoute(ref || "");
    if (target) targets.push(target);
  }
  return targets;
}

function validateSeoEntries(entries, sitemapUrls, incomingLinks, errors) {
  const indexableEntries = entries.filter((entry) => !entry.noindex);
  const titles = new Map();
  const descriptions = new Map();

  for (const entry of indexableEntries) {
    if (!entry.title) errors.push(`${entry.relPath}: missing <title>`);
    if (!entry.description) errors.push(`${entry.relPath}: missing meta description`);
    if (!entry.canonical) errors.push(`${entry.relPath}: missing canonical URL`);
    if (entry.h1Count !== 1) errors.push(`${entry.relPath}: expected exactly one h1, found ${entry.h1Count}`);
    if (!entry.ogImage) errors.push(`${entry.relPath}: missing og:image`);
    if (!entry.twitterImage) errors.push(`${entry.relPath}: missing twitter:image`);
    if (entry.relPath !== "index.html" && !entry.hasBreadcrumbList) {
      errors.push(`${entry.relPath}: missing BreadcrumbList JSON-LD`);
    }
    const incomingCount = incomingLinks.get(entry.relPath) || 0;
    if (entry.relPath !== "index.html" && incomingCount === 0) {
      errors.push(`${entry.relPath}: indexable page has no internal inlinks`);
    }
    if (entry.relPath.startsWith("article-") && incomingCount < 3) {
      errors.push(`${entry.relPath}: article page has only ${incomingCount} internal inlinks`);
    }
    if (COUNTY_AREA_PAGES.has(entry.relPath) && incomingCount < 3) {
      errors.push(`${entry.relPath}: county service page has only ${incomingCount} internal inlinks`);
    }

    if (entry.canonical) {
      try {
        const canonicalUrl = new URL(entry.canonical);
        if (!SITE_HOSTS.has(canonicalUrl.hostname)) {
          errors.push(`${entry.relPath}: canonical host is not a site host: ${entry.canonical}`);
        }
        if (sitemapUrls.size && !sitemapUrls.has(entry.canonical)) {
          errors.push(`${entry.relPath}: canonical URL missing from sitemap.xml: ${entry.canonical}`);
        }
      } catch {
        errors.push(`${entry.relPath}: invalid canonical URL: ${entry.canonical}`);
      }
    }

    if (entry.title) {
      titles.set(entry.title, [...(titles.get(entry.title) || []), entry.relPath]);
    }
    if (entry.description) {
      descriptions.set(entry.description, [...(descriptions.get(entry.description) || []), entry.relPath]);
    }
  }

  for (const [title, relPaths] of titles.entries()) {
    if (relPaths.length > 1) {
      errors.push(`duplicate title "${title}": ${relPaths.join(", ")}`);
    }
  }
  for (const [description, relPaths] of descriptions.entries()) {
    if (relPaths.length > 1) {
      errors.push(`duplicate meta description "${description}": ${relPaths.join(", ")}`);
    }
  }
}

function validateHtml(relPath, html, errors, warnings) {
  if (/cdn\.tailwindcss\.com/i.test(html)) {
    errors.push(`${relPath}: Tailwind CDN is still referenced`);
  }
  if (/unsafe-eval/i.test(html)) {
    errors.push(`${relPath}: CSP contains unsafe-eval`);
  }
  if (/\?{4,}/.test(html)) {
    warnings.push(`${relPath}: contains long question-mark run; check text encoding`);
  }
  for (const term of SENSITIVE_PUBLIC_TERMS) {
    if (html.includes(term)) {
      errors.push(`${relPath}: contains sensitive public wording: ${term}`);
    }
  }

  parseJsonLdBlocks(html, relPath, errors);

  const attrRe = /\b(src|href|content)\s*=\s*(["'])([^"']+)\2/gi;
  let match;
  while ((match = attrRe.exec(html)) !== null) {
    const [, attr, , rawValue] = match;
    if (attr === "content" && !/\.(jpe?g|png|webp|gif|svg)$/i.test(rawValue)) continue;
    const localRef = attr === "href" ? cleanUrlPathFromHtmlHref(rawValue) : normalizeLocalRef(rawValue);
    if (!localRef) continue;
    if (!fileExistsForRoute(localRef)) {
      errors.push(`${relPath}: missing local ${attr} target: ${rawValue}`);
    }
  }

  const pictureRe = /<picture\b[\s\S]*?<source\b[^>]*srcset=["']([^"']+)["'][^>]*>[\s\S]*?<\/picture>/gi;
  while ((match = pictureRe.exec(html)) !== null) {
    const localRef = normalizeLocalRef(match[1]);
    if (localRef && !fs.existsSync(path.join(ROOT, localRef))) {
      errors.push(`${relPath}: missing picture source: ${match[1]}`);
    }
  }
}

async function validateJsonFile(relPath, errors) {
  const raw = await fsp.readFile(path.join(ROOT, relPath), "utf8");
  try {
    JSON.parse(raw);
  } catch (error) {
    errors.push(`${relPath}: invalid JSON (${error.message})`);
  }
  for (const term of SENSITIVE_PUBLIC_TERMS) {
    if (raw.includes(term)) {
      errors.push(`${relPath}: contains sensitive public wording: ${term}`);
    }
  }
}

async function main() {
  const htmlFiles = await walk(ROOT, (relPath) => relPath.toLowerCase().endsWith(".html"));
  const errors = [];
  const warnings = [];
  const seoEntries = [];
  const incomingLinks = new Map();

  for (const relPath of htmlFiles) {
    const html = await fsp.readFile(path.join(ROOT, relPath), "utf8");
    validateHtml(relPath, html, errors, warnings);
    seoEntries.push(extractSeoMetadata(relPath, html));
    for (const target of collectInternalHtmlTargets(html)) {
      if (target !== relPath) {
        incomingLinks.set(target, (incomingLinks.get(target) || 0) + 1);
      }
    }
  }

  for (const jsonFile of ["blog.json", "cases.json", "package.json", "vercel.json"]) {
    if (fs.existsSync(path.join(ROOT, jsonFile))) {
      await validateJsonFile(jsonFile, errors);
    }
  }

  const sitemapUrls = new Set();
  for (const xmlFile of ["sitemap.xml", "sitemap_local.xml"]) {
    if (!fs.existsSync(path.join(ROOT, xmlFile))) continue;
    const xml = await fsp.readFile(path.join(ROOT, xmlFile), "utf8");
    if (!xml.includes("<urlset") || !xml.includes("</urlset>")) {
      errors.push(`${xmlFile}: missing urlset wrapper`);
    }
    if (xmlFile === "sitemap.xml") {
      for (const match of xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)) {
        sitemapUrls.add(decodeHtmlEntities(match[1]));
      }
    }
  }

  validateSeoEntries(seoEntries, sitemapUrls, incomingLinks, errors);

  console.log(`Validated HTML files: ${htmlFiles.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Errors: ${errors.length}`);

  if (warnings.length) {
    for (const warning of warnings.slice(0, 20)) console.warn(`WARN ${warning}`);
    if (warnings.length > 20) console.warn(`WARN ...and ${warnings.length - 20} more`);
  }

  if (errors.length) {
    for (const error of errors.slice(0, 40)) console.error(`ERROR ${error}`);
    if (errors.length > 40) console.error(`ERROR ...and ${errors.length - 40} more`);
    process.exit(1);
  }
}

await main();
