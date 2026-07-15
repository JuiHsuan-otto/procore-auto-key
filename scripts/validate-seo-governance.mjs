import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { getAttr, walkFiles } from "./seo-utils.mjs";

const ROOT = process.cwd();
const BUSINESS_FILE = "data/business-entity.json";
const METRICS_FILE = "data/business-metrics.json";
const THIRD_PARTY_FILE = "data/third-party-scripts.json";
const REQUIRED_DOCS = [
  "docs/seo-engineering/content-entity-model.md",
  "docs/seo-engineering/human-input-register.md",
  "docs/seo-engineering/location-page-decision-framework.md",
  "docs/seo-engineering/seo-governance.md",
  "docs/seo-engineering/third-party-script-decision.md",
];

async function readJson(relPath, errors) {
  try {
    return JSON.parse(await fsp.readFile(path.join(ROOT, relPath), "utf8"));
  } catch (error) {
    errors.push(`${relPath}: ${error.message}`);
    return null;
  }
}

function hasEvidence(field) {
  return Boolean(field.source && field.verified_by && field.verified_at);
}

function validateBusinessEntity(data, errors, warnings) {
  if (!data) return;
  const fields = data.fields || {};
  const requiredFields = [
    "legalName", "publicBrandName", "alternateName", "domain", "url", "logo", "telephone", "line",
    "address", "serviceArea", "sameAs", "gbpUrl", "taxID", "openingHours", "priceRange",
  ];
  const types = data.schema_identity?.types || [];

  if (data.schema_identity?.id !== "https://www.carkey.com.tw/#business") {
    errors.push(`${BUSINESS_FILE}: schema_identity.id must use the canonical shared business @id`);
  }
  if (!types.includes("Organization") || !types.includes("LocalBusiness")) {
    errors.push(`${BUSINESS_FILE}: shared business node must include Organization and LocalBusiness types`);
  }

  for (const name of requiredFields) {
    const field = fields[name];
    if (!field) {
      errors.push(`${BUSINESS_FILE}: missing field ${name}`);
      continue;
    }
    if (!new Set(["verified", "unverified"]).has(field.status)) {
      errors.push(`${BUSINESS_FILE}: ${name}.status must be verified or unverified`);
    }
    if (typeof field.publish !== "boolean") errors.push(`${BUSINESS_FILE}: ${name}.publish must be boolean`);
    if (field.publish && (field.status !== "verified" || field.value == null || !hasEvidence(field))) {
      errors.push(`${BUSINESS_FILE}: ${name} cannot publish without verified value and evidence`);
    }
    if (!field.publish && field.status === "verified") {
      warnings.push(`${BUSINESS_FILE}: verified field ${name} is intentionally not publishable`);
    }
  }

  if (fields.priceRange?.value !== null || fields.priceRange?.publish !== false) {
    errors.push(`${BUSINESS_FILE}: priceRange must remain null and unpublished until human evidence exists`);
  }
  if (fields.legalName?.value !== null || fields.publicBrandName?.value !== null) {
    errors.push(`${BUSINESS_FILE}: legalName and publicBrandName require an explicit human decision`);
  }

  const migration = fields.priceRange?.legacy_observation;
  if (!migration || typeof migration !== "object") {
    errors.push(`${BUSINESS_FILE}: priceRange legacy_observation must record the controlled migration`);
  } else {
    const pilotFiles = migration.pilot_removed_files || [];
    if (migration.baseline_count !== 134 || migration.expected_remaining_after_pilot !== 131) {
      errors.push(`${BUSINESS_FILE}: priceRange pilot must preserve the 134-file baseline and 131-file remainder`);
    }
    if (pilotFiles.length !== 3 || new Set(pilotFiles).size !== 3) {
      errors.push(`${BUSINESS_FILE}: priceRange pilot must identify exactly three unique files`);
    }
    if (migration.rollout_status !== "pilot_only") {
      errors.push(`${BUSINESS_FILE}: priceRange migration must remain pilot_only until a separate rollout is approved`);
    }
  }
}

