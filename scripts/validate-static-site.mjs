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

  for (const relPath of htmlFiles) {
    const html = await fsp.readFile(path.join(ROOT, relPath), "utf8");
    validateHtml(relPath, html, errors, warnings);
  }

  for (const jsonFile of ["blog.json", "cases.json", "package.json", "vercel.json"]) {
    if (fs.existsSync(path.join(ROOT, jsonFile))) {
      await validateJsonFile(jsonFile, errors);
    }
  }

  for (const xmlFile of ["sitemap.xml", "sitemap_local.xml"]) {
    if (!fs.existsSync(path.join(ROOT, xmlFile))) continue;
    const xml = await fsp.readFile(path.join(ROOT, xmlFile), "utf8");
    if (!xml.includes("<urlset") || !xml.includes("</urlset>")) {
      errors.push(`${xmlFile}: missing urlset wrapper`);
    }
  }

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
