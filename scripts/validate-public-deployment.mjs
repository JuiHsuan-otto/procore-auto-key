import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const REQUIRED_IGNORE_RULES = [
  "/data/",
  "/scripts/",
  "/masking_tool.js",
  "/masking_tool_fixed.js",
  "/requirements-content-ops.txt",
  "/*.example.json",
  "/content_platforms.json",
  "/seo_config.json",
  "/llms.txt",
  "/tailwind.config.js",
  "/assets/css/tailwind-source.css",
  "/img/*.HEIC",
  "/img/*.heic",
];

const PROTECTED_PUBLIC_PATHS = [
  "masking_tool.js",
  "masking_tool_fixed.js",
  "requirements-content-ops.txt",
  "case_intake.example.json",
  "content_queue.example.json",
  "content_platforms.json",
  "seo_config.json",
  "llms.txt",
  "tailwind.config.js",
  "assets/css/tailwind-source.css",
];

const PUBLIC_SOURCE_FILES = [
  "blog.json",
  "cases.json",
  "robots.txt",
  "sitemap.xml",
];

const PUBLIC_SOURCE_DIRS = ["assets/css", "assets/js"];
const PUBLIC_SOURCE_EXTENSIONS = new Set([".html", ".css", ".js", ".json", ".txt", ".xml"]);
const LOCAL_PATH_PATTERNS = [
  { name: "macOS user directory", pattern: /\/Users\/[A-Za-z0-9._-]+\// },
  { name: "Windows user directory", pattern: /[A-Za-z]:[\\/]Users[\\/]/i },
  { name: "Windows drive workspace", pattern: /[A-Za-z]:[\\/](?:OneDrive|procore-repo|AI-Workspace)[\\/]/i },
];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function referencesProtectedPath(source, protectedPath) {
  return source.includes(`/${protectedPath}`) || source.includes(`\"${protectedPath}\"`) || source.includes(`'${protectedPath}'`);
}

function findLocalPathMarker(source) {
  return LOCAL_PATH_PATTERNS.find((marker) => marker.pattern.test(source));
}

async function walk(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, output);
    } else if (entry.isFile() && PUBLIC_SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      output.push(toPosix(path.relative(ROOT, fullPath)));
    }
  }
  return output;
}

async function collectPublicSourceFiles() {
  const files = new Set(PUBLIC_SOURCE_FILES.filter((relPath) => fs.existsSync(path.join(ROOT, relPath))));
  for (const entry of await fsp.readdir(ROOT, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) files.add(entry.name);
  }
  for (const relDir of PUBLIC_SOURCE_DIRS) {
    for (const relPath of await walk(path.join(ROOT, relDir))) files.add(relPath);
  }
  return [...files].filter((relPath) => !PROTECTED_PUBLIC_PATHS.includes(relPath)).sort();
}

function runSelfTests(ignoreRules) {
  const missingRuleFixture = new Set(ignoreRules);
  missingRuleFixture.delete(REQUIRED_IGNORE_RULES[0]);
  if (REQUIRED_IGNORE_RULES.every((rule) => missingRuleFixture.has(rule))) {
    throw new Error("Deployment-boundary self-test did not reject a missing ignore rule");
  }
  if (!referencesProtectedPath('<script src="/masking_tool.js"></script>', "masking_tool.js")) {
    throw new Error("Deployment-boundary self-test did not detect a protected public reference");
  }
  if (!findLocalPathMarker("C:\\Users\\example\\OneDrive\\site")) {
    throw new Error("Deployment-boundary self-test did not detect a local filesystem path");
  }
  console.log("Public deployment boundary negative-gate checks passed: 3");
}

async function main() {
  const errors = [];
  const warnings = [];
  const vercelIgnore = await fsp.readFile(path.join(ROOT, ".vercelignore"), "utf8");
  const ignoreRules = new Set(
    vercelIgnore
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );

  for (const rule of REQUIRED_IGNORE_RULES) {
    if (!ignoreRules.has(rule)) errors.push(`.vercelignore: missing required non-public rule ${rule}`);
  }

  const vercelConfig = JSON.parse(await fsp.readFile(path.join(ROOT, "vercel.json"), "utf8"));
  const vercelConfigText = JSON.stringify(vercelConfig);
  for (const relPath of PROTECTED_PUBLIC_PATHS) {
    if (vercelConfigText.includes(`/${relPath}`)) {
      errors.push(`vercel.json: protected source-only path must not have a public route or header rule: /${relPath}`);
    }
  }

  const sitemap = await fsp.readFile(path.join(ROOT, "sitemap.xml"), "utf8");
  for (const relPath of PROTECTED_PUBLIC_PATHS) {
    if (sitemap.includes(`/${relPath}`)) errors.push(`sitemap.xml: source-only path must not be listed: /${relPath}`);
  }

  const publicFiles = await collectPublicSourceFiles();
  for (const relPath of publicFiles) {
    const source = await fsp.readFile(path.join(ROOT, relPath), "utf8");
    for (const protectedPath of PROTECTED_PUBLIC_PATHS) {
      if (referencesProtectedPath(source, protectedPath)) {
        errors.push(`${relPath}: public source references protected source-only file ${protectedPath}`);
      }
    }
    const localPathMarker = findLocalPathMarker(source);
    if (localPathMarker) errors.push(`${relPath}: public source contains a ${localPathMarker.name}`);
  }

  const heicFiles = (await fsp.readdir(path.join(ROOT, "img"))).filter((name) => /\.heic$/i.test(name));
  if (!heicFiles.length) warnings.push("img/: no HEIC source files found; exclusion rules remain as a regression guard");

  console.log("CarKey public deployment boundary validation");
  console.log(`Required non-public rules: ${REQUIRED_IGNORE_RULES.length}`);
  console.log(`Protected explicit paths: ${PROTECTED_PUBLIC_PATHS.length}`);
  console.log(`Public source files scanned: ${publicFiles.length}`);
  console.log(`HEIC source files protected: ${heicFiles.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Errors: ${errors.length}`);
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  if (process.argv.includes("--self-test")) runSelfTests(ignoreRules);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exit(1);
  }
}

await main();
