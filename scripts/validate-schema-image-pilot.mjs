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
const AREA_SERVED_PILOT_FILES = [...IMAGE_PILOT_FILES];
const AREA_SERVED_HTML_REMOVALS = new Map([
  [
    "index.html",
    ',"areaServed":["台北市","新北市","基隆市","桃園市","新竹市","新竹縣","苗栗縣","台中市","彰化縣","南投縣","雲林縣","嘉義市","嘉義縣","台南市","高雄市","屏東縣","宜蘭縣","花蓮縣","台東縣","澎湖縣","金門縣","連江縣"]',
  ],
  [
    "car-key-lost-service.html",
    ',"areaServed":["台中市","彰化縣","南投縣","苗栗縣","雲林縣","嘉義縣市","新北市","高雄市"]',
  ],
  [
    "article-bmw-smart-key-owner-guide.html",
    ',\n      "areaServed": [\n        "台中",\n        "彰化",\n        "南投",\n        "雲林",\n        "苗栗",\n        "新竹",\n        "嘉義",\n        "台南",\n        "高雄"\n      ]',
  ],
]);
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
const COMPACT_SERVICE_AREA_SERVED_REMOVAL = ',"areaServed":["台中市","彰化縣","南投縣","苗栗縣","雲林縣","嘉義縣市","新北市","高雄市"]';
const MULTILINE_SERVICE_AREA_SERVED_REMOVAL = ',\n      "areaServed": [\n        "台北市",\n        "新北市",\n        "桃園市",\n        "新竹縣市",\n        "苗栗縣",\n        "台中市",\n        "彰化縣",\n        "南投縣",\n        "雲林縣",\n        "高雄市"\n      ]';
for (const relPath of SERVICE_SCHEMA_FILES) {
  AREA_SERVED_HTML_REMOVALS.set(
    relPath,
    [
      "car-key-shell-replacement-service.html",
      "chip-key-copy-by-mail-service.html",
      "non-chip-car-key-duplication-service.html",
    ].includes(relPath) ? MULTILINE_SERVICE_AREA_SERVED_REMOVAL : COMPACT_SERVICE_AREA_SERVED_REMOVAL,
  );
}
const BRAND_MODEL_SCHEMA_FILES = [
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
  ...SERVICE_SCHEMA_FILES,
  ...BRAND_MODEL_SCHEMA_FILES,
  ...AREA_SERVED_GUIDE_BATCH_1_FILES,
  ...AREA_SERVED_GUIDE_BATCH_2_FILES,
  ...AREA_SERVED_GUIDE_BATCH_3_FILES,
  ...AREA_SERVED_GUIDE_BATCH_4_FILES,
  ...AREA_SERVED_ALREADY_COMPLIANT_GUIDE_FILES,
];
AREA_SERVED_HTML_REMOVALS.set("bmw-smart-key-service.html", COMPACT_SERVICE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set(
  "toyota-altis-car-key.html",
  ',\n      "areaServed": ["台中市", "彰化縣", "苗栗縣", "南投縣", "雲林縣"]',
);
AREA_SERVED_HTML_REMOVALS.set(
  "vw-car-key-service.html",
  ', "areaServed": ["台中市", "彰化縣", "南投縣", "苗栗縣", "雲林縣", "嘉義縣市", "新北市", "高雄市"]',
);
AREA_SERVED_HTML_REMOVALS.set(
  "article-car-key-info-preparation-guide.html",
  ',"areaServed":["台中","彰化","南投","雲林","苗栗","新竹","嘉義","台南","高雄"]',
);
AREA_SERVED_HTML_REMOVALS.set("article-car-key-not-detected-troubleshooting.html", COMPACT_SERVICE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set("article-hyundai-keyless-troubleshooting.html", COMPACT_SERVICE_AREA_SERVED_REMOVAL);
const FLUSH_MULTILINE_GUIDE_AREA_SERVED_REMOVAL = ' "areaServed": [\n "台中市",\n "彰化縣",\n "南投縣",\n "苗栗縣",\n "雲林縣",\n "嘉義市",\n "新竹市",\n "新北市",\n "高雄市"\n ],\n';
AREA_SERVED_HTML_REMOVALS.set("article-car-wont-start-troubleshooting.html", FLUSH_MULTILINE_GUIDE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set("article-emergency-akl-guide.html", FLUSH_MULTILINE_GUIDE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set("article-keyless-troubleshooting.html", COMPACT_SERVICE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set("article-keyless-troubleshooting-guide.html", COMPACT_SERVICE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set("article-lost-key-comparison.html", FLUSH_MULTILINE_GUIDE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set("article-lost-key-rescue-guide.html", COMPACT_SERVICE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set(
  "article-porsche-smart-key-owner-guide.html",
  ',\n      "areaServed": [\n        "台中",\n        "彰化",\n        "南投",\n        "雲林",\n        "苗栗",\n        "新竹",\n        "嘉義",\n        "台南",\n        "高雄"\n      ]',
);
AREA_SERVED_HTML_REMOVALS.set("article-smart-key-troubleshooting.html", COMPACT_SERVICE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set("article-used-car-buying-guide.html", FLUSH_MULTILINE_GUIDE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set("article-used-car-key-checklist.html", MULTILINE_SERVICE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set(
  "article-used-car-security-guide.html",
  ',\n      "areaServed": [\n        "台北市",\n        "新北市",\n        "桃園市",\n        "新竹縣市",\n        "台中市",\n        "彰化縣",\n        "南投縣",\n        "雲林縣"\n      ]',
);
AREA_SERVED_HTML_REMOVALS.set("article-why-you-need-spare-car-key.html", FLUSH_MULTILINE_GUIDE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set("article-us-car-market-growth-security-tech.html", FLUSH_MULTILINE_GUIDE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set("article-us-car-market-tech.html", FLUSH_MULTILINE_GUIDE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set("article-us-car-zero-tariff-consumer-impact.html", FLUSH_MULTILINE_GUIDE_AREA_SERVED_REMOVAL);
AREA_SERVED_HTML_REMOVALS.set(
  "article-vag-key-owner-guide.html",
  ',\n      "areaServed": [\n        "台中",\n        "彰化",\n        "南投",\n        "雲林",\n        "苗栗",\n        "新竹",\n        "嘉義",\n        "台南",\n        "高雄"\n      ]',
);
const GUIDE_SCHEMA_FILES = [
  "article-car-key-info-preparation-guide.html",
  "article-car-key-not-detected-troubleshooting.html",
  "article-car-wont-start-troubleshooting.html",
  "article-emergency-akl-guide.html",
  "article-hyundai-keyless-troubleshooting.html",
  "article-keyless-troubleshooting.html",
  "article-keyless-troubleshooting-guide.html",
  "article-lost-key-comparison.html",
  "article-lost-key-rescue-guide.html",
  "article-porsche-smart-key-owner-guide.html",
  "article-smart-key-troubleshooting.html",
  "article-us-car-market-growth-security-tech.html",
  "article-us-car-market-tech.html",
  "article-us-car-zero-tariff-consumer-impact.html",
  "article-used-car-buying-guide.html",
  "article-used-car-key-checklist.html",
  "article-used-car-security-guide.html",
  "article-vag-dashboard-key-safety-guide.html",
  "article-vag-key-owner-guide.html",
  "article-why-you-need-spare-car-key.html",
];
const CASE_SCHEMA_PILOT_FILES = [
  "article-audi-r8-neihu-all-keys-lost.html",
  "article-bmw-elv-red-lock-fix.html",
  "case-shetou-mazda-cx30-rescue.html",
];
const BMW_CASE_SCHEMA_FILES = [
  "article-bmw-118-2016-changhua-akl.html",
  "article-bmw-118-beitun-akl.html",
  "article-bmw-218d-2016-yunlin-akl.html",
  "article-bmw-220i-2015-yunlin-akl.html",
  "article-bmw-3series-huatan-rescue.html",
  "article-bmw-528-2015-yunlin-akl.html",
  "article-bmw-730d-kaohsiung-auction-akl.html",
  "article-bmw-740-yuanli-akl.html",
  "article-bmw-gseries-keyless-rescue.html",
  "article-bmw-gt535i-renwu-akl.html",
  "article-bmw-x3-linkou-auction-akl.html",
  "article-bmw-x5-battery-fix.html",
];
const REMAINING_ARTICLE_CASE_SCHEMA_BATCH_1 = [
  "article-benz-c300-wuqi.html",
  "article-benz-glc300-yuanlin-service.html",
  "article-benz-glk-miaoli-akl.html",
  "article-benz-ml350-hemei-service.html",
  "article-benz-w204-nanzi-akl.html",
  "article-benz-xindian-lost-key-rescue.html",
  "article-camaro-2017-linkou-akl.html",
  "article-car-key-2018-new-taipei-akl.html",
  "article-car-key-lost-rescue-central-taiwan.html",
  "article-ford-focus-puli-akl.html",
  "article-ford-kuga-huatan-akl.html",
  "article-honda-cbr650-2022-kaohsiung-akl.html",
  "article-honda-fit-2018-kaohsiung-akl.html",
  "article-honda-fit-tanaka-rescue.html",
  "article-honda-hrv-2020-all-lost-changhua.html",
];
const REMAINING_ARTICLE_CASE_SCHEMA_BATCH_2 = [
  "article-honda-hrv-2022-akl-longjing.html",
  "article-hyundai-tucson-hemei-akl.html",
  "article-infiniti-fx35-shetou-rescue.html",
  "article-kia-picanto-nantun.html",
  "article-kia-picanto-shengang-akl.html",
  "article-landrover-evoque-taichung-auction-akl.html",
  "article-lexus-nx200-huatan-akl.html",
  "article-lexus-taichung-service.html",
  "article-lexus-ux250-2021-taichung-akl.html",
  "article-mazda-cx3-hemei-smartkey.html",
  "article-mazda-cx5-qingshui-akl.html",
  "article-mazda-wufeng-rescue.html",
  "article-mini-clubman-beidou-akl.html",
  "article-nissan-kicks-zhongke-rescue.html",
  "article-peugeot-508sw-zhubei-smartkey.html",
];
const REMAINING_ARTICLE_CASE_SCHEMA_BATCH_3 = [
  "article-porsche-cayenne-hemei.html",
  "article-porsche-lost-key-rescue.html",
  "article-porsche-panamera-wugu-akl.html",
  "article-range-rover-huatan-service.html",
  "article-skoda-kamiq-crushed-key.html",
  "article-skoda-kodiaq-yunlin-rescue.html",
  "article-taichung-lost-key-preparation.html",
  "article-taichung-lost-key.html",
  "article-toyota-altis-2016-taichung-akl.html",
  "article-toyota-altis-2020-yuanlin-akl.html",
  "article-toyota-altis-qingshui-rescue.html",
  "article-toyota-auris-linkou-auction-akl.html",
  "article-toyota-rav4-fengyuan-akl.html",
  "article-toyota-rav4-linkou-rescue.html",
  "article-toyota-rav4-nantou-rescue.html",
];
const REMAINING_ARTICLE_CASE_SCHEMA_BATCH_4 = [
  "article-toyota-sienta-hemei-service.html",
  "article-toyota-vios-2019-changhua-akl.html",
  "article-volvo-keyless-lost-rescue.html",
  "article-vw-amarok-2019-changhua-akl.html",
  "article-vw-arteon-smart-key-service.html",
  "article-vw-golf-2016-toufen-akl.html",
  "article-vw-golf-dadu-service.html",
  "article-vw-golf7-2015-taichung-akl.html",
  "article-vw-ignition-repair.html",
  "article-vw-pointer-xianxi-rescue.html",
  "article-vw-t5-kaohsiung-rescue.html",
  "article-vw-t6-2022-taipei-smartkey.html",
  "case-hyundai-venue-smartkey-lost.html",
];
const LOCATION_SCHEMA_BATCH_1 = [
  "changhua-car-key.html",
  "chiayi-city-car-key.html",
  "chiayi-county-car-key.html",
  "hsinchu-city-car-key.html",
  "hsinchu-county-car-key.html",
  "hualien-car-key.html",
  "kaohsiung-car-key.html",
  "keelung-car-key.html",
  "kinmen-car-key.html",
  "lienchiang-car-key.html",
  "miaoli-car-key.html",
];
const LOCATION_SCHEMA_BATCH_2 = [
  "nantou-car-key.html",
  "new-taipei-car-key.html",
  "penghu-car-key.html",
  "pingtung-car-key.html",
  "taichung-car-key.html",
  "tainan-car-key.html",
  "taipei-car-key.html",
  "taitung-car-key.html",
  "taoyuan-car-key.html",
  "yilan-car-key.html",
  "yunlin-car-key.html",
];
const UTILITY_SCHEMA_BATCH = [
  "blog.html",
  "cases.html",
  "dich-vu-lam-khoa-xe-o-to-tai-dai-loan.html",
  "service-areas.html",
  "vcard.html",
];
const SCHEMA_FILES = [
  ...IMAGE_PILOT_FILES,
  ...SERVICE_SCHEMA_FILES,
  ...BRAND_MODEL_SCHEMA_FILES,
  ...GUIDE_SCHEMA_FILES,
  ...CASE_SCHEMA_PILOT_FILES,
  ...BMW_CASE_SCHEMA_FILES,
  ...REMAINING_ARTICLE_CASE_SCHEMA_BATCH_1,
  ...REMAINING_ARTICLE_CASE_SCHEMA_BATCH_2,
  ...REMAINING_ARTICLE_CASE_SCHEMA_BATCH_3,
  ...REMAINING_ARTICLE_CASE_SCHEMA_BATCH_4,
  ...LOCATION_SCHEMA_BATCH_1,
  ...LOCATION_SCHEMA_BATCH_2,
  ...UTILITY_SCHEMA_BATCH,
];
const EXPECTED_REMOVAL_STAGES = [
  { stage_id: "three-page-pilot", status: "complete", files: IMAGE_PILOT_FILES },
  { stage_id: "service-page-batch", status: "implemented", files: SERVICE_SCHEMA_FILES },
  { stage_id: "brand-model-page-batch", status: "implemented", files: BRAND_MODEL_SCHEMA_FILES },
  { stage_id: "guide-page-batch", status: "implemented", files: GUIDE_SCHEMA_FILES },
  { stage_id: "case-page-pilot", status: "implemented", files: CASE_SCHEMA_PILOT_FILES },
  { stage_id: "bmw-case-page-batch", status: "implemented", files: BMW_CASE_SCHEMA_FILES },
  { stage_id: "remaining-article-case-batch-1", status: "implemented", files: REMAINING_ARTICLE_CASE_SCHEMA_BATCH_1 },
  { stage_id: "remaining-article-case-batch-2", status: "implemented", files: REMAINING_ARTICLE_CASE_SCHEMA_BATCH_2 },
  { stage_id: "remaining-article-case-batch-3", status: "implemented", files: REMAINING_ARTICLE_CASE_SCHEMA_BATCH_3 },
  { stage_id: "remaining-article-case-batch-4", status: "implemented", files: REMAINING_ARTICLE_CASE_SCHEMA_BATCH_4 },
  { stage_id: "location-page-batch-1", status: "implemented", files: LOCATION_SCHEMA_BATCH_1 },
  { stage_id: "location-page-batch-2", status: "implemented", files: LOCATION_SCHEMA_BATCH_2 },
  { stage_id: "utility-page-batch", status: "implemented", files: UTILITY_SCHEMA_BATCH },
];
const APPROVED_NON_SCHEMA_HTML_CHANGES = new Map([
  [
    "article-us-car-market-tech.html",
    [[
      'class="mt-12 flex justify-center"',
      'class="mt-12 flex flex-col items-center justify-center"',
    ]],
  ],
  [
    "article-bmw-118-beitun-akl.html",
    [
      ['class="mt-12 flex justify-center"', 'class="mt-12 flex flex-col items-center justify-center"'],
      ["台中北屯 24H 救援", "台中北屯救援諮詢"],
      ["台中 24H 救援：0909-277-670", "台中救援諮詢：0909-277-670"],
    ],
  ],
  [
    "article-bmw-220i-2015-yunlin-akl.html",
    [["24H 救援專線", "汽車鑰匙救援專線"]],
  ],
  [
    "article-bmw-740-yuanli-akl.html",
    [
      ['class="mt-12 flex justify-center"', 'class="mt-12 flex flex-col items-center justify-center"'],
      ["苗栗 24H 救援：0909-277-670", "苗栗救援諮詢：0909-277-670"],
    ],
  ],
  [
    "article-bmw-elv-red-lock-fix.html",
    [["24H 救援專線", "汽車鑰匙救援專線"]],
  ],
  [
    "article-bmw-gseries-keyless-rescue.html",
    [["24H 救援專線：0909-277-670", "汽車鑰匙救援專線：0909-277-670"]],
  ],
  [
    "article-bmw-gt535i-renwu-akl.html",
    [['class="mt-12 flex justify-center"', 'class="mt-12 flex flex-col items-center justify-center"']],
  ],
  [
    "article-bmw-x3-linkou-auction-akl.html",
    [['class="mt-12 flex justify-center"', 'class="mt-12 flex flex-col items-center justify-center"']],
  ],
  [
    "article-bmw-x5-battery-fix.html",
    [
      ["<!-- 24H 浮動救援按鈕 -->", "<!-- 浮動救援按鈕 -->"],
      [">24H CALL</a>", ">CALL</a>"],
      [">24H Hotline</span>", ">Phone</span>"],
    ],
  ],
]);

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
      if (node["@id"] === BUSINESS_ID && Object.hasOwn(node, "@type")) {
        businessNodes += 1;
        if (AREA_SERVED_ROLLOUT_FILES.includes(relPath) && Object.hasOwn(node, "areaServed")) {
          errors.push(`${relPath}: unverified business areaServed regressed at ${jsonPath}`);
        }
      }
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

function withoutBusinessAreaServed(value) {
  const copy = structuredClone(value);
  walkJson(copy, (node) => {
    if (node["@id"] === BUSINESS_ID && Object.hasOwn(node, "@type")) delete node.areaServed;
  });
  return copy;
}

function removeLegacyPriceRangeFromHtml(html) {
  return html
    .replaceAll(',"priceRange":"$$"', "")
    .replaceAll(', "priceRange": "$$"', "")
    .replace(/^\s*"priceRange": "\$\$",\r?\n/gm, "");
}

function removeGovernedBusinessAreaServedFromHtml(html, relPath, errors) {
  const removal = AREA_SERVED_HTML_REMOVALS.get(relPath);
  if (!removal) return html;
  const occurrences = html.split(removal).length - 1;
  const expectedOccurrences = [
    "index.html",
    "article-bmw-smart-key-owner-guide.html",
    "toyota-altis-car-key.html",
    ...AREA_SERVED_GUIDE_BATCH_1_FILES,
    ...AREA_SERVED_GUIDE_BATCH_2_FILES,
    ...AREA_SERVED_GUIDE_BATCH_3_FILES,
    ...AREA_SERVED_GUIDE_BATCH_4_FILES,
  ].includes(relPath) ? 1 : 2;
  if (occurrences !== expectedOccurrences) {
    errors.push(`${relPath}: HEAD business areaServed baseline count drifted (expected ${expectedOccurrences}, found ${occurrences})`);
    return html;
  }
  return html.replace(removal, "");
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
  let expectedPayloads = withoutPriceRange(headPayloads);
  if (AREA_SERVED_ROLLOUT_FILES.includes(relPath)) {
    expectedPayloads = withoutBusinessAreaServed(expectedPayloads);
  }
  try {
    assert.deepEqual(currentPayloads, expectedPayloads);
  } catch {
    errors.push(`${relPath}: JSON-LD changed beyond registered evidence-gated removals from the HEAD baseline`);
  }

  let expectedHtml = removeLegacyPriceRangeFromHtml(headHtml);
  if (AREA_SERVED_ROLLOUT_FILES.includes(relPath)) {
    expectedHtml = removeGovernedBusinessAreaServedFromHtml(expectedHtml, relPath, errors);
  }
  const approvedReplacements = APPROVED_NON_SCHEMA_HTML_CHANGES.get(relPath);
  if (approvedReplacements) {
    for (const [before, after] of approvedReplacements) {
      const beforeOccurrences = expectedHtml.split(before).length - 1;
      const afterOccurrences = expectedHtml.split(after).length - 1;
      if (beforeOccurrences === 1 && afterOccurrences === 0) {
        expectedHtml = expectedHtml.replace(before, after);
      } else if (!(beforeOccurrences === 0 && afterOccurrences === 1)) {
        errors.push(`${relPath}: approved non-schema baseline state invalid (before ${beforeOccurrences}, after ${afterOccurrences})`);
      }
    }
  }
  if (currentHtml !== expectedHtml) {
    errors.push(`${relPath}: HTML changed beyond registered evidence-gated removals from the HEAD baseline`);
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
  if (!priceRange || priceRange.value !== null || priceRange.status !== "not_applicable" || priceRange.publish !== false ||
      priceRange.pricing_model !== "case_by_case_quote" || priceRange.schema_output !== "omit") {
    errors.push("data/business-entity.json: case-by-case pricing policy must keep priceRange omitted");
  }
  const migration = priceRange?.legacy_observation;
  if (JSON.stringify(migration?.removal_stages) !== JSON.stringify(EXPECTED_REMOVAL_STAGES)) {
    errors.push("data/business-entity.json: priceRange removal stage order/scope drifted");
  }
  if (migration?.expected_remaining_after_current_stage !== 0 || migration?.rollout_status !== "price_range_closed") {
    errors.push("data/business-entity.json: priceRange closure count/status drifted");
  }
  const serviceArea = business?.fields?.serviceArea;
  const serviceAreaMigration = serviceArea?.legacy_schema_observation;
  if (serviceArea?.status !== "unverified" || serviceArea?.publish !== false || serviceArea?.value?.length !== 0) {
    errors.push("data/business-entity.json: unverified serviceArea must remain unpublished and empty");
  }
  if (JSON.stringify(serviceAreaMigration?.removal_stages) !== JSON.stringify([
    { stage_id: "three-page-pilot", status: "implemented", files: AREA_SERVED_PILOT_FILES },
    { stage_id: "service-page-batch", status: "implemented", files: SERVICE_SCHEMA_FILES },
    { stage_id: "brand-model-page-batch", status: "implemented", files: BRAND_MODEL_SCHEMA_FILES },
    { stage_id: "guide-page-batch-1", status: "implemented", files: AREA_SERVED_GUIDE_BATCH_1_FILES },
    { stage_id: "guide-page-batch-2", status: "implemented", files: AREA_SERVED_GUIDE_BATCH_2_FILES },
    { stage_id: "guide-page-batch-3", status: "implemented", files: AREA_SERVED_GUIDE_BATCH_3_FILES },
    { stage_id: "guide-page-batch-4", status: "implemented", files: AREA_SERVED_GUIDE_BATCH_4_FILES },
  ]) || serviceAreaMigration?.baseline_file_count !== 133 || serviceAreaMigration?.baseline_node_count !== 133 ||
      JSON.stringify(serviceAreaMigration?.already_compliant_files) !== JSON.stringify(AREA_SERVED_ALREADY_COMPLIANT_GUIDE_FILES) ||
      serviceAreaMigration?.guide_scope_status !== "closed_no_shared_business_area_served" ||
      serviceAreaMigration?.expected_remaining_file_count !== 100 || serviceAreaMigration?.expected_remaining_node_count !== 100 ||
      serviceAreaMigration?.rollout_status !== "controlled_rollout") {
    errors.push("data/business-entity.json: serviceArea rollout scope/count/status drifted");
  }
}

function runSelfTests() {
  const badBusiness = {
    fields: {
      priceRange: {
        value: "$$",
        status: "verified",
        publish: true,
        pricing_model: "fixed_range",
        schema_output: "publish",
        legacy_observation: {
          removal_stages: EXPECTED_REMOVAL_STAGES,
          expected_remaining_after_current_stage: 0,
          rollout_status: "price_range_closed",
        },
      },
      serviceArea: {
        value: [],
        status: "unverified",
        publish: false,
        legacy_schema_observation: {
          baseline_file_count: 133,
          baseline_node_count: 133,
          removal_stages: [
            { stage_id: "three-page-pilot", status: "implemented", files: AREA_SERVED_PILOT_FILES },
            { stage_id: "service-page-batch", status: "implemented", files: SERVICE_SCHEMA_FILES },
            { stage_id: "brand-model-page-batch", status: "implemented", files: BRAND_MODEL_SCHEMA_FILES },
            { stage_id: "guide-page-batch-1", status: "implemented", files: AREA_SERVED_GUIDE_BATCH_1_FILES },
            { stage_id: "guide-page-batch-2", status: "implemented", files: AREA_SERVED_GUIDE_BATCH_2_FILES },
            { stage_id: "guide-page-batch-3", status: "implemented", files: AREA_SERVED_GUIDE_BATCH_3_FILES },
            { stage_id: "guide-page-batch-4", status: "implemented", files: AREA_SERVED_GUIDE_BATCH_4_FILES },
          ],
          already_compliant_files: AREA_SERVED_ALREADY_COMPLIANT_GUIDE_FILES,
          guide_scope_status: "closed_no_shared_business_area_served",
          expected_remaining_file_count: 100,
          expected_remaining_node_count: 100,
          rollout_status: "controlled_rollout",
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
  assert.equal(removeLegacyPriceRangeFromHtml('{"name":"x","priceRange":"$$"}'), '{"name":"x"}');
  assert.equal(removeLegacyPriceRangeFromHtml('{"name": "x", "priceRange": "$$"}'), '{"name": "x"}');
  assert.equal(removeLegacyPriceRangeFromHtml('  "priceRange": "$$",\n  "name": "x"'), '  "name": "x"');
  assert.deepEqual(withoutBusinessAreaServed({
    "@graph": [
      { "@id": BUSINESS_ID, "@type": "LocalBusiness", areaServed: ["x"] },
      { "@id": "#service", "@type": "Service", areaServed: ["x"] },
    ],
  }), {
    "@graph": [
      { "@id": BUSINESS_ID, "@type": "LocalBusiness" },
      { "@id": "#service", "@type": "Service", areaServed: ["x"] },
    ],
  });
  assert.deepEqual(APPROVED_NON_SCHEMA_HTML_CHANGES.get("article-us-car-market-tech.html"), [[
    'class="mt-12 flex justify-center"',
    'class="mt-12 flex flex-col items-center justify-center"',
  ],
  ]);
  assert.equal(classifyImageSource("${escapeHtml(src)}"), "dynamic");
  assert.equal(classifyImageSource("https://example.com/image.svg"), "external");
  assert.equal(classifyImageSource("img/local.jpg"), "local");
  console.log("Schema/image pilot negative-gate checks passed: 4");
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
