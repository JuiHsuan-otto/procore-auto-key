import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const CONTRACT_VERSION = "1.0.0";
export const PACKAGE_FORMAT = "hashed-directory/v1";
export const SOURCE_SYSTEM = "casepilot-automotive";
export const TARGET_SYSTEM = "carkey.com.tw";

export class PublicationImportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PublicationImportError";
    this.code = code;
  }
}

const MANIFEST_FIELDS = ["contract_version", "package_format", "candidate_id", "candidate_hash", "source_system", "target_system", "created_at", "content_type", "files", "package_hash", "synthetic", "network_required"];
const MANIFEST_FILE_FIELDS = ["path", "sha256", "byte_length", "mime"];
const CANDIDATE_FIELDS = ["contract_version", "candidate_id", "source_case_opaque_reference", "candidate_revision", "candidate_status", "candidate_hash", "synthetic", "locale", "source_system", "target_system", "taxonomy", "proposed_public_copy", "assets", "approval_audit", "carkey_owned_result"];
const TAXONOMY_FIELDS = ["content_type", "service_scenario", "vehicle_brand", "vehicle_model", "model_year", "key_situation", "remaining_key_state", "generalized_city_county", "generalized_scene", "related_existing_service_route", "suggested_existing_internal_links"];
const COPY_FIELDS = ["proposed_slug", "proposed_title", "proposed_description", "sanitized_summary", "sanitized_narrative", "public_safe_facts", "safety_note", "cta_intent"];
const ASSET_FIELDS = ["asset_id", "relative_package_path", "mime", "width", "height", "sha256", "sanitization_status", "metadata_inspection", "alt_text", "public_use_approval_status"];
const APPROVAL_FIELDS = ["authorization_evidence_opaque_reference", "authorization_verified", "sanitization_reviewed", "approved_for_export", "reviewer_role", "source_hashes", "candidate_hash", "created_at", "updated_at"];
const SOURCE_HASH_FIELDS = ["kind", "sha256"];
const CARKEY_RESULT_FIELDS = ["final_slug", "canonical_url", "published_commit", "deployment_id", "published_url", "sitemap_entry", "final_schema", "publication_date"];
const RECEIPT_FIELDS = ["contract_version", "receipt_version", "candidate_id", "candidate_hash", "package_hash", "source_system", "target_system", "content_type", "synthetic", "result", "draft_path", "validation_report_path", "proposed_slug", "final_slug", "canonical_url", "sitemap_modified", "public_root_modified", "network_used", "imported_at"];

const SHA256 = /^[0-9a-f]{64}$/;
const CANDIDATE_ID = /^cpc_[0-9a-f]{16}$/;
const CLEAN_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CLEAN_ROUTE = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

const FORBIDDEN_PUBLIC_KEYS = new Set([
  "name",
  "customername",
  "ownername",
  "phone",
  "customerphone",
  "email",
  "customeremail",
  "address",
  "fulladdress",
  "exactaddress",
  "plate",
  "licenseplate",
  "vin",
  "gps",
  "latitude",
  "longitude",
  "preciseparkinglocation",
  "rawmessage",
  "rawconversation",
  "transcript",
  "identitydocument",
  "authorizationdocument",
  "payment",
  "paymentcard",
  "oauth",
  "session",
  "sessionid",
  "token",
  "cookie",
  "apikey",
  "secret",
  "technicalnotes",
  "securityprocedure",
  "originalphoto",
  "rawimage"
]);

const PUBLIC_CONTENT_PATTERNS = [
  ["PRIVATE_CONTACT_EMAIL", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ["PRIVATE_CONTACT_PHONE", /(?:\+?886|0)\s?9\d{2}[\s-]?\d{3}[\s-]?\d{3}/],
  ["PRIVATE_VIN", /\b[A-HJ-NPR-Z0-9]{17}\b/i],
  ["PRIVATE_PLATE", /\b(?:[A-Z]{2,3}-\d{3,4}|\d{3,4}-[A-Z]{2,3})\b/],
  ["PRIVATE_PRECISE_ADDRESS", /(?:\d+\s+\S+\s+(?:road|street|lane|avenue)|[路街巷弄]\s*\d+\s*號)/i],
  ["PRIVATE_GPS", /\b(?:lat(?:itude)?|lon(?:gitude)?|gps)\s*[:=]|\b-?\d{2,3}\.\d{5,}\s*,\s*-?\d{2,3}\.\d{5,}/i],
  ["TECHNICAL_SENSITIVE", /\b(?:bypass|hot-?wire|immobili[sz]er\s+(?:clone|disable)|relay\s+attack|rolling\s+code\s+capture)\b/i],
  ["TECHNICAL_SENSITIVE", /(?:防盜|晶片|鎖具).{0,16}(?:破解|繞過|複製碼|拆解步驟)/],
  ["UNSUPPORTED_PROMISE", /(?:保證|固定價格|一定免拖車|所有車型|\d+\s*分鐘(?:內)?完成)/],
  ["PUBLIC_BRAND_BOUNDARY", /casepilot/i]
];

const SERVICE_SCENARIOS = {
  all_keys_lost: {
    route: "/all-keys-lost-service",
    keySituations: new Set(["key_lost", "smart_key_lost"]),
    remainingKeys: new Set(["none"]),
    label: "鑰匙全丟"
  },
  spare_key: {
    route: "/spare-car-key-service",
    keySituations: new Set(["spare_key_requested"]),
    remainingKeys: new Set(["one_or_more"]),
    label: "備用鑰匙",
    titleLabels: new Set(["備用鑰匙", "智慧鑰匙新增"])
  },
  key_not_detected: {
    route: "/key-not-detected-service",
    keySituations: new Set(["key_not_detected"]),
    remainingKeys: new Set(["one_or_more", "unknown"]),
    label: "鑰匙未偵測"
  }
};

const SUPPORTED_BRANDS = new Set(["Audi", "BMW", "Chevrolet", "Ford", "Honda", "Hyundai", "Infiniti", "Kia", "Land Rover", "Lexus", "Mazda", "Mercedes-Benz", "MINI", "Nissan", "Peugeot", "Porsche", "Skoda", "Toyota", "Volkswagen", "Volvo"]);
const GENERAL_LOCATIONS = new Set(["基隆市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣", "苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣"]);
const GENERAL_SCENES = new Set(["roadside", "residential_parking", "underground_parking", "repair_shop", "auction_site", "general_area"]);
const SAMPLE_CASE_PAGES = ["article-toyota-vios-2019-changhua-akl.html", "article-honda-hrv-2020-all-lost-changhua.html", "case-hyundai-venue-smartkey-lost.html"];

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizedKey(key) {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function assertExactKeys(value, fields, code, label) {
  if (!isPlainObject(value)) throw new PublicationImportError(code, `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new PublicationImportError(code, `${label} contains missing or unknown fields`);
  }
}

function assertNoForbiddenKeys(value, currentPath = "candidate", depth = 0) {
  if (depth > 12) throw new PublicationImportError("PRIVATE_FIELD_REJECTED", "Candidate nesting exceeds the public boundary");
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${currentPath}[${index}]`, depth + 1));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PUBLIC_KEYS.has(normalizedKey(key))) throw new PublicationImportError("PRIVATE_FIELD_REJECTED", `Forbidden public field at ${currentPath}.${key}`);
    assertNoForbiddenKeys(child, `${currentPath}.${key}`, depth + 1);
  }
}