function validateMetrics(data, indexHtml, errors, warnings) {
  if (!data) return;
  const metrics = data.metrics || [];
  const ids = new Set();
  const publicEvidenceFields = [
    "value", "source", "calculation_method", "evidence_location", "verified_by", "verified_at", "last_updated",
  ];

  for (const metric of metrics) {
    if (!metric.metric_id || ids.has(metric.metric_id)) {
      errors.push(`${METRICS_FILE}: missing or duplicate metric_id ${metric.metric_id || "(empty)"}`);
    }
    ids.add(metric.metric_id);
    if (!metric.label || !metric.unit || !metric.fallback_text) {
      errors.push(`${METRICS_FILE}: ${metric.metric_id} requires label, unit, and fallback_text`);
    }
    if (!new Set(["hidden", "draft", "public"]).has(metric.display_status)) {
      errors.push(`${METRICS_FILE}: ${metric.metric_id} has invalid display_status`);
    }
    if (metric.display_status === "public") {
      for (const field of publicEvidenceFields) {
        if (metric[field] == null || metric[field] === "") {
          errors.push(`${METRICS_FILE}: public metric ${metric.metric_id} is missing ${field}`);
        }
      }
    }
    if (metric.display_status === "hidden" && metric.value !== null) {
      errors.push(`${METRICS_FILE}: hidden metric ${metric.metric_id} must not carry a publishable value`);
    }
    if (/\d/.test(metric.fallback_text)) {
      errors.push(`${METRICS_FILE}: ${metric.metric_id} fallback_text must be non-numeric`);
    }
  }

  const counterPattern = /<div\b[^>]*class=["'][^"']*\bcounter\b[^"']*["'][^>]*data-target=["'](\d+)["'][^>]*>([^<]*)<\/div>\s*<div\b[^>]*>([^<]+)<\/div>/gi;
  const counters = [...indexHtml.matchAll(counterPattern)].map((match) => ({
    target: Number(match[1]),
    sourceText: match[2].trim(),
    label: match[3].trim(),
  }));

  if (counters.length !== metrics.length) {
    errors.push(`${METRICS_FILE}: registered ${metrics.length} metrics but found ${counters.length} legacy counters`);
  }
  for (const metric of metrics) {
    const counter = counters.find((item) => item.label === metric.label);
    if (!counter) {
      errors.push(`index.html: no counter matches registered metric label ${metric.label}`);
      continue;
    }
    if (counter.target !== metric.legacy_unverified_value) {
      errors.push(`index.html: ${metric.label} data-target changed without metric evidence review`);
    }
    if (counter.sourceText !== "0") {
      errors.push(`index.html: ${metric.label} legacy source placeholder changed outside the counter migration`);
    }
  }
  if (counters.length) {
    warnings.push(`index.html: ${counters.length} legacy counters remain unresolved and must not be treated as verified metrics`);
  }
}

async function collectThirdPartyPages(src) {
  const htmlFiles = await walkFiles(ROOT, (relPath) => relPath.toLowerCase().endsWith(".html"));
  const pages = [];
  for (const relPath of htmlFiles) {
    const html = await fsp.readFile(path.join(ROOT, relPath), "utf8");
    for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi)) {
      if (getAttr(match[0], "src") === src) pages.push(relPath);
    }
  }
  return pages.sort((a, b) => a.localeCompare(b, "en"));
}

async function validateThirdParty(data, vercelConfig, errors, warnings) {
  if (!data) return;
  const csp = (vercelConfig.headers || [])
    .flatMap((entry) => entry.headers || [])
    .filter((header) => header.key?.toLowerCase() === "content-security-policy")
    .map((header) => header.value || "")
    .join(" ");
  for (const script of data.scripts || []) {
    const actualPages = await collectThirdPartyPages(script.src);
    const allowedPages = [...(script.current_page_allowlist || [])].sort((a, b) => a.localeCompare(b, "en"));
    if (JSON.stringify(actualPages) !== JSON.stringify(allowedPages)) {
      errors.push(`${THIRD_PARTY_FILE}: ${script.script_id} page allowlist drift (${actualPages.join(", ")})`);
    }
    if (script.decision === "pending_owner_privacy_review" && script.new_page_expansion_allowed !== false) {
      errors.push(`${THIRD_PARTY_FILE}: pending script ${script.script_id} must block new page expansion`);
    }
    if (script.decision === "approved") {
      for (const field of ["owner", "business_purpose_approved_by", "contract_or_terms_evidence", "retention_policy", "privacy_disclosure"]) {
        if (!script[field]) errors.push(`${THIRD_PARTY_FILE}: approved script ${script.script_id} is missing ${field}`);
      }
    }
    if (script.mutable || !script.version || !script.integrity) {
      warnings.push(`${THIRD_PARTY_FILE}: ${script.script_id} remains mutable/unversioned without integrity pinning`);
    }
    if (actualPages.length) {
      for (const origin of [new URL(script.src).origin, new URL(script.endpoint).origin]) {
        if (!csp.includes(origin)) errors.push(`vercel.json: CSP does not allow governed script origin ${origin}`);
      }
    }
  }
}

