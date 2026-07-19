import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getAttr, walkFiles } from "./seo-utils.mjs";

const ROOT = process.cwd();
const BUSINESS_FILE = "data/business-entity.json";
const METRICS_FILE = "data/business-metrics.json";
const THIRD_PARTY_FILE = "data/third-party-scripts.json";
const BUSINESS_ID = "https://www.carkey.com.tw/#business";
const AREA_SERVED_PILOT_FILES = [
  "index.html",
  "car-key-lost-service.html",
  "article-bmw-smart-key-owner-guide.html",
];
const AREA_SERVED_SERVICE_FILES = [
  "all-keys-lost-service.html",
  "car-key-duplication-service.html",
  "car-key-shell-replacement-service.html",
  "chip-key-copy-by-mail-service.html",
  "key-not-detected-service.html",
  "non-chip-car-key-duplication-service.html",
  "smart-key-lost-service.html",
  "spare-car-key-service.html",
];
const AREA_SERVED_BRAND_MODEL_FILES = [
  "bmw-smart-key-service.html",
  "toyota-altis-car-key.html",
  "vw-car-key-service.html",
];
const AREA_SERVED_GUIDE_BATCH_1_FILES = [
  "article-car-key-info-preparation-guide.html",
  "article-car-key-not-detected-troubleshooting.html",
  "article-car-wont-start-troubleshooting.html",
  "article-emergency-akl-guide.html",
  "article-hyundai-keyless-troubleshooting.html",
];
const AREA_SERVED_GUIDE_BATCH_2_FILES = [
  "article-keyless-troubleshooting.html",
  "article-keyless-troubleshooting-guide.html",
  "article-lost-key-comparison.html",
  "article-lost-key-rescue-guide.html",
  "article-porsche-smart-key-owner-guide.html",
];
const AREA_SERVED_GUIDE_BATCH_3_FILES = [
  "article-smart-key-troubleshooting.html",
  "article-used-car-buying-guide.html",
  "article-used-car-key-checklist.html",
  "article-used-car-security-guide.html",
  "article-why-you-need-spare-car-key.html",
];
const AREA_SERVED_GUIDE_BATCH_4_FILES = [
  "article-us-car-market-growth-security-tech.html",
  "article-us-car-market-tech.html",
  "article-us-car-zero-tariff-consumer-impact.html",
  "article-vag-key-owner-guide.html",
];
const AREA_SERVED_ALREADY_COMPLIANT_GUIDE_FILES = [
  "article-vag-dashboard-key-safety-guide.html",
];
const AREA_SERVED_ROLLOUT_FILES = [
  ...AREA_SERVED_PILOT_FILES,
  ...AREA_SERVED_SERVICE_FILES,
  ...AREA_SERVED_BRAND_MODEL_FILES,
  ...AREA_SERVED_GUIDE_BATCH_1_FILES,
  ...AREA_SERVED_GUIDE_BATCH_2_FILES,
  ...AREA_SERVED_GUIDE_BATCH_3_FILES,
  ...AREA_SERVED_GUIDE_BATCH_4_FILES,
  ...AREA_SERVED_ALREADY_COMPLIANT_GUIDE_FILES,
];
const REQUIRED_DOCS = [
  "docs/seo-engineering/content-entity-model.md",
  "docs/seo-engineering/human-input-register.md",
  "docs/seo-engineering/location-page-decision-framework.md",
  "docs/seo-engineering/pricing-policy.md",
  "docs/seo-engineering/service-area-schema-evidence-pilot.md",
  "docs/seo-engineering/service-area-schema-brand-model-rollout.md",
  "docs/seo-engineering/service-area-schema-guide-rollout-1.md",
  "docs/seo-engineering/service-area-schema-guide-rollout-2.md",
  "docs/seo-engineering/service-area-schema-guide-rollout-3.md",
  "docs/seo-engineering/service-area-schema-guide-rollout-4.md",
  "docs/seo-engineering/service-area-schema-service-rollout.md",
  "docs/seo-engineering/seo-governance.md",
  "docs/seo-engineering/third-party-script-decision.md",
];
const UNVERIFIED_AVAILABILITY_PATTERN = /24\s*(?:h|小時)|全年無休|全天候/gi;
const BMW_AVAILABILITY_NEUTRALIZATION_FILES = [
  "article-bmw-118-beitun-akl.html",
  "article-bmw-220i-2015-yunlin-akl.html",
  "article-bmw-740-yuanli-akl.html",
  "article-bmw-elv-red-lock-fix.html",
  "article-bmw-gseries-keyless-rescue.html",
  "article-bmw-x5-battery-fix.html",
];
const LUXURY_TEMPLATE_AVAILABILITY_NEUTRALIZATION_FILES = [
  "article-benz-glc300-yuanlin-service.html",
  "article-hyundai-tucson-hemei-akl.html",
  "article-infiniti-fx35-shetou-rescue.html",
  "article-kia-picanto-shengang-akl.html",
];
const CONTACT_LABEL_AVAILABILITY_NEUTRALIZATION_FILES = [
  "article-skoda-kamiq-crushed-key.html",
  "article-vw-arteon-smart-key-service.html",
  "article-lexus-taichung-service.html",
  "article-range-rover-huatan-service.html",
];
const RESCUE_HOTLINE_AVAILABILITY_NEUTRALIZATION_FILES = [
  "article-camaro-2017-linkou-akl.html",
  "article-honda-fit-2018-kaohsiung-akl.html",
  "article-porsche-panamera-wugu-akl.html",
  "article-toyota-altis-2020-yuanlin-akl.html",
  "article-vw-golf7-2015-taichung-akl.html",
];
const RESCUE_PHONE_LABEL_AVAILABILITY_NEUTRALIZATION_FILES = [
  "article-porsche-lost-key-rescue.html",
  "article-taichung-lost-key.html",
  "article-toyota-rav4-linkou-rescue.html",
  "article-volvo-keyless-lost-rescue.html",
];
const REGIONAL_RESCUE_LABEL_AVAILABILITY_NEUTRALIZATION_FILES = [
  "article-mazda-cx3-hemei-smartkey.html",
  "article-toyota-rav4-nantou-rescue.html",
  "article-nissan-kicks-zhongke-rescue.html",
  "article-benz-w204-nanzi-akl.html",
  "article-mazda-wufeng-rescue.html",
];
const GENERAL_RESCUE_COPY_AVAILABILITY_NEUTRALIZATION_FILES = [
  "case-hyundai-venue-smartkey-lost.html",
  "case-shetou-mazda-cx30-rescue.html",
  "article-lost-key-comparison.html",
  "article-car-key-lost-rescue-central-taiwan.html",
  "cases.html",
];
const MULTILINGUAL_CTA_AVAILABILITY_NEUTRALIZATION_FILES = [
  "article-mini-clubman-beidou-akl.html",
  "article-ford-focus-puli-akl.html",
  "article-taichung-lost-key-preparation.html",
  "dich-vu-lam-khoa-xe-o-to-tai-dai-loan.html",
];
const AVAILABILITY_CLAIM_CLOSURE_FILES = [
  "article-vw-t5-kaohsiung-rescue.html",
  "article-porsche-cayenne-hemei.html",
];
const AVAILABILITY_NEUTRALIZATION_FILES = [
  ...BMW_AVAILABILITY_NEUTRALIZATION_FILES,
  ...LUXURY_TEMPLATE_AVAILABILITY_NEUTRALIZATION_FILES,
  ...CONTACT_LABEL_AVAILABILITY_NEUTRALIZATION_FILES,
  ...RESCUE_HOTLINE_AVAILABILITY_NEUTRALIZATION_FILES,
  ...RESCUE_PHONE_LABEL_AVAILABILITY_NEUTRALIZATION_FILES,
  ...REGIONAL_RESCUE_LABEL_AVAILABILITY_NEUTRALIZATION_FILES,
  ...GENERAL_RESCUE_COPY_AVAILABILITY_NEUTRALIZATION_FILES,
  ...MULTILINGUAL_CTA_AVAILABILITY_NEUTRALIZATION_FILES,
  ...AVAILABILITY_CLAIM_CLOSURE_FILES,
];
const LUXURY_TEMPLATE_AVAILABILITY_REPLACEMENTS = [
  ["<!-- 24H 浮動救援按鈕 -->", "<!-- 浮動救援按鈕 -->"],
  [">24H CALL</a>", ">CALL</a>"],
  [">24H Hotline</span>", ">Phone</span>"],
];
const AVAILABILITY_REPLACEMENTS_BY_FILE = new Map([
  ...LUXURY_TEMPLATE_AVAILABILITY_NEUTRALIZATION_FILES.map((relPath) => [relPath, LUXURY_TEMPLATE_AVAILABILITY_REPLACEMENTS]),
  ["article-skoda-kamiq-crushed-key.html", LUXURY_TEMPLATE_AVAILABILITY_REPLACEMENTS],
  ["article-vw-arteon-smart-key-service.html", LUXURY_TEMPLATE_AVAILABILITY_REPLACEMENTS],
  ["article-lexus-taichung-service.html", [
    [">24H CALL</a>", ">CALL</a>"],
    ["中彰投 24H 專業諮詢", "中彰投專業諮詢"],
  ]],
  ["article-range-rover-huatan-service.html", [
    [">24H CALL</a>", ">CALL</a>"],
    ["中彰投 24H 專業救援諮詢", "中彰投專業救援諮詢"],
    [">24H Hotline</span>", ">Phone</span>"],
  ]],
  ...RESCUE_HOTLINE_AVAILABILITY_NEUTRALIZATION_FILES.map((relPath) => [relPath, [
    ["</svg>\n 24H 救援專線\n </a>", "</svg>\n 救援專線\n </a>"],
  ]]),
  ...RESCUE_PHONE_LABEL_AVAILABILITY_NEUTRALIZATION_FILES.map((relPath) => [relPath, [
    [">24H 救援專線：0909-277-670</a>", ">救援專線：0909-277-670</a>"],
  ]]),
  ["article-mazda-cx3-hemei-smartkey.html", [
    [">和美 24H 救援：0909-277-670</a>", ">和美救援：0909-277-670</a>"],
    ["class=\"mt-12 flex justify-center\"", "class=\"mt-12 flex flex-wrap justify-center\""],
  ]],
  ["article-toyota-rav4-nantou-rescue.html", [
    [">草屯 24H 救援：0909-277-670</a>", ">草屯救援：0909-277-670</a>"],
    ["class=\"mt-12 flex justify-center\"", "class=\"mt-12 flex flex-wrap justify-center\""],
  ]],
  ["article-nissan-kicks-zhongke-rescue.html", [
    [">中科 24H 救援：0909-277-670</a>", ">中科救援：0909-277-670</a>"],
    ["class=\"mt-12 flex justify-center\"", "class=\"mt-12 flex flex-wrap justify-center\""],
  ]],
  ["article-benz-w204-nanzi-akl.html", [
    [">高雄 24H 救援：0909-277-670</a>", ">高雄救援：0909-277-670</a>"],
    ["class=\"mt-12 flex justify-center\"", "class=\"mt-12 flex flex-wrap justify-center\""],
  ]],
  ["article-mazda-wufeng-rescue.html", [
    [">霧峰 24H 救援：0909-277-670</a>", ">霧峰救援：0909-277-670</a>"],
    ["class=\"mt-12 flex justify-center\"", "class=\"mt-12 flex flex-wrap justify-center\""],
  ]],
  ["case-hyundai-venue-smartkey-lost.html", [[">24H 現代汽車鑰匙緊急救援</h2>", ">現代汽車鑰匙緊急救援</h2>"]]],
  ["case-shetou-mazda-cx30-rescue.html", [[">24H 汽車鑰匙緊急救援</h2>", ">汽車鑰匙緊急救援</h2>"]]],
  ["article-lost-key-comparison.html", [["</svg>\n 24H 電話評估\n </a>", "</svg>\n 電話評估\n </a>"]]],
  ["article-car-key-lost-rescue-central-taiwan.html", [["\n 撥打 24H 救援專線\n </a>", "\n 撥打救援專線\n </a>"]]],
  ["cases.html", [["\"name\": \"到場案例 | 極致核心 ProCore | 全台 24H 汽車鑰匙救援紀錄\"", "\"name\": \"到場案例 | 極致核心 ProCore | 汽車鑰匙救援紀錄\""]]],
  ["article-mini-clubman-beidou-akl.html", [
    [">極致核心：24H 到場評估與交車確認</h3>", ">極致核心：到場評估與交車確認</h3>"],
    [">彰化 24H 救援：0909-277-670</a>", ">彰化救援：0909-277-670</a>"],
    ["class=\"mt-12 flex justify-center\"", "class=\"mt-12 flex flex-wrap justify-center\""],
  ]],
  ["article-ford-focus-puli-akl.html", [
    [">極致核心：深入埔里山城，24H 到場評估處理</h3>", ">極致核心：深入埔里山城，到場評估處理</h3>"],
    [">南投 24H 救援：0909-277-670</a>", ">南投救援：0909-277-670</a>"],
    ["class=\"mt-12 flex justify-center\"", "class=\"mt-12 flex flex-wrap justify-center\""],
  ]],
  ["article-taichung-lost-key-preparation.html", [
    [">24H CALL</a>", ">CALL</a>"],
    [">24H Hotline</span>", ">Phone</span>"],
  ]],
  ["dich-vu-lam-khoa-xe-o-to-tai-dai-loan.html", [
    [">Phục vụ tận nơi 24H:</strong>", ">Phục vụ tận nơi:</strong>"],
  ]],
  ["article-vw-t5-kaohsiung-rescue.html", [
    ["極致核心在高雄提供 24H 現場支援。", "極致核心在高雄提供現場支援。"],
    ["當場配製兩把全新摺疊晶片鑰匙，1 小時內讓您恢復工作。", "當場配製兩把全新摺疊晶片鑰匙，完成後讓車輛恢復使用。"],
    ["class=\"flex justify-center\"", "class=\"flex flex-wrap justify-center\""],
  ]],
  ["article-porsche-cayenne-hemei.html", [
    ["。24H 技師可依距離安排到場，", "。技師可依距離安排到場，"],
    ["class=\"flex justify-center mt-12 mb-16\"", "class=\"flex flex-wrap justify-center mt-12 mb-16\""],
  ]],
]);

