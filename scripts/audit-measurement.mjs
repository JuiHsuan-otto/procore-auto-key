import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TRACKING_SCRIPT = "/assets/js/procore-conversion-tracking.js";
const TRACKING_SOURCE = "assets/js/procore-conversion-tracking.js";
const REQUIRED_TRACKING_TOKENS = [
  "G-KW1LHLVQHL",
  "procore_phone_click",
  "procore_line_click",
  "click_to_call",
  "line_click",
  "generate_lead",
  "transport_type",
];
const EXCLUDED_DIRS = new Set([
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
    if (!entry.isFile()) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = toPosix(path.relative(ROOT, fullPath));
    if (matcher(relPath)) output.push(relPath);
  }
  return output;
}

function countMatches(html, pattern) {
  return (html.match(pattern) || []).length;
}

function getTitle(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return "";
  return match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function getRoute(relPath) {
  if (relPath === "index.html") return "/";
  return `/${relPath.replace(/\.html$/i, "")}`;
}

function printRows(rows, fields) {
  if (!rows.length) return;
  console.table(rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field]]))));
}

async function auditTrackingSource(errors) {
  const sourcePath = path.join(ROOT, TRACKING_SOURCE);
  if (!fs.existsSync(sourcePath)) {
    errors.push(`Missing tracking source: ${TRACKING_SOURCE}`);
    return;
  }

  const source = await fsp.readFile(sourcePath, "utf8");
  for (const token of REQUIRED_TRACKING_TOKENS) {
    if (!source.includes(token)) {
      errors.push(`${TRACKING_SOURCE}: missing required token ${token}`);
    }
  }
}

async function main() {
  const errors = [];
  const warnings = [];
  const htmlFiles = await walk(ROOT, (relPath) => relPath.toLowerCase().endsWith(".html"));
  const rows = [];

  await auditTrackingSource(errors);

  for (const relPath of htmlFiles) {
    const html = await fsp.readFile(path.join(ROOT, relPath), "utf8");
    const trackingCount = countMatches(html, new RegExp(TRACKING_SCRIPT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
    const telCount = countMatches(html, /href=["']tel:/gi);
    const lineCount = countMatches(html, /href=["']https?:\/\/(?:line\.me|lin\.ee)\//gi);
    const route = getRoute(relPath);

    if (trackingCount !== 1) {
      errors.push(`${relPath}: expected exactly one tracking script, found ${trackingCount}`);
    }

    if (telCount === 0) {
      warnings.push(`${relPath}: no phone CTA`);
    }

    if (lineCount === 0) {
      warnings.push(`${relPath}: no LINE CTA`);
    }

    rows.push({
      file: relPath,
      route,
      title: getTitle(html),
      trackingCount,
      telCount,
      lineCount,
    });
  }

  const totalTelLinks = rows.reduce((sum, row) => sum + row.telCount, 0);
  const totalLineLinks = rows.reduce((sum, row) => sum + row.lineCount, 0);
  const pagesWithPhone = rows.filter((row) => row.telCount > 0).length;
  const pagesWithLine = rows.filter((row) => row.lineCount > 0).length;
  const noLineRows = rows.filter((row) => row.lineCount === 0).slice(0, 20);
  const noPhoneRows = rows.filter((row) => row.telCount === 0).slice(0, 20);

  console.log("ProCore measurement audit");
  console.log(`HTML files: ${rows.length}`);
  console.log(`Pages with tracking: ${rows.filter((row) => row.trackingCount === 1).length}`);
  console.log(`Pages with phone CTA: ${pagesWithPhone}`);
  console.log(`Pages with LINE CTA: ${pagesWithLine}`);
  console.log(`Phone CTA links: ${totalTelLinks}`);
  console.log(`LINE CTA links: ${totalLineLinks}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Errors: ${errors.length}`);

  if (noPhoneRows.length) {
    console.log("\nPages without phone CTA (first 20):");
    printRows(noPhoneRows, ["file", "route", "title"]);
  }

  if (noLineRows.length) {
    console.log("\nPages without LINE CTA (first 20):");
    printRows(noLineRows, ["file", "route", "title"]);
  }

  if (errors.length) {
    console.error("\nErrors:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
}

await main();
