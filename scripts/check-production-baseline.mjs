import { createHash } from "node:crypto";

const DEFAULT_BASE_URL = "https://www.carkey.com.tw";
const DEFAULT_REPOSITORY = "JuiHsuan-otto/procore-auto-key";
const TARGETS = [
  { urlPath: "/", file: "index.html" },
  { urlPath: "/robots.txt", file: "robots.txt" },
  { urlPath: "/sitemap.xml", file: "sitemap.xml" },
  { urlPath: "/car-key-lost-service", file: "car-key-lost-service.html" },
  { urlPath: "/article-bmw-smart-key-owner-guide", file: "article-bmw-smart-key-owner-guide.html" },
  { urlPath: "/article-audi-r8-neihu-all-keys-lost", file: "article-audi-r8-neihu-all-keys-lost.html" },
  { urlPath: "/assets/js/procore-conversion-tracking.js", file: "assets/js/procore-conversion-tracking.js" },
];
const HEADER_NAMES = [
  "content-type",
  "content-length",
  "etag",
  "last-modified",
  "cache-control",
  "server",
  "x-vercel-cache",
  "x-vercel-id",
];

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function taipeiTimestamp(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`;
}

function summarizeHeaders(headers) {
  return Object.fromEntries(HEADER_NAMES.map((name) => [name, headers.get(name) || null]));
}

async function fetchBody(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "CarKey-SEO-Baseline/1.0" },
  });
  const body = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    finalUrl: response.url,
    headers: summarizeHeaders(response.headers),
    bodySha256: sha256(body),
  };
}

const remoteMainSha = getArg("--remote-sha");
const baseUrl = getArg("--base-url", DEFAULT_BASE_URL).replace(/\/$/, "");
const repository = getArg("--repository", DEFAULT_REPOSITORY);

if (!/^[0-9a-f]{40}$/i.test(remoteMainSha)) {
  console.error("Usage: node scripts/check-production-baseline.mjs --remote-sha <40-character SHA>");
  process.exit(1);
}

const observation = {
  observationType: "point-in-time-production-baseline",
  capturedAtAsiaTaipei: taipeiTimestamp(),
  remoteMainSha,
  baseUrl,
  repository,
  immutablePolicy: "Report later drift; never rewrite this observation or production to make a comparison pass.",
  targets: [],
};

for (const target of TARGETS) {
  const productionUrl = `${baseUrl}${target.urlPath}`;
  const remoteFileUrl = `https://raw.githubusercontent.com/${repository}/${remoteMainSha}/${target.file}`;
  const [production, remote] = await Promise.all([fetchBody(productionUrl), fetchBody(remoteFileUrl)]);
  observation.targets.push({
    ...target,
    productionUrl,
    production,
    remoteFileUrl,
    remote: { status: remote.status, bodySha256: remote.bodySha256 },
    result:
      production.status === 200 && remote.status === 200 && production.bodySha256 === remote.bodySha256
        ? "match"
        : "drift",
  });
}

observation.summary = {
  checked: observation.targets.length,
  match: observation.targets.filter((target) => target.result === "match").length,
  drift: observation.targets.filter((target) => target.result === "drift").length,
};

if (process.argv.includes("--summary")) {
  console.log(JSON.stringify({
    capturedAtAsiaTaipei: observation.capturedAtAsiaTaipei,
    remoteMainSha: observation.remoteMainSha,
    summary: observation.summary,
    targets: observation.targets.map(({ urlPath, result }) => ({ urlPath, result })),
  }, null, 2));
} else {
  console.log(JSON.stringify(observation, null, 2));
}

if (process.argv.includes("--require-match") && observation.summary.drift > 0) process.exit(2);
