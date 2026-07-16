import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getAttr } from "./seo-utils.mjs";

const ROOT = process.cwd();
const BUSINESS_ID = "https://www.carkey.com.tw/#business";
const IMAGE_PILOT_FILES = [
  "index.html",
  "car-key-lost-service.html",
  "article-bmw-smart-key-owner-guide.html",
];
const SERVICE_SCHEMA_FILES = [
  "all-keys-lost-service.html",
  "car-key-duplication-service.html",
  "car-key-shell-replacement-service.html",
  "chip-key-copy-by-mail-service.html",
  "key-not-detected-service.html",
  "non-chip-car-key-duplication-service.html",
  "smart-key-lost-service.html",
  "spare-car-key-service.html",
];
const SCHEMA_FILES = [...IMAGE_PILOT_FILES, ...SERVICE_SCHEMA_FILES];
const EXPECTED_REMOVAL_STAGES = [
  { stage_id: "three-page-pilot", status: "complete", files: IMAGE_PILOT_FILES },
  { stage_id: "service-page-batch", status: "implemented", files: SERVICE_SCHEMA_FILES },
];

function walkJson(value, visit, jsonPath = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, visit, `${jsonPath}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  visit(value, jsonPath);
  for (const [key, item] of Object.entries(value)) {
    walkJson(item, visit, `${jsonPath}.${key}`);
  }
}

function extractJsonLd(html, relPath, errors) {
  const payloads = [];
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const openTag = match[0].slice(0, match[0].indexOf(">") + 1);
    if (getAttr(openTag, "type")?.toLowerCase() !== "application/ld+json") continue;
    try {
      payloads.push(JSON.parse(match[1]));
    } catch (error) {
      errors.push(`${relPath}: invalid JSON-LD (${error.message})`);
    }
  }
  if (!payloads.length) errors.push(`${relPath}: no JSON-LD blocks found`);
  return payloads;
}

function validateSchemaPayloads(payloads, relPath, errors) {
  let businessNodes = 0;
  for (const payload of payloads) {
    walkJson(payload, (node, jsonPath) => {
      if (Object.hasOwn(node, "priceRange")) {
        errors.push(`${relPath}: unsupported priceRange remains at ${jsonPath}`);
      }
      if (node["@id"] === BUSINESS_ID && Object.hasOwn(node, "@type")) businessNodes += 1;
    });
  }
  if (businessNodes !== 1) {
    errors.push(`${relPath}: expected exactly one shared business node, found ${businessNodes}`);
  }
}

function withoutPriceRange(value) {
  const copy = structuredClone(value);
  walkJson(copy, (node) => {
    delete node.priceRange;
  });
  return copy;
}

function compareWithHead(currentHtml, currentPayloads, relPath, errors) {
  let headHtml;
  try {
    headHtml = execFileSync("git", ["show", `HEAD:${relPath}`], { encoding: "utf8" });
  } catch (error) {
    errors.push(`${relPath}: cannot read HEAD baseline (${error.message})`);
    return;
  }
  const headErrors = [];
  const headPayloads = extractJsonLd(headHtml, `HEAD:${relPath}`, headErrors);
  errors.push(...headErrors);
  try {
    assert.deepEqual(currentPayloads, withoutPriceRange(headPayloads));
  } catch {
    errors.push(`${relPath}: JSON-LD changed beyond removal of priceRange from the HEAD baseline`);
  }

  const expectedHtml = headHtml
    .replaceAll(',"priceRange":"$$"', "")
    .replace(/^\s*"priceRange": "\$\$",\r?\n/gm, "");
  if (currentHtml !== expectedHtml) {
    errors.push(`${relPath}: HTML changed beyond removal of priceRange from the HEAD baseline`);
  }
}

function classifyImageSource(src) {
  if (!src || src.includes("${")) return "dynamic";
  if (/^(?:https?:)?\/\//i.test(src) || /^data:/i.test(src)) return "external";
  return "local";
}

async function validateImages(html, relPath, errors, stats) {
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const src = getAttr(tag, "src");
    const sourceType = classifyImageSource(src);
    if (sourceType !== "local") {
      stats[`${sourceType}Skipped`] += 1;
      continue;
    }

    const cleanSrc = decodeURIComponent(src.split(/[?#]/, 1)[0]);
    const assetPath = cleanSrc.startsWith("/")
      ? path.join(ROOT, cleanSrc.slice(1))
      : path.resolve(ROOT, path.dirname(relPath), cleanSrc);
    if (!assetPath.startsWith(`${ROOT}${path.sep}`)) {
      errors.push(`${relPath}: local image escapes repository root (${src})`);
      continue;
    }

    let metadata;
    try {
      metadata = await sharp(assetPath).metadata();
    } catch (error) {
      errors.push(`${relPath}: cannot resolve local image ${src} (${error.message})`);
      continue;
    }
    const width = Number(getAttr(tag, "width"));
    const height = Number(getAttr(tag, "height"));
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      errors.push(`${relPath}: local image ${src} is missing integer width/height`);
      continue;
    }
    if (width !== metadata.width || height !== metadata.height) {
      errors.push(`${relPath}: local image ${src} declares ${width}x${height}, actual ${metadata.width}x${metadata.height}`);
      continue;
    }
    stats.localVerified += 1;
  }
}

async function validateHomepageCaseImages(html, errors, stats) {
  const dataMatch = html.match(/const latestCases\s*=\s*(\[[\s\S]*?\]);/);
  if (!dataMatch) {
    errors.push("index.html: latestCases data is missing");
    return;
  }
  let cases;
  try {
    cases = JSON.parse(dataMatch[1]);
  } catch (error) {
    errors.push(`index.html: latestCases is not valid JSON (${error.message})`);
    return;
  }
  if (!html.includes("const renderCaseImage = (src, alt, width, height) =>")) {
    errors.push("index.html: runtime case image renderer must accept intrinsic dimensions");
  }
  if (!html.includes('width="${escapeHtml(width)}" height="${escapeHtml(height)}"')) {
    errors.push("index.html: runtime case image renderer must emit escaped width/height attributes");
  }
  if (!html.includes("renderCaseImage(c.img, c.car, c.width, c.height)")) {
    errors.push("index.html: runtime case image call must pass governed dimensions");
  }

  for (const item of cases) {
    const assetPath = path.join(ROOT, item.img || "");
    let metadata;
    try {
      metadata = await sharp(assetPath).metadata();
    } catch (error) {
      errors.push(`index.html: cannot resolve latestCases image ${item.img || "(missing)"} (${error.message})`);
      continue;
    }
    if (item.width !== metadata.width || item.height !== metadata.height) {
      errors.push(`index.html: latestCases image ${item.img} declares ${item.width}x${item.height}, actual ${metadata.width}x${metadata.height}`);
      continue;
    }
    stats.runtimeLocalVerified += 1;
  }
}

function validateBusinessGate(business, errors) {
  const priceRange = business?.fields?.priceRange;
  if (!priceRange || priceRange.value !== null || priceRange.status !== "unverified" || priceRange.publish !== false) {
    errors.push("data/business-entity.json: priceRange must remain null, unverified, and unpublished");
  }
  const migration = priceRange?.legacy_observation;
  if (JSON.stringify(migration?.removal_stages) !== JSON.stringify(EXPECTED_REMOVAL_STAGES)) {
    errors.push("data/business-entity.json: priceRange removal stage order/scope drifted");
  }
  if (migration?.expected_remaining_after_current_stage !== 123 || migration?.rollout_status !== "service_pages_only") {
    errors.push("data/business-entity.json: priceRange service-page rollout count/status drifted");
  }
}

function runSelfTests() {
  const badBusiness = {
    fields: {
      priceRange: {
        value: "$$",
        status: "verified",
        publish: true,
        legacy_observation: {
          removal_stages: EXPECTED_REMOVAL_STAGES,
          expected_remaining_after_current_stage: 123,
          rollout_status: "service_pages_only",
        },
      },
    },
  };
  const gateErrors = [];
  validateBusinessGate(badBusiness, gateErrors);
  assert.equal(gateErrors.length, 1);

  const schemaErrors = [];
  validateSchemaPayloads([{ "@id": BUSINESS_ID, priceRange: "$$" }], "fixture.html", schemaErrors);
  assert(schemaErrors.some((error) => error.includes("unsupported priceRange")));
  assert.equal(classifyImageSource("${escapeHtml(src)}"), "dynamic");
  assert.equal(classifyImageSource("https://example.com/image.svg"), "external");
  assert.equal(classifyImageSource("img/local.jpg"), "local");
  console.log("Schema/image pilot negative-gate checks passed: 3");
}

async function main() {
  const errors = [];
  const stats = { localVerified: 0, runtimeLocalVerified: 0, externalSkipped: 0, dynamicSkipped: 0 };
  const business = JSON.parse(await fsp.readFile(path.join(ROOT, "data/business-entity.json"), "utf8"));
  validateBusinessGate(business, errors);

  for (const relPath of SCHEMA_FILES) {
    const html = await fsp.readFile(path.join(ROOT, relPath), "utf8");
    const payloads = extractJsonLd(html, relPath, errors);
    validateSchemaPayloads(payloads, relPath, errors);
    if (process.argv.includes("--compare-head")) compareWithHead(html, payloads, relPath, errors);
    if (IMAGE_PILOT_FILES.includes(relPath)) {
      await validateImages(html, relPath, errors, stats);
      if (relPath === "index.html") await validateHomepageCaseImages(html, errors, stats);
    }
  }

  if (process.argv.includes("--self-test")) runSelfTests();

  console.log("CarKey schema rollout/image pilot validation");
  console.log(`Schema pages: ${SCHEMA_FILES.length}`);
  console.log(`Image pilot pages: ${IMAGE_PILOT_FILES.length}`);
  console.log(`Local images verified against file metadata: ${stats.localVerified}`);
  console.log(`Runtime case images verified against file metadata: ${stats.runtimeLocalVerified}`);
  console.log(`External images skipped: ${stats.externalSkipped}`);
  console.log(`Dynamic image templates skipped: ${stats.dynamicSkipped}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exit(1);
  }
}

await main();
