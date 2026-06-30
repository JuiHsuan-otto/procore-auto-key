import fsp from "node:fs/promises";

const HELP = `
Usage:
  node scripts/reconcile-ga-gsc.mjs --gsc path/to/gsc-pages.csv --ga path/to/ga4-landing-pages.csv [--out report.csv] [--top 20]

Expected exports:
  GSC: Performance > Pages export with page, clicks, impressions, CTR, position.
  GA4: Landing page report for the same date range, ideally filtered to google / organic.

Notes:
  - If the GA4 CSV includes source / medium or channel columns, this script keeps google organic / Organic Search rows.
  - If those columns are absent, the GA4 CSV is assumed to already be filtered.
  - GSC clicks should be compared to GA4 sessions, not GA4 active users.
`;

const COLUMN_ALIASES = {
  page: [
    "page",
    "top pages",
    "landing page",
    "landing page + query string",
    "page path",
    "page path and screen class",
    "網頁",
    "頁面",
    "熱門網頁",
    "到達網頁",
    "到達網頁 + 查詢字串",
  ],
  clicks: ["clicks", "clicks from google search", "點擊", "點擊次數"],
  impressions: ["impressions", "曝光", "曝光次數"],
  ctr: ["ctr", "click through rate", "點閱率", "點擊率"],
  position: ["position", "average position", "平均排名", "排名"],
  sessions: ["sessions", "organic sessions", "工作階段", "工作階段數"],
  activeUsers: ["active users", "users", "活躍使用者", "使用者"],
  keyEvents: ["key events", "conversions", "重要事件", "轉換"],
  eventCount: ["event count", "事件計數"],
  sourceMedium: ["session source / medium", "source / medium", "工作階段來源 / 媒介", "來源 / 媒介"],
  channel: ["session default channel group", "default channel group", "工作階段預設管道群組", "預設管道群組"],
};

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function normalizeHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((header) => header.trim());
  const records = rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || "";
    });
    return record;
  });
  return { headers, records };
}

async function readCsv(filePath) {
  const raw = await fsp.readFile(filePath, "utf8");
  return rowsToObjects(parseCsv(raw));
}

function findColumn(headers, aliases) {
  const normalized = headers.map((header) => [header, normalizeHeader(header)]);
  const normalizedAliases = aliases.map(normalizeHeader);

  for (const alias of normalizedAliases) {
    const exact = normalized.find(([, header]) => header === alias);
    if (exact) return exact[0];
  }

  for (const alias of normalizedAliases) {
    const partial = normalized.find(([, header]) => header.includes(alias));
    if (partial) return partial[0];
  }

  return null;
}