async function runSelfTests(business, metrics, thirdParty, indexHtml, vercelConfig) {
  const gateErrors = [];
  const gateWarnings = [];

  const badBusiness = structuredClone(business);
  badBusiness.fields.legalName = {
    value: "Invented Legal Name",
    status: "unverified",
    publish: true,
    source: null,
    verified_by: null,
    verified_at: null,
  };
  validateBusinessEntity(badBusiness, gateErrors, gateWarnings);

  const badMetrics = structuredClone(metrics);
  badMetrics.metrics[0].display_status = "public";
  badMetrics.metrics[0].value = 9999;
  validateMetrics(badMetrics, indexHtml, gateErrors, gateWarnings);

  const badThirdParty = structuredClone(thirdParty);
  badThirdParty.scripts[0].new_page_expansion_allowed = true;
  await validateThirdParty(badThirdParty, vercelConfig, gateErrors, gateWarnings);

  const expectedFailures = [
    "legalName cannot publish without verified value and evidence",
    "public metric vehicles_served is missing source",
    "pending script washinmura-aeo-crawler-track must block new page expansion",
  ];
  for (const expected of expectedFailures) {
    if (!gateErrors.some((error) => error.includes(expected))) {
      throw new Error(`Governance self-test did not reject: ${expected}`);
    }
  }
  console.log(`Governance negative-gate checks passed: ${expectedFailures.length}`);
}

async function main() {
  const errors = [];
  const warnings = [];
  const [business, metrics, thirdParty, indexHtml, vercelIgnore, vercelConfig] = await Promise.all([
    readJson(BUSINESS_FILE, errors),
    readJson(METRICS_FILE, errors),
    readJson(THIRD_PARTY_FILE, errors),
    fsp.readFile(path.join(ROOT, "index.html"), "utf8"),
    fsp.readFile(path.join(ROOT, ".vercelignore"), "utf8"),
    readJson("vercel.json", errors),
  ]);

  validateBusinessEntity(business, errors, warnings);
  validateMetrics(metrics, indexHtml, errors, warnings);
  await validateThirdParty(thirdParty, vercelConfig || {}, errors, warnings);

  const htmlFiles = await walkFiles(ROOT, (relPath) => relPath.toLowerCase().endsWith(".html"));
  let priceRangeCount = 0;
  const priceRangeFiles = [];
  for (const relPath of htmlFiles) {
    const html = await fsp.readFile(path.join(ROOT, relPath), "utf8");
    if (/"priceRange"\s*:/.test(html)) {
      priceRangeCount += 1;
      priceRangeFiles.push(relPath);
    }
    if (/\b(?:src|href)\s*=\s*["']\/(?:data|scripts)\//i.test(html)) {
      errors.push(`${relPath}: public HTML must not reference source-only /data or /scripts paths`);
    }
  }
  const priceMigration = business?.fields?.priceRange?.legacy_observation;
  if (priceMigration && typeof priceMigration === "object") {
    if (priceRangeCount !== priceMigration.expected_remaining_after_pilot) {
      errors.push(`${BUSINESS_FILE}: expected ${priceMigration.expected_remaining_after_pilot} legacy priceRange files after pilot, found ${priceRangeCount}`);
    }
    for (const pilotFile of priceMigration.pilot_removed_files || []) {
      if (priceRangeFiles.includes(pilotFile)) {
        errors.push(`${pilotFile}: governed priceRange pilot removal regressed`);
      }
    }
  }
  if (priceRangeCount) warnings.push(`${priceRangeCount} HTML files still contain legacy priceRange; no bulk rewrite was performed`);

  for (const requiredPath of ["/data/", "/scripts/"]) {
    if (!vercelIgnore.split(/\r?\n/).includes(requiredPath)) {
      errors.push(`.vercelignore: missing source-only exclusion ${requiredPath}`);
    }
  }
  for (const relPath of REQUIRED_DOCS) {
    if (!fs.existsSync(path.join(ROOT, relPath))) errors.push(`${relPath}: required governance document is missing`);
  }

  if (process.argv.includes("--self-test") && business && metrics && thirdParty && vercelConfig) {
    await runSelfTests(business, metrics, thirdParty, indexHtml, vercelConfig);
  }

  console.log("CarKey SEO governance validation");
  console.log(`Business fields: ${Object.keys(business?.fields || {}).length}`);
  console.log(`Metrics registered: ${(metrics?.metrics || []).length}`);
  console.log(`Third-party scripts governed: ${(thirdParty?.scripts || []).length}`);
  console.log(`Legacy priceRange files: ${priceRangeCount}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Errors: ${errors.length}`);
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exit(1);
  }
}

await main();