function canonicalize(value, seen) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new PublicationImportError("NON_CANONICAL_VALUE", "Canonical JSON rejects non-finite numbers");
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, seen));
  if (!isPlainObject(value)) throw new PublicationImportError("NON_CANONICAL_VALUE", "Canonical JSON accepts plain JSON values only");
  if (seen.has(value)) throw new PublicationImportError("NON_CANONICAL_VALUE", "Canonical JSON rejects cycles");
  seen.add(value);
  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) throw new PublicationImportError("NON_CANONICAL_VALUE", "Canonical JSON rejects undefined values");
    output[key] = canonicalize(value[key], seen);
  }
  seen.delete(value);
  return output;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value, new Set()));
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function computeCandidateHash(candidate) {
  const hashInput = cloneJson(candidate);
  hashInput.candidate_id = "";
  hashInput.candidate_hash = "";
  hashInput.approval_audit.candidate_hash = "";
  return sha256(canonicalJson(hashInput));
}

export function computePackageHash(manifest) {
  const hashInput = cloneJson(manifest);
  hashInput.package_hash = "";
  return sha256(canonicalJson(hashInput));
}

function assertSafeText(value, label) {
  if (typeof value !== "string" || !value || value.trim() !== value) throw new PublicationImportError("PUBLIC_COPY_INVALID", `${label} must be a normalized string`);
  for (const [code, pattern] of PUBLIC_CONTENT_PATTERNS) {
    if (pattern.test(value)) throw new PublicationImportError(code, `${label} violates the public-content boundary`);
  }
}

function assertIsoTimestamp(value, code, label) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new PublicationImportError(code, `${label} must be an ISO-8601 UTC timestamp`);
  }
}

function assertManifest(manifest) {
  assertExactKeys(manifest, MANIFEST_FIELDS, "MANIFEST_SCHEMA_INVALID", "manifest");
  if (manifest.contract_version !== CONTRACT_VERSION) throw new PublicationImportError("CONTRACT_VERSION_MISMATCH", "Unsupported manifest contract version");
  if (manifest.package_format !== PACKAGE_FORMAT) throw new PublicationImportError("PACKAGE_FORMAT_MISMATCH", "Unsupported package format");
  if (manifest.source_system !== SOURCE_SYSTEM || manifest.target_system !== TARGET_SYSTEM) throw new PublicationImportError("SYSTEM_MISMATCH", "Source or target system mismatch");
  if (manifest.content_type !== "public_case") throw new PublicationImportError("CONTENT_TYPE_REJECTED", "Only public_case packages are supported");
  if (manifest.synthetic !== true) throw new PublicationImportError("SYNTHETIC_REQUIRED", "Wave 1 requires synthetic packages");
  if (manifest.network_required !== false) throw new PublicationImportError("NETWORK_BOUNDARY_REJECTED", "Package must declare no network requirement");
  if (!CANDIDATE_ID.test(manifest.candidate_id) || !SHA256.test(manifest.candidate_hash) || !SHA256.test(manifest.package_hash)) throw new PublicationImportError("MANIFEST_SCHEMA_INVALID", "Manifest identity hashes are malformed");
  assertIsoTimestamp(manifest.created_at, "MANIFEST_SCHEMA_INVALID", "manifest.created_at");
  if (!Array.isArray(manifest.files) || manifest.files.length < 2) throw new PublicationImportError("MANIFEST_SCHEMA_INVALID", "Manifest must list candidate and asset files");
  const paths = [];
  for (const file of manifest.files) {
    assertExactKeys(file, MANIFEST_FILE_FIELDS, "MANIFEST_SCHEMA_INVALID", "manifest.files[]");
    if (!/^(?:candidate\.json|assets\/[a-z0-9][a-z0-9._-]*)$/.test(file.path) || !SHA256.test(file.sha256) || !Number.isInteger(file.byte_length) || file.byte_length < 1) throw new PublicationImportError("MANIFEST_SCHEMA_INVALID", "Manifest file entry is invalid");
    if ((file.path === "candidate.json" && file.mime !== "application/json") || (file.path !== "candidate.json" && file.mime !== "image/svg+xml")) throw new PublicationImportError("ASSET_MIME_MISMATCH", "Manifest MIME does not match the path contract");
    paths.push(file.path);
  }
  if (paths.filter((file) => file === "candidate.json").length !== 1 || new Set(paths).size !== paths.length || [...paths].sort().some((file, index) => file !== paths[index])) throw new PublicationImportError("MANIFEST_SCHEMA_INVALID", "Manifest files must be unique and sorted by path");
  if (computePackageHash(manifest) !== manifest.package_hash) throw new PublicationImportError("PACKAGE_HASH_MISMATCH", "Package hash mismatch");
}

