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
  "docs/seo-engineering/pricing-policy.md",
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
    if (!new Set(["verified", "unverified", "not_applicable"]).has(field.status)) {
      errors.push(`${BUSINESS_FILE}: ${name}.status must be verified, unverified, or not_applicable`);
    }
    if (field.status === "not_applicable" && name !== "priceRange") {
      errors.push(`${BUSINESS_FILE}: not_applicable is currently reserved for the confirmed priceRange omission policy`);
    }
    if (typeof field.publish !== "boolean") errors.push(`${BUSINESS_FILE}: ${name}.publish must be boolean`);
    if (field.publish && (field.status !== "verified" || field.value == null || !hasEvidence(field))) {
      errors.push(`${BUSINESS_FILE}: ${name} cannot publish without verified value and evidence`);
    }
    if (!field.publish && field.status === "verified") {
      warnings.push(`${BUSINESS_FILE}: verified field ${name} is intentionally not publishable`);
    }
  }

  if (fields.priceRange?.value !== null || fields.priceRange?.status !== "not_applicable" ||
      fields.priceRange?.publish !== false || fields.priceRange?.pricing_model !== "case_by_case_quote" ||
      fields.priceRange?.schema_output !== "omit" || !hasEvidence(fields.priceRange)) {
    errors.push(`${BUSINESS_FILE}: confirmed case-by-case pricing policy must omit priceRange`);
  }
  if (fields.legalName?.value !== null || fields.publicBrandName?.value !== null) {
    errors.push(`${BUSINESS_FILE}: legalName and publicBrandName require an explicit human decision`);
  }

  const migration = fields.priceRange?.legacy_observation;
  if (!migration || typeof migration !== "object") {
    errors.push(`${BUSINESS_FILE}: priceRange legacy_observation must record the controlled migration`);
  } else {
    const stages = migration.removal_stages || [];
    const removedFiles = stages.flatMap((stage) => stage.files || []);
    if (migration.baseline_count !== 134 || migration.expected_remaining_after_current_stage !== 85) {
      errors.push(`${BUSINESS_FILE}: priceRange migration must preserve the 134-file baseline and 85-file current remainder`);
    }
    if (stages.length !== 6 || stages[0]?.stage_id !== "three-page-pilot" || stages[0]?.files?.length !== 3 ||
        stages[1]?.stage_id !== "service-page-batch" || stages[1]?.files?.length !== 8 ||
        stages[2]?.stage_id !== "brand-model-page-batch" || stages[2]?.files?.length !== 3 ||
        stages[3]?.stage_id !== "guide-page-batch" || stages[3]?.files?.length !== 20 ||
        stages[4]?.stage_id !== "case-page-pilot" || stages[4]?.files?.length !== 3 ||
        stages[5]?.stage_id !== "bmw-case-page-batch" || stages[5]?.files?.length !== 12) {
      errors.push(`${BUSINESS_FILE}: priceRange migration must record all stages through the BMW case batch`);
    }
    if (removedFiles.length !== 49 || new Set(removedFiles).size !== removedFiles.length) {
      errors.push(`${BUSINESS_FILE}: priceRange removal stages must identify exactly 49 unique files`);
    }
    if (migration.rollout_status !== "bmw_case_page_batch") {
      errors.push(`${BUSINESS_FILE}: priceRange migration must remain limited to the registered batches through the BMW case rollout`);
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
    if (!metric.label || !metric.unit || !metric.fallback_label || !metric.fallback_text) {
      errors.push(`${METRICS_FILE}: ${metric.metric_id} requires label, unit, fallback_label, and fallback_text`);
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
    if (/\d/.test(metric.fallback_label) || /\d/.test(metric.fallback_text)) {
      errors.push(`${METRICS_FILE}: ${metric.metric_id} fallback copy must be non-numeric`);
    }
  }

  const startMarker = "<!-- BUSINESS_METRICS_START -->";
  const endMarker = "<!-- BUSINESS_METRICS_END -->";
  const start = indexHtml.indexOf(startMarker);
  const end = indexHtml.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    errors.push("index.html: governed business metric block markers are missing or invalid");
    return;
  }
  const metricBlock = indexHtml.slice(start, end + endMarker.length);
  const renderedIds = [...metricBlock.matchAll(/\bdata-metric-id=["']([^"']+)["']/gi)].map((match) => match[1]);
  if (renderedIds.length !== metrics.length || new Set(renderedIds).size !== renderedIds.length) {
    errors.push(`index.html: expected ${metrics.length} unique governed metric cards, found ${renderedIds.length}`);
  }

  for (const metric of metrics) {
    const escapedId = metric.metric_id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cardPattern = new RegExp(
      `<div\\b[^>]*data-metric-id=["']${escapedId}["'][^>]*data-metric-status=["'](public|fallback)["'][^>]*>\\s*` +
      `<div\\b([^>]*)>([^<]*)<\\/div>\\s*<div\\b[^>]*>([^<]*)<\\/div>\\s*<\\/div>`,
      "i",
    );
    const card = metricBlock.match(cardPattern);
    if (!card) {
      errors.push(`index.html: no governed metric card matches ${metric.metric_id}`);
      continue;
    }

    const [, renderedStatus, valueAttributes, sourceTextRaw, labelTextRaw] = card;
    const sourceText = sourceTextRaw.trim();
    const labelText = labelTextRaw.trim();
    if (metric.display_status === "public") {
      const targetMatch = valueAttributes.match(/\bdata-target=["']([^"']+)["']/i);
      const renderedTarget = targetMatch ? Number(targetMatch[1]) : Number.NaN;
      const renderedValue = Number(sourceText.replaceAll(",", ""));
      if (renderedStatus !== "public" || !/\bcounter\b/.test(valueAttributes) || renderedTarget !== metric.value || renderedValue !== metric.value) {
        errors.push(`index.html: public metric ${metric.metric_id} must source-render its verified value and matching data-target`);
      }
      if (labelText !== metric.label) {
        errors.push(`index.html: public metric ${metric.metric_id} label does not match its source record`);
      }
    } else {
      if (renderedStatus !== "fallback" || /\bcounter\b/.test(valueAttributes) || /\bdata-target\s*=/.test(valueAttributes)) {
        errors.push(`index.html: unverified metric ${metric.metric_id} must render as a non-animated fallback`);
      }
      if (sourceText !== metric.fallback_text || labelText !== metric.fallback_label) {
        errors.push(`index.html: fallback copy for ${metric.metric_id} does not match ${METRICS_FILE}`);
      }
      if (metric.legacy_unverified_value != null && metricBlock.includes(String(metric.legacy_unverified_value))) {
        errors.push(`index.html: unverified legacy value for ${metric.metric_id} leaked into public metric source`);
      }
    }
  }
  if (/24H\s+(?:Hotline|全年無休)/i.test(indexHtml)) {
    errors.push("index.html: unverified 24H claim remains in homepage source");
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

  const badFallback = structuredClone(metrics);
  badFallback.metrics[1].fallback_text = "提供 24 小時跨區服務";
  validateMetrics(badFallback, indexHtml, gateErrors, gateWarnings);

  const badThirdParty = structuredClone(thirdParty);
  badThirdParty.scripts[0].new_page_expansion_allowed = true;
  await validateThirdParty(badThirdParty, vercelConfig, gateErrors, gateWarnings);

  const expectedFailures = [
    "legalName cannot publish without verified value and evidence",
    "public metric vehicles_served is missing source",
    "cross_region_visits fallback copy must be non-numeric",
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
    if (priceRangeCount !== priceMigration.expected_remaining_after_current_stage) {
      errors.push(`${BUSINESS_FILE}: expected ${priceMigration.expected_remaining_after_current_stage} legacy priceRange files after current stage, found ${priceRangeCount}`);
    }
    const removedFiles = (priceMigration.removal_stages || []).flatMap((stage) => stage.files || []);
    for (const removedFile of removedFiles) {
      if (priceRangeFiles.includes(removedFile)) {
        errors.push(`${removedFile}: governed priceRange removal regressed`);
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
