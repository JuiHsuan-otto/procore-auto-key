import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SITE_HOSTS = new Set(["carkey.com.tw", "www.carkey.com.tw"]);
const EXCLUDED_DIRS = new Set([
  ".git",
  ".uv-cache",
  ".uv-python",
  "backup",
  "backups",
  "drafts",
  "node_modules",
  "secrets",
  "__pycache__",
]);
const IMAGE_RE = /\.(jpe?g|png)$/i;
const IMAGE_ATTR_RE =
  /\b(?:src|href|content)\s*=\s*(["'])([^"']+\.(?:jpe?g|png))(?:[?#][^"']*)?\1/gi;
const IMG_TAG_RE = /<img\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>/gi;
const MAX_WIDTH = Number.parseInt(process.env.PROCORE_IMAGE_MAX_WIDTH || "1600", 10);
const WEBP_QUALITY = Number.parseInt(process.env.PROCORE_WEBP_QUALITY || "78", 10);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function shouldSkipDir(name) {
  return EXCLUDED_DIRS.has(name);
}

async function walk(dir, matcher, output = []) {
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) {
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

function stripQueryHash(value) {
  return value.split(/[?#]/, 1)[0];
}

function localPathFromRef(ref) {
  if (!ref || /^(data|mailto|tel):/i.test(ref) || ref.includes("${") || ref.includes("{{")) {
    return null;
  }

  let candidate = stripQueryHash(ref.trim());
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (!SITE_HOSTS.has(url.hostname)) return null;
      candidate = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    } catch {
      return null;
    }
  } else if (candidate.startsWith("//")) {
    return null;
  } else {
    candidate = decodeURIComponent(candidate.replace(/^\.?\//, ""));
  }

  if (!IMAGE_RE.test(candidate) || candidate.includes("..")) return null;
  const fullPath = path.resolve(ROOT, candidate);
  if (!fullPath.startsWith(ROOT + path.sep)) return null;
  if (!fs.existsSync(fullPath)) return null;
  return toPosix(path.relative(ROOT, fullPath));
}

function webpPathFor(localPath) {
  return localPath.replace(IMAGE_RE, ".webp");
}

function webpRefForSrc(src) {
  const localPath = localPathFromRef(src);
  if (!localPath) return null;
  const webpPath = webpPathFor(localPath);
  if (!fs.existsSync(path.join(ROOT, webpPath))) return null;
  if (src.startsWith("/")) return `/${webpPath}`;
  if (src.startsWith("./")) return `./${webpPath}`;
  if (/^https?:\/\//i.test(src)) {
    try {
      const url = new URL(src);
      url.pathname = `/${webpPath}`;
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return null;
    }
  }
  return webpPath;
}

function isInsidePicture(html, index) {
  const before = html.slice(0, index);
  return before.lastIndexOf("<picture") > before.lastIndexOf("</picture>");
}

function ensureAsyncDecoding(imgTag) {
  if (/\bdecoding\s*=/i.test(imgTag)) return imgTag;
  return imgTag.replace(/\s*\/?>$/, (end) => ` decoding="async"${end}`);
}

function collectReferencedImages(htmlFiles) {
  const refs = new Set();
  for (const relPath of htmlFiles) {
    const html = fs.readFileSync(path.join(ROOT, relPath), "utf8");
    let match;
    while ((match = IMAGE_ATTR_RE.exec(html)) !== null) {
      const localPath = localPathFromRef(match[2]);
      if (localPath) refs.add(localPath);
    }
  }
  return [...refs].sort();
}

async function optimizeImage(relPath) {
  const inputPath = path.join(ROOT, relPath);
  const outputRelPath = webpPathFor(relPath);
  const outputPath = path.join(ROOT, outputRelPath);
  const inputStat = await fsp.stat(inputPath);

  const pipeline = sharp(inputPath, { failOn: "none" }).rotate();
  const metadata = await pipeline.metadata();
  if (metadata.width && metadata.width > MAX_WIDTH) {
    pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  const buffer = await pipeline
    .webp({ quality: WEBP_QUALITY, effort: 5, smartSubsample: true })
    .toBuffer();

  const existingSize = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : Infinity;
  const shouldWrite = buffer.length < inputStat.size * 0.98 && buffer.length !== existingSize;
  if (shouldWrite) {
    await fsp.mkdir(path.dirname(outputPath), { recursive: true });
    await fsp.writeFile(outputPath, buffer);
  }

  return {
    input: relPath,
    output: outputRelPath,
    originalBytes: inputStat.size,
    webpBytes: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : buffer.length,
    written: shouldWrite,
    useful: fs.existsSync(outputPath) && fs.statSync(outputPath).size < inputStat.size,
  };
}

async function optimizeImages(imageRefs) {
  const results = [];
  for (const relPath of imageRefs) {
    try {
      results.push(await optimizeImage(relPath));
    } catch (error) {
      results.push({
        input: relPath,
        output: webpPathFor(relPath),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

function rewriteHtmlImageTags(html, relPath) {
  let changed = false;
  const updated = html.replace(IMG_TAG_RE, (imgTag, quote, src, offset) => {
    if (isInsidePicture(html, offset)) return imgTag;
    const webpRef = webpRefForSrc(src);
    if (!webpRef) return imgTag;
    changed = true;
    const safeImgTag = ensureAsyncDecoding(imgTag);
    const indent = imgTag.match(/^\s*/)?.[0] || "";
    return `${indent}<picture><source srcset="${webpRef}" type="image/webp">${safeImgTag}</picture>`;
  });
  return { relPath, html: updated, changed };
}

async function rewriteHtmlFiles(htmlFiles) {
  const changedFiles = [];
  for (const relPath of htmlFiles) {
    const fullPath = path.join(ROOT, relPath);
    const original = await fsp.readFile(fullPath, "utf8");
    const result = rewriteHtmlImageTags(original, relPath);
    if (result.changed && result.html !== original) {
      await fsp.writeFile(fullPath, result.html, "utf8");
      changedFiles.push(relPath);
    }
  }
  return changedFiles;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "n/a";
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

async function main() {
  const htmlFiles = await walk(ROOT, (relPath) => relPath.toLowerCase().endsWith(".html"));
  const imageRefs = collectReferencedImages(htmlFiles);
  const results = await optimizeImages(imageRefs);
  const changedHtml = await rewriteHtmlFiles(htmlFiles);

  const useful = results.filter((item) => item.useful);
  const originalTotal = useful.reduce((sum, item) => sum + item.originalBytes, 0);
  const webpTotal = useful.reduce((sum, item) => sum + item.webpBytes, 0);
  const saved = originalTotal - webpTotal;
  const errors = results.filter((item) => item.error);

  console.log(`HTML files scanned: ${htmlFiles.length}`);
  console.log(`Referenced raster images: ${imageRefs.length}`);
  console.log(`Useful WebP images: ${useful.length}`);
  console.log(`Estimated bytes saved when WebP is used: ${formatBytes(saved)}`);
  console.log(`HTML files updated with <picture>: ${changedHtml.length}`);

  const topSavings = useful
    .map((item) => ({
      image: item.input,
      original: item.originalBytes,
      webp: item.webpBytes,
      saved: item.originalBytes - item.webpBytes,
    }))
    .sort((a, b) => b.saved - a.saved)
    .slice(0, 12);

  if (topSavings.length) {
    console.table(
      topSavings.map((item) => ({
        image: item.image,
        original: formatBytes(item.original),
        webp: formatBytes(item.webp),
        saved: formatBytes(item.saved),
      })),
    );
  }

  if (errors.length) {
    console.error("Image optimization errors:");
    for (const item of errors) {
      console.error(`- ${item.input}: ${item.error}`);
    }
    process.exitCode = 1;
  }
}

await main();