function assertCandidate(candidate) {
  assertNoForbiddenKeys(candidate);
  assertExactKeys(candidate, CANDIDATE_FIELDS, "CANDIDATE_SCHEMA_INVALID", "candidate");
  if (candidate.contract_version !== CONTRACT_VERSION) throw new PublicationImportError("CONTRACT_VERSION_MISMATCH", "Unsupported candidate contract version");
  if (candidate.source_system !== SOURCE_SYSTEM || candidate.target_system !== TARGET_SYSTEM) throw new PublicationImportError("SYSTEM_MISMATCH", "Candidate source or target mismatch");
  if (candidate.synthetic !== true) throw new PublicationImportError("SYNTHETIC_REQUIRED", "Candidate must be synthetic");
  if (candidate.locale !== "zh-TW" || candidate.candidate_status !== "approved_for_export" || !Number.isInteger(candidate.candidate_revision) || candidate.candidate_revision < 1) throw new PublicationImportError("CANDIDATE_SCHEMA_INVALID", "Candidate status, locale, or revision is invalid");
  if (!/^scp_[a-z0-9_-]{8,64}$/.test(candidate.source_case_opaque_reference)) throw new PublicationImportError("CANDIDATE_SCHEMA_INVALID", "Opaque source reference is malformed");
  if (!CANDIDATE_ID.test(candidate.candidate_id) || !SHA256.test(candidate.candidate_hash)) throw new PublicationImportError("CANDIDATE_SCHEMA_INVALID", "Candidate identity is malformed");

  assertExactKeys(candidate.taxonomy, TAXONOMY_FIELDS, "CANDIDATE_SCHEMA_INVALID", "candidate.taxonomy");
  assertExactKeys(candidate.proposed_public_copy, COPY_FIELDS, "CANDIDATE_SCHEMA_INVALID", "candidate.proposed_public_copy");
  assertExactKeys(candidate.approval_audit, APPROVAL_FIELDS, "CANDIDATE_SCHEMA_INVALID", "candidate.approval_audit");
  assertExactKeys(candidate.carkey_owned_result, CARKEY_RESULT_FIELDS, "CANDIDATE_SCHEMA_INVALID", "candidate.carkey_owned_result");
  if (!Array.isArray(candidate.assets) || candidate.assets.length < 1) throw new PublicationImportError("ASSET_REQUIRED", "Candidate requires at least one reviewed asset");
  candidate.assets.forEach((asset) => assertExactKeys(asset, ASSET_FIELDS, "CANDIDATE_SCHEMA_INVALID", "candidate.assets[]"));
  if (!Array.isArray(candidate.approval_audit.source_hashes) || candidate.approval_audit.source_hashes.length < 1) throw new PublicationImportError("CANDIDATE_SCHEMA_INVALID", "Candidate source hashes are required");
  candidate.approval_audit.source_hashes.forEach((entry) => {
    assertExactKeys(entry, SOURCE_HASH_FIELDS, "CANDIDATE_SCHEMA_INVALID", "approval_audit.source_hashes[]");
    if (!["sanitized_projection", "approved_asset"].includes(entry.kind) || !SHA256.test(entry.sha256)) throw new PublicationImportError("CANDIDATE_SCHEMA_INVALID", "Source hash entry is invalid");
  });
  if (candidate.approval_audit.authorization_verified !== true) throw new PublicationImportError("AUTHORIZATION_REQUIRED", "Authorization attestation is false");
  if (candidate.approval_audit.sanitization_reviewed !== true) throw new PublicationImportError("SANITIZATION_REQUIRED", "Sanitization review attestation is false");
  if (candidate.approval_audit.approved_for_export !== true || candidate.approval_audit.reviewer_role !== "owner") throw new PublicationImportError("OWNER_APPROVAL_REQUIRED", "Owner export approval is missing");
  if (!/^auth_[a-z0-9_-]{8,64}$/.test(candidate.approval_audit.authorization_evidence_opaque_reference)) throw new PublicationImportError("CANDIDATE_SCHEMA_INVALID", "Authorization opaque reference is malformed");
  assertIsoTimestamp(candidate.approval_audit.created_at, "CANDIDATE_SCHEMA_INVALID", "approval_audit.created_at");
  assertIsoTimestamp(candidate.approval_audit.updated_at, "CANDIDATE_SCHEMA_INVALID", "approval_audit.updated_at");
  if (candidate.approval_audit.candidate_hash !== candidate.candidate_hash) throw new PublicationImportError("APPROVAL_HASH_MISMATCH", "Approval does not bind the candidate hash");

  const calculatedHash = computeCandidateHash(candidate);
  if (calculatedHash !== candidate.candidate_hash || candidate.candidate_id !== `cpc_${calculatedHash.slice(0, 16)}`) throw new PublicationImportError("CANDIDATE_HASH_MISMATCH", "Candidate hash or derived ID mismatch");

  const result = candidate.carkey_owned_result;
  if (result.final_slug !== null || result.canonical_url !== null || result.published_commit !== null || result.deployment_id !== null || result.published_url !== null || result.sitemap_entry !== "pending" || result.final_schema !== "pending" || result.publication_date !== null) throw new PublicationImportError("CARKEY_AUTHORITY_VIOLATION", "Candidate attempts to set a CarKey-owned publication result");

  const copy = candidate.proposed_public_copy;
  for (const key of ["proposed_title", "proposed_description", "sanitized_summary", "sanitized_narrative", "safety_note"]) assertSafeText(copy[key], `proposed_public_copy.${key}`);
  const lengthRules = {
    proposed_title: [20, 90],
    proposed_description: [35, 180],
    sanitized_summary: [20, 240],
    sanitized_narrative: [80, 1200],
    safety_note: [15, 240]
  };
  for (const [key, [minimum, maximum]] of Object.entries(lengthRules)) {
    if (copy[key].length < minimum || copy[key].length > maximum) throw new PublicationImportError("PUBLIC_COPY_INVALID", `${key} violates contract length bounds`);
  }
  if (!Array.isArray(candidate.proposed_public_copy.public_safe_facts) || candidate.proposed_public_copy.public_safe_facts.length < 2) throw new PublicationImportError("PUBLIC_COPY_INVALID", "At least two public-safe facts are required");
  if (candidate.proposed_public_copy.public_safe_facts.length > 6) throw new PublicationImportError("PUBLIC_COPY_INVALID", "Public-safe facts exceed contract bounds");
  candidate.proposed_public_copy.public_safe_facts.forEach((fact, index) => {
    assertSafeText(fact, `public_safe_facts[${index}]`);
    if (fact.length < 8 || fact.length > 180) throw new PublicationImportError("PUBLIC_COPY_INVALID", "Public-safe fact violates contract length bounds");
  });
  if (!CLEAN_SLUG.test(copy.proposed_slug) || copy.proposed_slug.length > 100) throw new PublicationImportError("SLUG_INVALID", "Proposed slug is invalid");
  if (!["provide_vehicle_details_for_assessment", "contact_for_conditional_assessment"].includes(copy.cta_intent)) throw new PublicationImportError("PUBLIC_COPY_INVALID", "CTA intent is unsupported");
  if (!copy.proposed_title.includes("極致核心 ProCore")) throw new PublicationImportError("PUBLIC_BRAND_BOUNDARY", "Title must use the CarKey public brand");
  if (!/(?:依車款|依實車|現場條件|確認|評估)/.test(`${copy.proposed_description} ${copy.sanitized_narrative}`)) throw new PublicationImportError("CONDITIONAL_LANGUAGE_REQUIRED", "Public copy must remain conditional");
}

