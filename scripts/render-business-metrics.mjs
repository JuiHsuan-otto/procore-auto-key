import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_FILE = "data/business-metrics.json";
const INDEX_FILE = "index.html";
const START_MARKER = "<!-- BUSINESS_METRICS_START -->";
const END_MARKER = "<!-- BUSINESS_METRICS_END -->";
const PUBLIC_EVIDENCE_FIELDS = [
  "source",
  "calculation_method",
  "evidence_location",
  "verified_by",
  "verified_at",
  "last_updated",
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function validateMetric(metric) {
  if (!metric.metric_id || !/^[a-z0-9_]+$/.test(metric.metric_id)) {
    throw new Error(`Invalid metric_id: ${metric.metric_id || "(missing)"}`);
  }
  if (!metric.label || !metric.fallback_label || !metric.fallback_text) {
    throw new Error(`${metric.metric_id}: label, fallback_label, and fallback_text are required`);
  }
  if (/\d/.test(metric.fallback_label) || /\d/.test(metric.fallback_text)) {
    throw new Error(`${metric.metric_id}: fallback copy must not contain digits`);
  }
  if (!new Set(["hidden", "draft", "public"]).has(metric.display_status)) {
    throw new Error(`${metric.metric_id}: invalid display_status ${metric.display_status}`);
  }
  if (metric.display_status === "public") {
    if (!Number.isFinite(metric.value)) {
      throw new Error(`${metric.metric_id}: public metric requires a finite numeric value`);
    }
    for (const field of PUBLIC_EVIDENCE_FIELDS) {
      if (metric[field] == null || metric[field] === "") {
        throw new Error(`${metric.metric_id}: public metric is missing ${field}`);
      }
    }
  }
}

function renderMetric(metric) {
  validateMetric(metric);
  const id = escapeHtml(metric.metric_id);

  if (metric.display_status === "public") {
    const value = escapeHtml(metric.value);
    return [
      `  <div class="stat-card" data-metric-id="${id}" data-metric-status="public">`,
      `   <div class="stat-number counter" data-target="${value}">${value}</div>`,
      `   <div class="text-[10px] text-gray-500 tracking-widest uppercase">${escapeHtml(metric.label)}</div>`,
      "  </div>",
    ].join("\n");
  }

  return [
    `  <div class="stat-card" data-metric-id="${id}" data-metric-status="fallback">`,
    `   <div class="stat-number metric-fallback">${escapeHtml(metric.fallback_text)}</div>`,
    `   <div class="text-[10px] text-gray-500 tracking-widest uppercase">${escapeHtml(metric.fallback_label)}</div>`,
    "  </div>",
  ].join("\n");
}

function renderBlock(metrics) {
  const ids = new Set();
  for (const metric of metrics) {
    if (ids.has(metric.metric_id)) throw new Error(`Duplicate metric_id: ${metric.metric_id}`);
    ids.add(metric.metric_id);
  }

  return [
    START_MARKER,
    '<section class="py-12 bg-zinc-900/50" aria-labelledby="service-information-title">',
    ' <h2 id="service-information-title" class="metric-section-title">服務資訊</h2>',
    ' <div class="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-4">',
    metrics.map(renderMetric).join("\n"),
    " </div>",
    "</section>",
    END_MARKER,
  ].join("\n");
}

async function main() {
  const [dataText, indexHtml] = await Promise.all([
    fsp.readFile(path.join(ROOT, DATA_FILE), "utf8"),
    fsp.readFile(path.join(ROOT, INDEX_FILE), "utf8"),
  ]);
  const data = JSON.parse(dataText);
  const blockPattern = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`);
  if (!blockPattern.test(indexHtml)) {
    throw new Error(`${INDEX_FILE}: generated metric block markers are missing`);
  }

  const expected = indexHtml.replace(blockPattern, renderBlock(data.metrics || []));
  const checkOnly = process.argv.includes("--check");
  if (expected === indexHtml) {
    console.log(`${INDEX_FILE}: business metric block is current`);
    return;
  }
  if (checkOnly) {
    console.error(`${INDEX_FILE}: business metric block does not match ${DATA_FILE}`);
    process.exit(1);
  }

  await fsp.writeFile(path.join(ROOT, INDEX_FILE), expected);
  console.log(`${INDEX_FILE}: rendered ${(data.metrics || []).length} governed business metrics`);
}

await main();