function countExact(text, needle) {
  return text.split(needle).length - 1;
}

function compareAvailabilityNeutralizationWithHead(relPath, currentHtml, errors) {
  let expectedHtml;
  try {
    expectedHtml = execFileSync("git", ["show", `HEAD:${relPath}`], { cwd: ROOT, encoding: "utf8" });
  } catch (error) {
    errors.push(`${relPath}: unable to read HEAD for availability-claim comparison (${error.message})`);
    return;
  }

  const replacements = AVAILABILITY_REPLACEMENTS_BY_FILE.get(relPath) || [];
  for (const [before, after] of replacements) {
    const beforeCount = countExact(expectedHtml, before);
    const afterCount = countExact(expectedHtml, after);
    if (beforeCount === 1 && afterCount === 0) {
      expectedHtml = expectedHtml.replace(before, after);
    } else if (beforeCount !== 0 || afterCount !== 1) {
      errors.push(`${relPath}: HEAD must contain exactly one governed before or after state for ${JSON.stringify(before)}`);
      return;
    }
  }

  if (currentHtml !== expectedHtml) {
    errors.push(`${relPath}: HTML changed beyond its ${replacements.length} registered availability-claim replacements`);
  }
}

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

function walkJson(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, visit);
    return;
  }
  if (!value || typeof value !== "object") return;
  visit(value);
  for (const item of Object.values(value)) walkJson(item, visit);
}