function assertTaxonomy(candidate, repositoryRoot) {
  const taxonomy = candidate.taxonomy;
  if (taxonomy.content_type !== "public_case") throw new PublicationImportError("CONTENT_TYPE_REJECTED", "Candidate taxonomy is not public_case");
  const scenario = SERVICE_SCENARIOS[taxonomy.service_scenario];
  if (!scenario) throw new PublicationImportError("UNSUPPORTED_SCENARIO", "Service scenario is not supported by CarKey");
  if (!SUPPORTED_BRANDS.has(taxonomy.vehicle_brand)) throw new PublicationImportError("UNSUPPORTED_BRAND", "Vehicle brand is not in the current CarKey evidence allowlist");
  if (typeof taxonomy.vehicle_model !== "string" || taxonomy.vehicle_model.length < 1 || !Number.isInteger(taxonomy.model_year) || taxonomy.model_year < 1980 || taxonomy.model_year > 2100) throw new PublicationImportError("INVALID_TAXONOMY", "Vehicle taxonomy is invalid");
  if (!scenario.keySituations.has(taxonomy.key_situation) || !scenario.remainingKeys.has(taxonomy.remaining_key_state) || taxonomy.related_existing_service_route !== scenario.route) throw new PublicationImportError("INVALID_TAXONOMY", "Scenario, key situation, remaining keys, and service route are inconsistent");
  if (!GENERAL_LOCATIONS.has(taxonomy.generalized_city_county) || !GENERAL_SCENES.has(taxonomy.generalized_scene)) throw new PublicationImportError("INVALID_TAXONOMY", "Location or scene is not an approved generalized value");
  const title = candidate.proposed_public_copy.proposed_title;
  const locationLabel = taxonomy.generalized_city_county.replace(/[市縣]$/, "");
  for (const required of [locationLabel, String(taxonomy.model_year), taxonomy.vehicle_brand, taxonomy.vehicle_model]) {
    if (!title.includes(required)) throw new PublicationImportError("CARKEY_TITLE_PATTERN_REJECTED", "Title is missing a required CarKey case component");
  }
  const titleLabels = scenario.titleLabels ?? new Set([scenario.label]);
  if (![...titleLabels].some((label) => title.includes(label))) {
    throw new PublicationImportError("CARKEY_TITLE_PATTERN_REJECTED", "Title is missing a required CarKey case component");
  }
  const links = taxonomy.suggested_existing_internal_links;
  if (!Array.isArray(links) || links.length < 2 || links.length > 4 || new Set(links).size !== links.length) throw new PublicationImportError("BROKEN_INTERNAL_LINK", "Suggested internal links must be a unique bounded list");
  for (const route of new Set([taxonomy.related_existing_service_route, ...links])) {
    if (!CLEAN_ROUTE.test(route)) throw new PublicationImportError("BROKEN_INTERNAL_LINK", "Internal link is not a clean route");
    const file = route === "/" ? "index.html" : `${route.slice(1)}.html`;
    if (!existsSync(path.join(repositoryRoot, file))) throw new PublicationImportError("BROKEN_INTERNAL_LINK", "Suggested internal link has no existing CarKey page");
  }
}