function numberFrom(value) {
  const cleaned = String(value || "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/[^\d.+-]/g, "")
    .trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePagePath(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "(not set)") return "(not set)";

  let pathname = raw;
  try {
    const url = raw.startsWith("http") ? new URL(raw) : new URL(raw, "https://www.carkey.com.tw");
    pathname = url.pathname;
  } catch {
    pathname = raw.split(/[?#]/, 1)[0];
  }

  pathname = decodeURIComponent(pathname || "/").replace(/\.html$/i, "");
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/g, "");
  return pathname || "/";
}

function getRequiredColumns(headers, required) {
  const result = {};
  for (const [key, aliases] of Object.entries(required)) {
    result[key] = findColumn(headers, aliases);
  }
  return result;
}

function addToMap(map, pathName, values) {
  const current = map.get(pathName) || {};
  for (const [key, value] of Object.entries(values)) {
    current[key] = (current[key] || 0) + value;
  }
  map.set(pathName, current);
}

function shouldIncludeGaRecord(record, columns) {
  const sourceMedium = columns.sourceMedium ? String(record[columns.sourceMedium] || "").toLowerCase() : "";
  const channel = columns.channel ? String(record[columns.channel] || "").toLowerCase() : "";

  if (sourceMedium) return sourceMedium.includes("google") && sourceMedium.includes("organic");
  if (channel) return channel.includes("organic search");
  return true;
}

function mergeRecords(gscMap, gaMap) {
  const paths = new Set([...gscMap.keys(), ...gaMap.keys()]);
  return [...paths].map((pathName) => {
    const gsc = gscMap.get(pathName) || {};
    const ga = gaMap.get(pathName) || {};
    const clicks = gsc.clicks || 0;
    const sessions = ga.sessions || 0;
    const keyEvents = ga.keyEvents || 0;
    return {
      path: pathName,
      gscClicks: clicks,
      gscImpressions: gsc.impressions || 0,
      gscCtr: gsc.ctr || 0,
      gscPosition: gsc.position || 0,
      gaSessions: sessions,
      gaActiveUsers: ga.activeUsers || 0,
      gaKeyEvents: keyEvents,
      gaEventCount: ga.eventCount || 0,
      sessionMinusClick: sessions - clicks,
      sessionToClickRatio: clicks ? sessions / clicks : null,
      leadRate: sessions ? keyEvents / sessions : null,
    };
  });
}

function formatPercent(value) {
  if (value === null || !Number.isFinite(value)) return "";
  return `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value) {
  if (value === null || !Number.isFinite(value)) return "";
  return value.toFixed(2);
}

function tableRows(rows) {
  return rows.map((row) => ({
    path: row.path,
    gscClicks: row.gscClicks,
    gscImpressions: row.gscImpressions,
    gaSessions: row.gaSessions,
    gaKeyEvents: row.gaKeyEvents,
    sessionMinusClick: row.sessionMinusClick,
    sessionToClickRatio: formatRatio(row.sessionToClickRatio),
    leadRate: formatPercent(row.leadRate),
  }));
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

async function writeCsv(filePath, rows) {
  const headers = [
    "path",
    "gscClicks",
    "gscImpressions",
    "gscCtr",
    "gscPosition",
    "gaSessions",
    "gaActiveUsers",
    "gaKeyEvents",
    "gaEventCount",
    "sessionMinusClick",
    "sessionToClickRatio",
    "leadRate",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];
  await fsp.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h") || process.argv.length <= 2) {
    console.log(HELP.trim());
    return;
  }

  const gscPath = getArg("--gsc");
  const gaPath = getArg("--ga");
  const outPath = getArg("--out");
  const top = Number(getArg("--top") || 20);

  if (!gscPath || !gaPath) {
    console.error(HELP.trim());
    process.exit(1);
  }

  const gscCsv = await readCsv(gscPath);
  const gaCsv = await readCsv(gaPath);
  const gscColumns = getRequiredColumns(gscCsv.headers, {
    page: COLUMN_ALIASES.page,
    clicks: COLUMN_ALIASES.clicks,
    impressions: COLUMN_ALIASES.impressions,
    ctr: COLUMN_ALIASES.ctr,
    position: COLUMN_ALIASES.position,
  });
  const gaColumns = getRequiredColumns(gaCsv.headers, {
    page: COLUMN_ALIASES.page,
    sessions: COLUMN_ALIASES.sessions,
    activeUsers: COLUMN_ALIASES.activeUsers,
    keyEvents: COLUMN_ALIASES.keyEvents,
    eventCount: COLUMN_ALIASES.eventCount,
    sourceMedium: COLUMN_ALIASES.sourceMedium,
    channel: COLUMN_ALIASES.channel,
  });

  if (!gscColumns.page || !gscColumns.clicks || !gscColumns.impressions) {
    console.error(`Missing required GSC columns. Found: ${gscCsv.headers.join(", ")}`);
    process.exit(1);
  }

  if (!gaColumns.page || !gaColumns.sessions) {
    console.error(`Missing required GA4 columns. Found: ${gaCsv.headers.join(", ")}`);
    process.exit(1);
  }

  const gscMap = new Map();
  for (const record of gscCsv.records) {
    addToMap(gscMap, normalizePagePath(record[gscColumns.page]), {
      clicks: numberFrom(record[gscColumns.clicks]),
      impressions: numberFrom(record[gscColumns.impressions]),
      ctr: numberFrom(record[gscColumns.ctr]),
      position: numberFrom(record[gscColumns.position]),
    });
  }

  const gaMap = new Map();
  for (const record of gaCsv.records) {
    if (!shouldIncludeGaRecord(record, gaColumns)) continue;
    addToMap(gaMap, normalizePagePath(record[gaColumns.page]), {
      sessions: numberFrom(record[gaColumns.sessions]),
      activeUsers: numberFrom(record[gaColumns.activeUsers]),
      keyEvents: numberFrom(record[gaColumns.keyEvents]),
      eventCount: numberFrom(record[gaColumns.eventCount]),
    });
  }

  const merged = mergeRecords(gscMap, gaMap).sort((a, b) => b.gscImpressions - a.gscImpressions);
  const totals = merged.reduce(
    (acc, row) => {
      acc.gscClicks += row.gscClicks;
      acc.gscImpressions += row.gscImpressions;
      acc.gaSessions += row.gaSessions;
      acc.gaActiveUsers += row.gaActiveUsers;
      acc.gaKeyEvents += row.gaKeyEvents;
      return acc;
    },
    { gscClicks: 0, gscImpressions: 0, gaSessions: 0, gaActiveUsers: 0, gaKeyEvents: 0 },
  );

  const mismatches = [...merged]
    .filter((row) => row.gscClicks || row.gaSessions)
    .sort((a, b) => Math.abs(b.sessionMinusClick) - Math.abs(a.sessionMinusClick))
    .slice(0, top);
  const impressionsNoClicks = merged
    .filter((row) => row.gscImpressions > 0 && row.gscClicks === 0)
    .slice(0, top);
  const clicksNoSessions = merged
    .filter((row) => row.gscClicks > 0 && row.gaSessions === 0)
    .slice(0, top);

  console.log("GA4 / GSC reconciliation");
  console.log(`GSC clicks: ${totals.gscClicks}`);
  console.log(`GSC impressions: ${totals.gscImpressions}`);
  console.log(`GA4 google organic sessions: ${totals.gaSessions}`);
  console.log(`GA4 active users: ${totals.gaActiveUsers}`);
  console.log(`GA4 key events: ${totals.gaKeyEvents}`);
  console.log(`Organic session / GSC click ratio: ${formatRatio(totals.gscClicks ? totals.gaSessions / totals.gscClicks : null)}`);
  console.log(`Lead rate from GA4 sessions: ${formatPercent(totals.gaSessions ? totals.gaKeyEvents / totals.gaSessions : null)}`);

  console.log("\nLargest session/click gaps:");
  console.table(tableRows(mismatches));

  console.log("\nGSC impressions with zero clicks:");
  console.table(tableRows(impressionsNoClicks));

  console.log("\nGSC clicks with zero GA4 sessions:");
  console.table(tableRows(clicksNoSessions));

  if (outPath) {
    await writeCsv(outPath, merged);
    console.log(`\nWrote ${outPath}`);
  }
}

await main();
