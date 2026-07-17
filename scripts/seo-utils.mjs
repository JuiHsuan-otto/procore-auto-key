import fsp from "node:fs/promises";
import path from "node:path";

export const SITE_ORIGIN = "https://www.carkey.com.tw";
export const SITE_HOSTS = new Set(["carkey.com.tw", "www.carkey.com.tw"]);
export const EXCLUDED_DIRS = new Set([
  ".git",
  ".uv-cache",
  ".uv-python",
  "backup",
  "backups",
  "drafts",
  "local",
  "logs",
  "node_modules",
  "secrets",
  "__pycache__",
]);

export function toPosix(value) {
  return value.split(path.sep).join("/");
}

export async function walkFiles(root, matcher, dir = root, output = []) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, "en"));

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        await walkFiles(root, matcher, path.join(dir, entry.name), output);
      }
      continue;
    }
    if (!entry.isFile()) continue;

    const relPath = toPosix(path.relative(root, path.join(dir, entry.name)));
    if (matcher(relPath)) output.push(relPath);
  }

  return output;
}

export function decodeHtmlEntities(value = "") {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

export function getAttr(tag, attrName) {
  const quoted = tag.match(new RegExp(`\\b${attrName}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  if (quoted) return decodeHtmlEntities(quoted[2]);
  const unquoted = tag.match(new RegExp(`\\b${attrName}\\s*=\\s*([^\\s>]+)`, "i"));
  return unquoted ? decodeHtmlEntities(unquoted[1]) : "";
}

export function getTitle(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "")) : "";
}

export function getFirstHeading(html, level = 1) {
  const match = html.match(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "i"));
  return match ? decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " ")) : "";
}

export function getMetaContent(html, attrName, attrValue) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (getAttr(match[0], attrName).toLowerCase() === attrValue.toLowerCase()) {
      return getAttr(match[0], "content");
    }
  }
  return "";
}

export function getCanonical(html) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = getAttr(match[0], "rel").toLowerCase().split(/\s+/);
    if (rel.includes("canonical")) return getAttr(match[0], "href");
  }
  return "";
}

export function fileToRoute(relPath) {
  if (relPath === "index.html") return "/";
  if (relPath.endsWith("/index.html")) return `/${relPath.slice(0, -"/index.html".length)}`;
  return `/${relPath.replace(/\.html$/i, "")}`;
}

export function routeToFile(route) {
  if (route === "/") return "index.html";
  return `${route.replace(/^\//, "")}.html`;
}

export function normalizeInternalRoute(href) {
  if (!href || /^(#|data:|mailto:|tel:|sms:|javascript:)/i.test(href)) return null;
  let pathname;

  try {
    if (/^https?:\/\//i.test(href)) {
      const url = new URL(href);
      if (!SITE_HOSTS.has(url.hostname)) return null;
      pathname = url.pathname;
    } else if (href.startsWith("//")) {
      return null;
    } else {
      pathname = href.split(/[?#]/, 1)[0];
    }
  } catch {
    return null;
  }

  if (!pathname) return "/";
  let route = pathname.startsWith("/") ? pathname : `/${pathname.replace(/^\.\//, "")}`;
  route = decodeURIComponent(route).replace(/\/index\.html$/i, "/").replace(/\.html$/i, "");
  if (route.length > 1) route = route.replace(/\/$/, "");
  return route;
}

export function collectInternalRoutes(html) {
  const routes = new Set();
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const route = normalizeInternalRoute(getAttr(match[0], "href"));
    if (route) routes.add(route);
  }
  return [...routes].sort((a, b) => a.localeCompare(b, "en"));
}

function appendRootTypes(value, output) {
  if (Array.isArray(value)) {
    for (const item of value) appendRootTypes(item, output);
    return;
  }
  if (!value || typeof value !== "object") return;

  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  for (const type of types.filter(Boolean)) output.add(String(type));
  if (Array.isArray(value["@graph"])) {
    for (const node of value["@graph"]) appendRootTypes(node, output);
  }
}

export function getRootJsonLdTypes(html) {
  const types = new Set();
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      appendRootTypes(JSON.parse(match[1]), types);
    } catch {
      // The site validator reports malformed JSON-LD. Inventory generation remains deterministic.
    }
  }
  return [...types].sort((a, b) => a.localeCompare(b, "en"));
}

export function getImageStats(html) {
  const stats = { total: 0, missingAlt: 0, missingWidth: 0, missingHeight: 0, missingLoading: 0 };
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    stats.total += 1;
    if (!/\balt\s*=/i.test(tag) || !getAttr(tag, "alt")) stats.missingAlt += 1;
    if (!getAttr(tag, "width")) stats.missingWidth += 1;
    if (!getAttr(tag, "height")) stats.missingHeight += 1;
    if (!getAttr(tag, "loading")) stats.missingLoading += 1;
  }
  return stats;
}

export function parseSitemapEntries(xml) {
  const entries = [];
  for (const match of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)) {
    const block = match[1];
    const loc = block.match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/i);
    const lastmod = block.match(/<lastmod\b[^>]*>([\s\S]*?)<\/lastmod>/i);
    entries.push({
      loc: loc ? decodeHtmlEntities(loc[1]) : "",
      lastmod: lastmod ? decodeHtmlEntities(lastmod[1]) : "",
    });
  }
  return entries;
}

export function auditSitemapXml(xml, { knownCanonicals = new Set(), today } = {}) {
  const errors = [];
  const entries = parseSitemapEntries(xml);
  const counts = new Map();

  if (!/^\s*<\?xml\b[^>]*\?>/i.test(xml)) errors.push("missing XML declaration");
  if (!/<urlset\b[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["'][^>]*>/i.test(xml)) {
    errors.push("missing sitemap urlset namespace");
  }
  if (!/<\/urlset>\s*$/i.test(xml)) errors.push("missing closing urlset");

  for (const [index, entry] of entries.entries()) {
    const label = entry.loc || `entry ${index + 1}`;
    if (!entry.loc) {
      errors.push(`entry ${index + 1}: missing loc`);
      continue;
    }
    counts.set(entry.loc, (counts.get(entry.loc) || 0) + 1);

    try {
      const url = new URL(entry.loc);
      if (url.origin !== SITE_ORIGIN) errors.push(`${label}: expected origin ${SITE_ORIGIN}`);
      if (url.search || url.hash) errors.push(`${label}: sitemap URL must not contain query or fragment`);
      if (/\.html$/i.test(url.pathname)) errors.push(`${label}: sitemap URL must be a clean route`);
      if (url.pathname.length > 1 && url.pathname.endsWith("/")) errors.push(`${label}: trailing slash is not canonical`);
    } catch {
      errors.push(`${label}: invalid absolute URL`);
    }

    if (!entry.lastmod) {
      errors.push(`${label}: missing lastmod`);
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod)) {
      errors.push(`${label}: lastmod must use YYYY-MM-DD`);
    } else if (today && entry.lastmod > today) {
      errors.push(`${label}: future lastmod ${entry.lastmod} exceeds ${today}`);
    }

    if (knownCanonicals.size && !knownCanonicals.has(entry.loc)) {
      errors.push(`${label}: sitemap URL has no matching indexable canonical HTML file`);
    }
  }

  for (const [loc, count] of counts.entries()) {
    if (count > 1) errors.push(`${loc}: duplicate loc appears ${count} times`);
  }

  return { entries, errors };
}

export function csvEscape(value) {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