function inspectSvg(bytes, asset) {
  const source = bytes.toString("utf8");
  if (asset.mime !== "image/svg+xml" || !/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(source)) throw new PublicationImportError("ASSET_MIME_MISMATCH", "Asset bytes do not match image/svg+xml");
  if (/<(?:metadata|script|foreignObject)\b|\bon\w+\s*=|\bhref\s*=\s*["']https?:|\b(?:exif|gps|latitude|longitude)\b/i.test(source)) throw new PublicationImportError("ASSET_METADATA_REJECTED", "Asset metadata or active/external content is unsafe");
  const width = Number(source.match(/\bwidth=["'](\d+)["']/i)?.[1]);
  const height = Number(source.match(/\bheight=["'](\d+)["']/i)?.[1]);
  if (width !== asset.width || height !== asset.height || width !== 1200 || height !== 630) throw new PublicationImportError("ASSET_DIMENSION_MISMATCH", "Asset dimensions do not match the reviewed 1200x630 contract");
  if (asset.sanitization_status !== "sanitized" || asset.metadata_inspection !== "passed_no_exif_gps" || asset.public_use_approval_status !== "approved_synthetic") throw new PublicationImportError("ASSET_SANITIZATION_REJECTED", "Asset sanitization or approval attestation is invalid");
  assertSafeText(asset.alt_text, "asset.alt_text");
}

async function collectFiles(root, relative = "") {
  const directory = path.join(root, relative);
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = path.posix.join(relative.split(path.sep).join(path.posix.sep), entry.name);
    if (entry.isSymbolicLink()) throw new PublicationImportError("PACKAGE_SYMLINK_REJECTED", "Package may not contain symlinks");
    if (entry.isDirectory()) output.push(...(await collectFiles(root, child)));
    else if (entry.isFile()) output.push(child);
    else throw new PublicationImportError("PACKAGE_ENTRY_REJECTED", "Package may contain regular files only");
  }
  return output.sort();
}

async function readRequiredJson(filePath, missingCode) {
  if (!existsSync(filePath)) throw new PublicationImportError(missingCode, "Required package JSON file is missing");
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    throw new PublicationImportError("INVALID_JSON", "Required package JSON is invalid");
  }
}

async function loadManifest(packageDirectory) {
  const manifest = await readRequiredJson(path.join(packageDirectory, "manifest.json"), "MISSING_MANIFEST");
  assertManifest(manifest);
  return manifest;
}

export async function verifyPublicationPackage(packageDirectory, repositoryRoot) {
  const packageStat = await lstat(packageDirectory).catch(() => null);
  if (!packageStat?.isDirectory() || packageStat.isSymbolicLink()) throw new PublicationImportError("PACKAGE_PATH_INVALID", "Package path must be a real directory");
  const packageRoot = await realpath(packageDirectory);
  const manifest = await loadManifest(packageRoot);
  const candidate = await readRequiredJson(path.join(packageRoot, "candidate.json"), "MISSING_CANDIDATE");
  assertCandidate(candidate);
  if (manifest.candidate_id !== candidate.candidate_id || manifest.candidate_hash !== candidate.candidate_hash) throw new PublicationImportError("CANDIDATE_MANIFEST_MISMATCH", "Manifest and candidate identity differ");
  for (const file of manifest.files) {
    if (!existsSync(path.join(packageRoot, file.path))) throw new PublicationImportError(file.path.startsWith("assets/") ? "MISSING_ASSET" : "MISSING_CANDIDATE", "Manifest file is missing");
  }
  const expected = ["manifest.json", ...manifest.files.map((file) => file.path)].sort();
  const actual = await collectFiles(packageRoot);
  if (actual.length !== expected.length || actual.some((file, index) => file !== expected[index])) throw new PublicationImportError("PACKAGE_LAYOUT_INVALID", "Package has a missing or unlisted file");
  for (const file of manifest.files) {
    const absolutePath = path.resolve(packageRoot, file.path);
    if (!absolutePath.startsWith(`${packageRoot}${path.sep}`)) throw new PublicationImportError("PACKAGE_PATH_INVALID", "Manifest path escapes the package");
    if (!existsSync(absolutePath)) throw new PublicationImportError(file.path.startsWith("assets/") ? "MISSING_ASSET" : "MISSING_CANDIDATE", "Manifest file is missing");
    const stat = await lstat(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new PublicationImportError("PACKAGE_ENTRY_REJECTED", "Manifest entries must be regular files");
    const bytes = await readFile(absolutePath);
    if (bytes.byteLength !== file.byte_length) throw new PublicationImportError("FILE_LENGTH_MISMATCH", "Manifest byte length mismatch");
    if (sha256(bytes) !== file.sha256) throw new PublicationImportError("FILE_HASH_MISMATCH", "Manifest file hash mismatch");
  }
  const manifestAssetPaths = new Set(manifest.files.filter((file) => file.path.startsWith("assets/")).map((file) => file.path));
  const candidateAssetPaths = new Set(candidate.assets.map((asset) => asset.relative_package_path));
  if (manifestAssetPaths.size !== candidateAssetPaths.size || [...manifestAssetPaths].some((assetPath) => !candidateAssetPaths.has(assetPath))) throw new PublicationImportError("ASSET_MANIFEST_MISMATCH", "Candidate and manifest asset sets differ");
  for (const asset of candidate.assets) {
    if (!/^asset_[a-z0-9_-]{4,64}$/.test(asset.asset_id) || !/^assets\/[a-z0-9][a-z0-9._-]*$/.test(asset.relative_package_path) || !SHA256.test(asset.sha256)) throw new PublicationImportError("CANDIDATE_SCHEMA_INVALID", "Asset identity or path is invalid");
    const entry = manifest.files.find((file) => file.path === asset.relative_package_path);
    if (!entry || entry.sha256 !== asset.sha256 || entry.mime !== asset.mime) throw new PublicationImportError("ASSET_MANIFEST_MISMATCH", "Asset candidate metadata differs from manifest");
    const bytes = await readFile(path.join(packageRoot, asset.relative_package_path));
    inspectSvg(bytes, asset);
  }
  assertTaxonomy(candidate, repositoryRoot);
  return { packageRoot, manifest, candidate };
}

function assertImportReceipt(receipt, manifest, candidate) {
  assertExactKeys(receipt, RECEIPT_FIELDS, "IMPORT_RECEIPT_INVALID", "import receipt");
  assertIsoTimestamp(receipt.imported_at, "IMPORT_RECEIPT_INVALID", "imported_at");
  const expectedDraftPath = `drafts/casepilot/${candidate.candidate_id}/draft.html`;
  const expectedReportPath = `drafts/casepilot/${candidate.candidate_id}/validation-report.json`;
  if (
    receipt.contract_version !== CONTRACT_VERSION ||
    receipt.receipt_version !== "import-receipt/v1" ||
    receipt.candidate_id !== candidate.candidate_id ||
    receipt.candidate_hash !== candidate.candidate_hash ||
    receipt.package_hash !== manifest.package_hash ||
    receipt.source_system !== SOURCE_SYSTEM ||
    receipt.target_system !== TARGET_SYSTEM ||
    receipt.content_type !== "public_case" ||
    receipt.synthetic !== true ||
    receipt.result !== "created" ||
    receipt.draft_path !== expectedDraftPath ||
    receipt.validation_report_path !== expectedReportPath ||
    receipt.proposed_slug !== candidate.proposed_public_copy.proposed_slug ||
    receipt.final_slug !== null ||
    receipt.canonical_url !== null ||
    receipt.sitemap_modified !== false ||
    receipt.public_root_modified !== false ||
    receipt.network_used !== false
  ) {
    throw new PublicationImportError("IMPORT_RECEIPT_INVALID", "Existing import receipt violates contract or package bindings");
  }
}

async function assertSlugAvailable(slug, repositoryRoot, draftRoot, candidateId, allowExistingSlug = false) {
  if (!CLEAN_SLUG.test(slug)) throw new PublicationImportError("SLUG_INVALID", "Proposed slug is invalid");
  if (!allowExistingSlug && existsSync(path.join(repositoryRoot, `${slug}.html`))) throw new PublicationImportError("SLUG_COLLISION", "Proposed slug collides with a public HTML page");
  const sitemap = await readFile(path.join(repositoryRoot, "sitemap.xml"), "utf8");
  if (!allowExistingSlug && sitemap.includes(`https://www.carkey.com.tw/${slug}<`)) throw new PublicationImportError("SLUG_COLLISION", "Proposed slug collides with sitemap");
  const redirects = JSON.parse(await readFile(path.join(repositoryRoot, "vercel.json"), "utf8")).redirects ?? [];
  if (!allowExistingSlug && redirects.some((redirect) => [redirect.source, redirect.destination].includes(`/${slug}`) || [redirect.source, redirect.destination].includes(`/${slug}.html`))) throw new PublicationImportError("SLUG_COLLISION", "Proposed slug collides with redirect policy");
  if (!existsSync(draftRoot)) return;
  for (const entry of await readdir(draftRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === candidateId || !CANDIDATE_ID.test(entry.name)) continue;
    const publicJson = path.join(draftRoot, entry.name, "candidate-public.json");
    if (!existsSync(publicJson)) continue;
    const draft = JSON.parse(await readFile(publicJson, "utf8"));
    if (draft.proposed_slug === slug) throw new PublicationImportError("SLUG_COLLISION", "Proposed slug collides with another draft");
  }
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function buildPublicModel(candidate, manifest) {
  const taxonomy = candidate.taxonomy;
  const copy = candidate.proposed_public_copy;
  const scenario = SERVICE_SCENARIOS[taxonomy.service_scenario];
  return {
    draft_model_version: "carkey-public-case-draft/v1",
    content_type: "public_case",
    locale: "zh-TW",
    public_brand: "極致核心 ProCore",
    publisher: "極致核心 ProCore Auto Key",
    candidate_id: candidate.candidate_id,
    candidate_revision: candidate.candidate_revision,
    candidate_hash: candidate.candidate_hash,
    package_hash: manifest.package_hash,
    proposed_slug: copy.proposed_slug,
    final_slug: null,
    canonical_url: null,
    title: copy.proposed_title,
    description: copy.proposed_description,
    generalized_location: taxonomy.generalized_city_county,
    generalized_scene: taxonomy.generalized_scene,
    vehicle: { year: taxonomy.model_year, brand: taxonomy.vehicle_brand, model: taxonomy.vehicle_model },
    key_scenario: { code: taxonomy.service_scenario, label: scenario.label, key_situation: taxonomy.key_situation, remaining_key_state: taxonomy.remaining_key_state },
    sanitized_summary: copy.sanitized_summary,
    sanitized_narrative: copy.sanitized_narrative,
    public_safe_facts: [...copy.public_safe_facts],
    safety_note: copy.safety_note,
    cta: { intent: copy.cta_intent, route: "/rescue-request", label: "提供車款與鑰匙狀況，進行條件評估" },
    related_service_route: taxonomy.related_existing_service_route,
    internal_links: [...taxonomy.suggested_existing_internal_links],
    asset_plan: candidate.assets.map((asset) => ({ source: asset.relative_package_path, draft_path: `assets/${path.posix.basename(asset.relative_package_path)}`, mime: asset.mime, width: asset.width, height: asset.height, sha256: asset.sha256, alt: asset.alt_text })),
    schema_draft_inputs: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: copy.proposed_title,
      description: copy.proposed_description,
      inLanguage: "zh-TW",
      publisher: { "@type": "Organization", name: "極致核心 ProCore Auto Key" },
      author: { "@type": "Organization", name: "極致核心 ProCore Auto Key" }
    },
    breadcrumb_draft_inputs: [
      { position: 1, name: "首頁", route: "/" },
      { position: 2, name: "到場處理紀錄", route: "/cases" },
      { position: 3, name: copy.proposed_title, route: null }
    ],
    sitemap_intent: "exclude_until_owner_promotion",
    redirect_intent: "none",
    publication_date: null
  };
}

function renderDraftHtml(model) {
  const facts = model.public_safe_facts.map((fact) => `          <li>${escapeHtml(fact)}</li>`).join("\n");
  const links = model.internal_links.map((route) => `          <a href="${escapeHtml(route)}">${escapeHtml(route === "/cases" ? "更多案例" : "相關服務")}</a>`).join("\n");
  const asset = model.asset_plan[0];
  const schema = canonicalJson(model.schema_draft_inputs).replaceAll("<", "\\u003c");
  const breadcrumb = canonicalJson({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: model.breadcrumb_draft_inputs.map((entry) => ({ "@type": "ListItem", position: entry.position, name: entry.name, ...(entry.route ? { item: entry.route } : {}) }))
  }).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta name="description" content="${escapeHtml(model.description)}">
  <meta name="procore-publication-state" content="deploy-excluded-owner-review-draft">
  <title>${escapeHtml(model.title)}</title>
  <style>
    :root { color-scheme: dark; --gold: #d4af37; --panel: #171717; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #050505; color: #e5e5e5; font-family: system-ui, sans-serif; line-height: 1.8; }
    main { width: min(960px, calc(100% - 32px)); margin: 0 auto; padding: 40px 0 72px; }
    .draft { border: 1px solid var(--gold); color: var(--gold); padding: 8px 12px; display: inline-block; border-radius: 999px; }
    .panel { margin-top: 24px; padding: clamp(20px, 5vw, 44px); background: var(--panel); border: 1px solid #333; border-radius: 22px; }
    img { width: 100%; height: auto; border-radius: 16px; }
    a { color: #f5d66f; margin-right: 18px; }
    .cta { display: inline-block; padding: 12px 18px; background: var(--gold); color: #090909; text-decoration: none; border-radius: 999px; font-weight: 700; }
  </style>
  <script type="application/ld+json" data-seo="draft-article">${schema}</script>
  <script type="application/ld+json" data-seo="draft-breadcrumb">${breadcrumb}</script>
</head>
<body>
  <main>
    <span class="draft">合成測試｜Owner review draft｜不會部署</span>
    <header class="panel">
      <p>極致核心 ProCore Auto Key</p>
      <h1>${escapeHtml(model.title)}</h1>
      <p>${escapeHtml(model.sanitized_summary)}</p>
      <img src="${escapeHtml(asset.draft_path)}" width="${asset.width}" height="${asset.height}" alt="${escapeHtml(asset.alt)}">
    </header>
    <article class="panel">
      <h2>案例概況</h2>
      <p>${escapeHtml(model.sanitized_narrative)}</p>
      <h2>公開安全資訊</h2>
      <ul>
${facts}
      </ul>
      <h2>安全提醒</h2>
      <p>${escapeHtml(model.safety_note)}</p>
      <p><a class="cta" href="${model.cta.route}">${escapeHtml(model.cta.label)}</a></p>
      <nav aria-label="相關連結">
${links}
      </nav>
    </article>
  </main>
</body>
</html>
`;
}

export function validateDraftHtml(html, model) {
  if (!/<meta\s+name="robots"\s+content="noindex, nofollow, noarchive">/i.test(html)) throw new PublicationImportError("DRAFT_NOINDEX_MISSING", "Draft must be noindex, nofollow, noarchive");
  if (/<link\s+rel=["']canonical["']/i.test(html) || /https:\/\/www\.carkey\.com\.tw\/article-/i.test(html)) throw new PublicationImportError("DRAFT_CANONICAL_FORBIDDEN", "Draft must not claim a canonical or production case URL");
  if (/casepilot/i.test(html)) throw new PublicationImportError("PUBLIC_BRAND_BOUNDARY", "Draft page exposes the private product brand");
  if (!html.includes("極致核心 ProCore") || !html.includes(model.title) || !html.includes(model.cta.route)) throw new PublicationImportError("CARKEY_COMPATIBILITY_REJECTED", "Draft is missing required CarKey brand, title, or CTA");
  const networkCapability = new RegExp("<script[^>]+src=|\\bfe" + "tch\\s*\\(|XMLHttpRequest|WebSocket", "i");
  if (networkCapability.test(html)) throw new PublicationImportError("NETWORK_BOUNDARY_REJECTED", "Draft may not execute network-capable script");
  for (const [code, pattern] of PUBLIC_CONTENT_PATTERNS.slice(0, -1)) {
    if (pattern.test(html)) throw new PublicationImportError(code, "Draft violates the public-content boundary");
  }
}

async function writeCanonical(filePath, value) {
  await writeFile(filePath, `${canonicalJson(value)}\n`, { flag: "wx" });
}

function validationReport(candidate, manifest, model, artifactHashes) {
  const pass = (id, evidence) => ({ id, status: "pass", evidence });
  return {
    validation_report_version: "carkey-publication-validation/v1",
    status: "pass",
    contract_version: CONTRACT_VERSION,
    candidate_id: candidate.candidate_id,
    candidate_hash: candidate.candidate_hash,
    package_hash: manifest.package_hash,
    validated_at: candidate.approval_audit.updated_at,
    synthetic: true,
    network_used: false,
    sampled_case_pages: SAMPLE_CASE_PAGES,
    checks: [
      pass("contract_and_hashes", "manifest, candidate, files, approval binding, and package hashes verified"),
      pass("privacy_boundary", "allowlisted fields and public-copy denial patterns passed"),
      pass("carkey_taxonomy", "service route, vehicle, generalized location, and scene accepted"),
      pass("internal_links", `${model.internal_links.length} existing clean routes verified`),
      pass("slug_collision", "root HTML, sitemap, redirects, and other drafts checked"),
      pass("asset_safety", `${model.asset_plan.length} asset passed byte hash, MIME, exact dimensions, metadata, alt, and approval checks`),
      pass("brand_and_conditional_copy", "ProCore brand and conditional language verified"),
      pass("structured_data_draft", "Article and breadcrumb draft inputs have no canonical/publication date"),
      pass("deploy_exclusion", "drafts/ is gitignored, Vercel-excluded, and noindex"),
      pass("publication_authority", "final slug, canonical, schema, sitemap, redirects, publication date, and production remain unset")
    ],
    artifact_hashes: artifactHashes
  };
}

async function assertDeploymentExclusion(repositoryRoot) {
  const vercelIgnore = await readFile(path.join(repositoryRoot, ".vercelignore"), "utf8");
  const gitIgnore = await readFile(path.join(repositoryRoot, ".gitignore"), "utf8");
  if (!/^drafts\/$/m.test(vercelIgnore) && !/^\/drafts\/$/m.test(vercelIgnore)) throw new PublicationImportError("DEPLOY_EXCLUSION_MISSING", "Vercel ignore must exclude drafts/");
  if (!/^drafts\/$/m.test(gitIgnore) && !/^\/drafts\/$/m.test(gitIgnore)) throw new PublicationImportError("DEPLOY_EXCLUSION_MISSING", "Git ignore must exclude drafts/");
  const vercel = JSON.parse(await readFile(path.join(repositoryRoot, "vercel.json"), "utf8"));
  const draftHeader = (vercel.headers ?? []).find((entry) => entry.source === "/drafts/:path*");
  if (!draftHeader || !draftHeader.headers?.some((header) => header.key.toLowerCase() === "x-robots-tag" && /noindex/i.test(header.value))) throw new PublicationImportError("DEPLOY_EXCLUSION_MISSING", "Vercel draft noindex defense is missing");
}

export async function importPublicationPackage({ packageDirectory, repositoryRoot, draftRoot = path.join(repositoryRoot, "drafts/casepilot"), allowExistingSlug = false }) {
  await assertDeploymentExclusion(repositoryRoot);
  const preliminaryManifest = await loadManifest(packageDirectory);
  const candidateDirectory = path.join(draftRoot, preliminaryManifest.candidate_id);
  const receiptPath = path.join(candidateDirectory, "import-receipt.json");
  if (existsSync(receiptPath)) {
    const receipt = await readRequiredJson(receiptPath, "IMPORT_RECEIPT_MISSING");
    assertExactKeys(receipt, RECEIPT_FIELDS, "IMPORT_RECEIPT_INVALID", "import receipt");
    if (receipt.package_hash !== preliminaryManifest.package_hash) throw new PublicationImportError("CANDIDATE_PACKAGE_CONFLICT", "Existing candidate ID is bound to a different package hash");
    const verified = await verifyPublicationPackage(packageDirectory, repositoryRoot);
    assertImportReceipt(receipt, verified.manifest, verified.candidate);
    if (!existsSync(path.join(candidateDirectory, "draft.html")) || !existsSync(path.join(candidateDirectory, "candidate-public.json")) || !existsSync(path.join(candidateDirectory, "validation-report.json"))) throw new PublicationImportError("EXISTING_DRAFT_INVALID", "Existing draft files are incomplete");
    return { operation: "reused", receipt, candidateDirectory };
  }

  const { packageRoot, manifest, candidate } = await verifyPublicationPackage(packageDirectory, repositoryRoot);
  await assertSlugAvailable(candidate.proposed_public_copy.proposed_slug, repositoryRoot, draftRoot, candidate.candidate_id, allowExistingSlug);
  const model = buildPublicModel(candidate, manifest);
  const html = renderDraftHtml(model);
  validateDraftHtml(html, model);
  const sitemapBefore = sha256(await readFile(path.join(repositoryRoot, "sitemap.xml")));
  const stagingDirectory = path.join(draftRoot, `${candidate.candidate_id}.staging-${process.pid}`);
  if (existsSync(stagingDirectory)) await rm(stagingDirectory, { recursive: true, force: true });
  await mkdir(path.join(stagingDirectory, "assets"), { recursive: true });
  try {
    const publicModelPath = path.join(stagingDirectory, "candidate-public.json");
    const draftPath = path.join(stagingDirectory, "draft.html");
    await writeCanonical(publicModelPath, model);
    await writeFile(draftPath, html, { flag: "wx" });
    for (const asset of candidate.assets) {
      const target = path.join(stagingDirectory, "assets", path.posix.basename(asset.relative_package_path));
      await cp(path.join(packageRoot, asset.relative_package_path), target, { errorOnExist: true, force: false });
    }
    const artifactHashes = {
      "candidate-public.json": sha256(await readFile(publicModelPath)),
      "draft.html": sha256(await readFile(draftPath)),
      ...Object.fromEntries(await Promise.all(candidate.assets.map(async (asset) => {
        const rel = `assets/${path.posix.basename(asset.relative_package_path)}`;
        return [rel, sha256(await readFile(path.join(stagingDirectory, rel)))];
      })))
    };
    const report = validationReport(candidate, manifest, model, artifactHashes);
    await writeCanonical(path.join(stagingDirectory, "validation-report.json"), report);
    const receipt = {
      contract_version: CONTRACT_VERSION,
      receipt_version: "import-receipt/v1",
      candidate_id: candidate.candidate_id,
      candidate_hash: candidate.candidate_hash,
      package_hash: manifest.package_hash,
      source_system: SOURCE_SYSTEM,
      target_system: TARGET_SYSTEM,
      content_type: "public_case",
      synthetic: true,
      result: "created",
      draft_path: `drafts/casepilot/${candidate.candidate_id}/draft.html`,
      validation_report_path: `drafts/casepilot/${candidate.candidate_id}/validation-report.json`,
      proposed_slug: model.proposed_slug,
      final_slug: null,
      canonical_url: null,
      sitemap_modified: false,
      public_root_modified: false,
      network_used: false,
      imported_at: candidate.approval_audit.updated_at
    };
    await writeCanonical(path.join(stagingDirectory, "import-receipt.json"), receipt);
    if (sha256(await readFile(path.join(repositoryRoot, "sitemap.xml"))) !== sitemapBefore) throw new PublicationImportError("SITEMAP_MUTATION_DETECTED", "Importer changed sitemap.xml");
    await mkdir(draftRoot, { recursive: true });
    await rename(stagingDirectory, candidateDirectory);
    return { operation: "created", receipt, candidateDirectory };
  } catch (error) {
    if (existsSync(stagingDirectory)) await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}