function countBusinessAreaServedNodes(html, relPath, errors) {
  let count = 0;
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const openTag = match[0].slice(0, match[0].indexOf(">") + 1);
    if (getAttr(openTag, "type")?.toLowerCase() !== "application/ld+json") continue;
    let payload;
    try {
      payload = JSON.parse(match[1]);
    } catch (error) {
      errors.push(`${relPath}: invalid JSON-LD while checking business areaServed (${error.message})`);
      continue;
    }
    walkJson(payload, (node) => {
      if (node["@id"] === BUSINESS_ID && Object.hasOwn(node, "@type") && Object.hasOwn(node, "areaServed")) {
        count += 1;
      }
    });
  }
  return count;
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

  const serviceAreaMigration = fields.serviceArea?.legacy_schema_observation;
  const expectedServiceAreaStage = [
    { stage_id: "three-page-pilot", status: "implemented", files: AREA_SERVED_PILOT_FILES },
    { stage_id: "service-page-batch", status: "implemented", files: AREA_SERVED_SERVICE_FILES },
    { stage_id: "brand-model-page-batch", status: "implemented", files: AREA_SERVED_BRAND_MODEL_FILES },
    { stage_id: "guide-page-batch-1", status: "implemented", files: AREA_SERVED_GUIDE_BATCH_1_FILES },
    { stage_id: "guide-page-batch-2", status: "implemented", files: AREA_SERVED_GUIDE_BATCH_2_FILES },
    { stage_id: "guide-page-batch-3", status: "implemented", files: AREA_SERVED_GUIDE_BATCH_3_FILES },
    { stage_id: "guide-page-batch-4", status: "implemented", files: AREA_SERVED_GUIDE_BATCH_4_FILES },
  ];
  if (!serviceAreaMigration || typeof serviceAreaMigration !== "object") {
    errors.push(`${BUSINESS_FILE}: serviceArea legacy_schema_observation must record the controlled pilot`);
  } else if (serviceAreaMigration.baseline_file_count !== 133 || serviceAreaMigration.baseline_node_count !== 133 ||
      JSON.stringify(serviceAreaMigration.already_compliant_files) !== JSON.stringify(AREA_SERVED_ALREADY_COMPLIANT_GUIDE_FILES) ||
      serviceAreaMigration.guide_scope_status !== "closed_no_shared_business_area_served" ||
      serviceAreaMigration.expected_remaining_file_count !== 100 || serviceAreaMigration.expected_remaining_node_count !== 100 ||
      serviceAreaMigration.rollout_status !== "controlled_rollout" ||
      JSON.stringify(serviceAreaMigration.removal_stages) !== JSON.stringify(expectedServiceAreaStage)) {
    errors.push(`${BUSINESS_FILE}: serviceArea rollout scope/count/status drifted`);
  }

  const availabilityMigration = fields.openingHours?.legacy_claim_observation;
  if (!availabilityMigration || typeof availabilityMigration !== "object") {
    errors.push(`${BUSINESS_FILE}: openingHours legacy_claim_observation must record the controlled 24H-claim neutralization`);
  } else {
    const stages = availabilityMigration.neutralization_stages || [];
    const neutralizedFiles = stages.flatMap((stage) => stage.files || []);
    if (availabilityMigration.baseline_file_count !== 39 || availabilityMigration.baseline_occurrence_count !== 60 ||
        availabilityMigration.expected_remaining_file_count !== 0 || availabilityMigration.expected_remaining_occurrence_count !== 0) {
      errors.push(`${BUSINESS_FILE}: 24H-claim migration must preserve the 39-file/60-occurrence baseline and reach a zero-file/zero-occurrence remainder`);
    }
    if (stages.length !== 9 || stages[0]?.stage_id !== "bmw-24h-claim-batch" || stages[0]?.status !== "implemented" ||
        stages[1]?.stage_id !== "luxury-case-template-24h-claim-batch" || stages[1]?.status !== "implemented" ||
        stages[2]?.stage_id !== "contact-label-24h-claim-batch" || stages[2]?.status !== "implemented" ||
        stages[3]?.stage_id !== "rescue-hotline-24h-claim-batch" || stages[3]?.status !== "implemented" ||
        stages[4]?.stage_id !== "rescue-phone-label-24h-claim-batch" || stages[4]?.status !== "implemented" ||
        stages[5]?.stage_id !== "regional-rescue-label-24h-claim-batch" || stages[5]?.status !== "implemented" ||
        stages[6]?.stage_id !== "general-rescue-copy-24h-claim-batch" || stages[6]?.status !== "implemented" ||
        stages[7]?.stage_id !== "multilingual-cta-24h-claim-batch" || stages[7]?.status !== "implemented" ||
        stages[8]?.stage_id !== "availability-claim-closure-batch" || stages[8]?.status !== "implemented" ||
        JSON.stringify(neutralizedFiles) !== JSON.stringify(AVAILABILITY_NEUTRALIZATION_FILES)) {
      errors.push(`${BUSINESS_FILE}: 24H-claim migration must record all nine controlled batches`);
    }
    if (!availabilityMigration.baseline_evidence || availabilityMigration.rollout_status !== "availability_claims_neutralized") {
      errors.push(`${BUSINESS_FILE}: 24H-claim migration evidence/status is incomplete`);
    }
  }

  const migration = fields.priceRange?.legacy_observation;
  if (!migration || typeof migration !== "object") {
    errors.push(`${BUSINESS_FILE}: priceRange legacy_observation must record the controlled migration`);
  } else {
    const stages = migration.removal_stages || [];
    const removedFiles = stages.flatMap((stage) => stage.files || []);
    if (migration.baseline_count !== 134 || migration.expected_remaining_after_current_stage !== 0) {
      errors.push(`${BUSINESS_FILE}: priceRange migration must preserve the 134-file baseline and reach a zero-file remainder`);
    }
    if (stages.length !== 13 || stages[0]?.stage_id !== "three-page-pilot" || stages[0]?.files?.length !== 3 ||
        stages[1]?.stage_id !== "service-page-batch" || stages[1]?.files?.length !== 8 ||
        stages[2]?.stage_id !== "brand-model-page-batch" || stages[2]?.files?.length !== 3 ||
        stages[3]?.stage_id !== "guide-page-batch" || stages[3]?.files?.length !== 20 ||
        stages[4]?.stage_id !== "case-page-pilot" || stages[4]?.files?.length !== 3 ||
        stages[5]?.stage_id !== "bmw-case-page-batch" || stages[5]?.files?.length !== 12 ||
        stages[6]?.stage_id !== "remaining-article-case-batch-1" || stages[6]?.files?.length !== 15 ||
        stages[7]?.stage_id !== "remaining-article-case-batch-2" || stages[7]?.files?.length !== 15 ||
        stages[8]?.stage_id !== "remaining-article-case-batch-3" || stages[8]?.files?.length !== 15 ||
        stages[9]?.stage_id !== "remaining-article-case-batch-4" || stages[9]?.files?.length !== 13 ||
        stages[10]?.stage_id !== "location-page-batch-1" || stages[10]?.files?.length !== 11 ||
        stages[11]?.stage_id !== "location-page-batch-2" || stages[11]?.files?.length !== 11 ||
        stages[12]?.stage_id !== "utility-page-batch" || stages[12]?.files?.length !== 5) {
      errors.push(`${BUSINESS_FILE}: priceRange migration must record all thirteen controlled stages`);
    }
    if (removedFiles.length !== 134 || new Set(removedFiles).size !== removedFiles.length) {
      errors.push(`${BUSINESS_FILE}: priceRange removal stages must identify exactly 134 unique files`);
    }
    if (migration.rollout_status !== "price_range_closed") {
      errors.push(`${BUSINESS_FILE}: priceRange migration status must be price_range_closed`);
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

  const badServiceArea = structuredClone(business);
  delete badServiceArea.fields.serviceArea.legacy_schema_observation;
  validateBusinessEntity(badServiceArea, gateErrors, gateWarnings);

  const expectedFailures = [
    "legalName cannot publish without verified value and evidence",
    "public metric vehicles_served is missing source",
    "cross_region_visits fallback copy must be non-numeric",
    "pending script washinmura-aeo-crawler-track must block new page expansion",
    "serviceArea legacy_schema_observation must record the controlled pilot",
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
  let availabilityClaimCount = 0;
  const availabilityClaimFiles = [];
  let businessAreaServedNodeCount = 0;
  const businessAreaServedFiles = [];
  for (const relPath of htmlFiles) {
    const html = await fsp.readFile(path.join(ROOT, relPath), "utf8");
    const areaServedNodeCount = countBusinessAreaServedNodes(html, relPath, errors);
    if (areaServedNodeCount) {
      businessAreaServedNodeCount += areaServedNodeCount;
      businessAreaServedFiles.push(relPath);
    }
    if (/"priceRange"\s*:/.test(html)) {
      priceRangeCount += 1;
      priceRangeFiles.push(relPath);
    }
    const availabilityClaims = html.match(UNVERIFIED_AVAILABILITY_PATTERN) || [];
    if (availabilityClaims.length) {
      availabilityClaimCount += availabilityClaims.length;
      availabilityClaimFiles.push(relPath);
    }
    if (process.argv.includes("--compare-head") && AVAILABILITY_REPLACEMENTS_BY_FILE.has(relPath)) {
      compareAvailabilityNeutralizationWithHead(relPath, html, errors);
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

  const serviceAreaMigration = business?.fields?.serviceArea?.legacy_schema_observation;
  if (serviceAreaMigration && typeof serviceAreaMigration === "object") {
    if (businessAreaServedFiles.length !== serviceAreaMigration.expected_remaining_file_count ||
        businessAreaServedNodeCount !== serviceAreaMigration.expected_remaining_node_count) {
      errors.push(`${BUSINESS_FILE}: expected ${serviceAreaMigration.expected_remaining_file_count} files / ${serviceAreaMigration.expected_remaining_node_count} shared business nodes with unverified areaServed after current stage, found ${businessAreaServedFiles.length} files / ${businessAreaServedNodeCount} nodes`);
    }
    for (const rolloutFile of AREA_SERVED_ROLLOUT_FILES) {
      if (businessAreaServedFiles.includes(rolloutFile)) errors.push(`${rolloutFile}: governed business areaServed removal regressed`);
    }
  }
  if (businessAreaServedNodeCount) {
    warnings.push(`${businessAreaServedFiles.length} HTML files still publish ${businessAreaServedNodeCount} unverified shared-business areaServed nodes; no bulk rewrite was performed`);
  }

  const availabilityMigration = business?.fields?.openingHours?.legacy_claim_observation;
  if (availabilityMigration && typeof availabilityMigration === "object") {
    if (availabilityClaimFiles.length !== availabilityMigration.expected_remaining_file_count ||
        availabilityClaimCount !== availabilityMigration.expected_remaining_occurrence_count) {
      errors.push(`${BUSINESS_FILE}: expected ${availabilityMigration.expected_remaining_file_count} files and ${availabilityMigration.expected_remaining_occurrence_count} occurrences with unverified availability claims after current stage, found ${availabilityClaimFiles.length} files and ${availabilityClaimCount} occurrences`);
    }
    for (const neutralizedFile of AVAILABILITY_NEUTRALIZATION_FILES) {
      if (availabilityClaimFiles.includes(neutralizedFile)) {
        errors.push(`${neutralizedFile}: governed 24H-claim neutralization regressed`);
      }
    }
  }
  if (availabilityClaimCount) {
    warnings.push(`${availabilityClaimFiles.length} HTML files still contain ${availabilityClaimCount} unverified availability-claim occurrences; no bulk rewrite was performed`);
  }

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
  console.log(`Unverified business areaServed: ${businessAreaServedFiles.length} files / ${businessAreaServedNodeCount} nodes`);
  console.log(`Unverified availability claims: ${availabilityClaimFiles.length} files / ${availabilityClaimCount} occurrences`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Errors: ${errors.length}`);
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR ${error}`);
    process.exit(1);
  }
}

await main();
