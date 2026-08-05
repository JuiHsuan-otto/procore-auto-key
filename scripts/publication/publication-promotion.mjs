import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const ACTION_CONTRACT_VERSION = "1.0.0";
export const ACTION_VERSION = "publication-action/v1";
export const ACTION_PACKAGE_FORMAT = "publication-action-package/v1";
export const PLAN_VERSION = "promotion-plan/v1";
export const ACTION_RECEIPT_VERSION = "publication-action-receipt/v1";

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const ACTION_ID = /^pca_[a-f0-9]{16}$/;
const CANDIDATE_ID = /^cpc_[a-f0-9]{16}$/;
const PUBLIC_RECORD_ID = /^pcr_[a-f0-9]{16}$/;
const CLEAN_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ACTION_FIELDS = [
  "contract_version", "action_version", "action_id", "action_hash", "action", "action_revision",
  "action_status", "candidate_id", "candidate_revision", "candidate_hash", "package_hash",
  "draft_sha256", "public_record_id", "previous_action_id", "expected_state",
  "expected_current_public_content_hash", "proposed_public_content_hash", "source_repository_sha",
  "expected_carkey_base_sha", "locale", "source_system", "target_system", "synthetic",
  "requested_publication", "authorization", "consent", "approval", "asset_reviews", "prior_publication"
];
const SOURCE_FIELDS = ACTION_FIELDS.filter((field) => !["contract_version", "action_version", "action_id", "action_hash", "action_status", "source_system", "target_system"].includes(field));
const REQUEST_FIELDS = ["proposed_slug", "publication_date", "reason_code", "requested_resolution", "replacement_url", "canonical_continuity_required", "preserve_publication_history", "sitemap_intent", "redirect_intent"];
const AUTHORIZATION_FIELDS = ["authorization_verified", "publication_consent_verified", "owner_approved", "reviewer_role", "approval_timestamp", "evidence_reference", "revoked"];
const CONSENT_FIELDS = ["consent_reference", "consent_record_sha256", "purpose", "status", "scope", "public_content_consent", "granted_at", "expires_at", "withdrawal_requested"];
const APPROVAL_FIELDS = ["approval_reference", "role", "approved", "reviewed_draft_sha256", "reviewed_action_sha256", "action_hash", "approved_at"];
const ASSET_REVIEW_FIELDS = ["path", "sha256", "status", "metadata_inspection"];
const PRIOR_FIELDS = ["receipt_hash", "action_id", "action_revision", "candidate_revision", "public_record_id", "state", "public_content_hash", "canonical_url", "published_commit", "deployment_id", "verified_at"];
const PACKAGE_MANIFEST_FIELDS = ["contract_version", "package_format", "action_id", "action_hash", "candidate_id", "candidate_hash", "candidate_package_hash", "created_at", "files", "package_hash", "synthetic", "network_required"];
const PACKAGE_FILE_FIELDS = ["path", "sha256", "byte_length", "mime"];
const FORBIDDEN_KEYS = new Set(["name", "customer_name", "customer_phone", "phone", "email", "line_id", "address", "exact_address", "plate", "license_plate", "vin", "latitude", "longitude", "gps", "raw_conversation", "raw_evidence", "security_procedure", "api_key", "access_token", "secret", "password", "cookie", "session_id", "subject", "owner_email"]);

export class PublicationPromotionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PublicationPromotionError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new PublicationPromotionError(code, message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function assertExactKeys(value, fields, code, label) {
  if (!isPlainObject(value)) fail(code, `${label} must be an object`);
  const expected = [...fields].sort();
  const actual = Object.keys(value).sort();
  if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) fail(code, `${label} fields do not match the contract`);
}

function assertPublicSafe(value, currentPath = "action", depth = 0) {
  if (depth > 20) fail("ACTION_PRIVATE_FIELD", "Action nesting exceeds the public boundary");
  if (Array.isArray(value)) return value.forEach((entry, index) => assertPublicSafe(entry, `${currentPath}[${index}]`, depth + 1));
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) fail("ACTION_PRIVATE_FIELD", `Forbidden key at ${currentPath}.${key}`);
    assertPublicSafe(child, `${currentPath}.${key}`, depth + 1);
  }
}

function canonicalize(value, seen) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("PROMOTION_SCHEMA_INVALID", "Canonical JSON forbids non-finite numbers");
    return value;
  }
  if (typeof value !== "object" || seen.has(value)) fail("PROMOTION_SCHEMA_INVALID", "Canonical JSON received a cycle or unsupported value");
  seen.add(value);
  let result;
  if (Array.isArray(value)) result = value.map((entry) => canonicalize(entry, seen));
  else if (isPlainObject(value)) result = Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key], seen)]));
  else fail("PROMOTION_SCHEMA_INVALID", "Canonical JSON accepts plain objects only");
  seen.delete(value);
  return result;
}

export function canonicalPromotionJson(value) {
  return JSON.stringify(canonicalize(value, new Set()));
}

export function promotionSha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function publicFacingText(value) {
  return String(value)
    .replace(/synthetic|fixture/gi, "")
    .replaceAll("純合成案例模擬", "本案例說明")
    .replaceAll("合成案例", "處理案例")
    .replaceAll("純合成", "案例")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function publicAssetBasename(value) {
  const basename = path.posix.basename(value).replace(/^(?:synthetic|fixture)-+/i, "");
  if (!basename || basename === "." || basename === "..") fail("PROMOTION_ASSET_PATH_INVALID", "Public asset name is invalid");
  return basename;
}

export function computePublicationActionHash(action) {
  const input = structuredClone(action);
  input.action_id = "";
  input.action_hash = "";
  input.approval.action_hash = "";
  return promotionSha256(canonicalPromotionJson(input));
}

function actionSourceView(action) {
  return Object.fromEntries(SOURCE_FIELDS.map((field) => {
    if (field === "approval") return [field, Object.fromEntries(Object.entries(action.approval).filter(([key]) => key !== "action_hash"))];
    return [field, structuredClone(action[field])];
  }));
}

export function computePublicationActionRequestHash(action) {
  const input = actionSourceView(action);
  input.approval.reviewed_action_sha256 = "";
  return promotionSha256(canonicalPromotionJson(input));
}

export function computeActionReceiptHash(receipt) {
  const input = { ...structuredClone(receipt), receipt_hash: "" };
  return promotionSha256(canonicalPromotionJson(input));
}

export function computePromotionPlanHash(plan) {
  const input = structuredClone(plan);
  input.plan_hash = "";
  input.receipt_template.plan_hash = "";
  input.receipt_template.receipt_hash = "";
  return promotionSha256(canonicalPromotionJson(input));
}

export function assertPlanningOutputBoundary(repositoryRoot, outputRoot) {
  const relative = path.relative(repositoryRoot, outputRoot);
  const insideRepository = relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
  if (insideRepository && (relative === "" || relative.split(path.sep)[0] !== "drafts")) fail("PROMOTION_OUTPUT_NOT_EXCLUDED", "Planning output inside CarKey must remain under deploy-excluded drafts/");
}

function assertIso(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail("ACTION_SCHEMA_INVALID", `${label} is not a canonical timestamp`);
}

function validateActionLifecycle(action) {
  const request = action.requested_publication;
  const prior = action.prior_publication;
  const consent = action.consent;
  if (action.action === "publish") {
    if (action.expected_state !== "unpublished" || action.action_revision !== 1 || prior !== null || action.previous_action_id !== null || action.expected_current_public_content_hash !== null || action.proposed_public_content_hash !== action.draft_sha256) fail("ACTION_LIFECYCLE_INVALID", "Publish must begin from unpublished");
    if (request.reason_code !== "initial_publication" || request.requested_resolution !== "publish" || request.proposed_slug === null || request.publication_date === null || request.replacement_url !== null || request.canonical_continuity_required !== false || request.preserve_publication_history !== true || request.sitemap_intent !== "ensure_present" || request.redirect_intent !== "none") fail("ACTION_LIFECYCLE_INVALID", "Publish intent is inconsistent");
    if (consent.status !== "active" || consent.public_content_consent !== true || consent.withdrawal_requested !== false) fail("ACTION_CONSENT_INVALID", "Publish requires active consent");
    return;
  }
  if (action.expected_state !== "published" || prior === null || prior.state !== "published" || action.previous_action_id !== prior.action_id || action.public_record_id !== prior.public_record_id || action.action_revision !== prior.action_revision + 1 || action.expected_current_public_content_hash !== prior.public_content_hash) fail("ACTION_STALE", "Action is not based on the current publication receipt");
  if (action.candidate_revision < prior.candidate_revision) fail("ACTION_STALE_CANDIDATE", "Candidate revision is stale");
  if (action.action === "correct") {
    if (action.candidate_revision <= prior.candidate_revision || action.proposed_public_content_hash !== action.draft_sha256) fail("ACTION_STALE_CANDIDATE", "Correction requires a newer candidate revision");
    if (!["factual_correction", "safety_correction", "image_metadata_correction"].includes(request.reason_code) || request.requested_resolution !== "correct_in_place" || request.proposed_slug === null || request.publication_date === null || request.replacement_url !== null || request.canonical_continuity_required !== true || request.preserve_publication_history !== true || request.sitemap_intent !== "ensure_present" || request.redirect_intent !== "none") fail("ACTION_LIFECYCLE_INVALID", "Correction intent is inconsistent");
    if (consent.status !== "active" || consent.public_content_consent !== true || consent.withdrawal_requested !== false) fail("ACTION_CONSENT_INVALID", "Correction requires active consent");
    const priorSlug = new URL(prior.canonical_url).pathname.replace(/^\//, "").replace(/\/$/, "");
    if (request.proposed_slug !== priorSlug) fail("ACTION_CANONICAL_CONTINUITY", "Correction cannot change canonical slug");
    return;
  }
  if (action.proposed_public_content_hash !== null || !["consent_withdrawal", "owner_withdrawal"].includes(request.reason_code) || !["noindex", "redirect"].includes(request.requested_resolution) || request.proposed_slug !== null || request.publication_date !== null || request.canonical_continuity_required !== true || request.preserve_publication_history !== true || request.sitemap_intent !== "remove") fail("ACTION_LIFECYCLE_INVALID", "Withdrawal intent is inconsistent");
  if (request.requested_resolution === "redirect" ? request.replacement_url === null || request.redirect_intent !== "replacement" : request.replacement_url !== null || request.redirect_intent !== "none") fail("ACTION_LIFECYCLE_INVALID", "Withdrawal redirect intent is inconsistent");
  if (request.reason_code === "consent_withdrawal" && (consent.status !== "withdrawn" || consent.public_content_consent !== false || consent.withdrawal_requested !== true)) fail("ACTION_CONSENT_INVALID", "Consent withdrawal is inconsistent");
}

export function validatePublicationAction(action) {
  assertExactKeys(action, ACTION_FIELDS, "ACTION_SCHEMA_INVALID", "action");
  assertExactKeys(action.requested_publication, REQUEST_FIELDS, "ACTION_SCHEMA_INVALID", "requested_publication");
  assertExactKeys(action.authorization, AUTHORIZATION_FIELDS, "ACTION_SCHEMA_INVALID", "authorization");
  assertExactKeys(action.consent, CONSENT_FIELDS, "ACTION_SCHEMA_INVALID", "consent");
  assertExactKeys(action.approval, APPROVAL_FIELDS, "ACTION_SCHEMA_INVALID", "approval");
  if (!Array.isArray(action.asset_reviews) || action.asset_reviews.length < 1 || action.asset_reviews.length > 20) fail("ACTION_SCHEMA_INVALID", "asset reviews are invalid");
  action.asset_reviews.forEach((asset, index) => assertExactKeys(asset, ASSET_REVIEW_FIELDS, "ACTION_SCHEMA_INVALID", `asset_reviews[${index}]`));
  if (action.prior_publication !== null) assertExactKeys(action.prior_publication, PRIOR_FIELDS, "ACTION_SCHEMA_INVALID", "prior_publication");
  assertPublicSafe(action);
  if (action.contract_version !== ACTION_CONTRACT_VERSION || action.action_version !== ACTION_VERSION || action.action_status !== "approved_for_handoff" || action.source_system !== "casepilot-automotive" || action.target_system !== "carkey.com.tw") fail("ACTION_VERSION_UNSUPPORTED", "Action version or authority is unsupported");
  if (!ACTION_ID.test(action.action_id) || !SHA256.test(action.action_hash) || !CANDIDATE_ID.test(action.candidate_id) || !PUBLIC_RECORD_ID.test(action.public_record_id) || !SHA256.test(action.candidate_hash) || !SHA256.test(action.package_hash) || !SHA256.test(action.draft_sha256) || !GIT_SHA.test(action.source_repository_sha) || !GIT_SHA.test(action.expected_carkey_base_sha) || action.synthetic !== true || action.locale !== "zh-TW") fail("ACTION_SCHEMA_INVALID", "Action identity or hash binding is invalid");
  if (!Number.isInteger(action.action_revision) || action.action_revision < 1 || !Number.isInteger(action.candidate_revision) || action.candidate_revision < 1 || !["publish", "correct", "withdraw"].includes(action.action)) fail("ACTION_SCHEMA_INVALID", "Action type or revision is invalid");
  if (action.previous_action_id !== null && !ACTION_ID.test(action.previous_action_id)) fail("ACTION_SCHEMA_INVALID", "Previous action ID is invalid");
  if (!["unpublished", "published", "withdrawn"].includes(action.expected_state)) fail("ACTION_SCHEMA_INVALID", "Expected state is invalid");
  for (const value of [action.expected_current_public_content_hash, action.proposed_public_content_hash]) if (value !== null && !SHA256.test(value)) fail("ACTION_SCHEMA_INVALID", "Public-content hash is invalid");
  const request = action.requested_publication;
  if (request.proposed_slug !== null && (!CLEAN_SLUG.test(request.proposed_slug) || request.proposed_slug.length > 120)) fail("ACTION_SCHEMA_INVALID", "Proposed slug is invalid");
  if (request.publication_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(request.publication_date)) fail("ACTION_SCHEMA_INVALID", "Publication date is invalid");
  if (request.replacement_url !== null && !request.replacement_url.startsWith("https://www.carkey.com.tw/")) fail("ACTION_SCHEMA_INVALID", "Replacement is outside canonical host");
  if (typeof request.canonical_continuity_required !== "boolean" || typeof request.preserve_publication_history !== "boolean" || !["ensure_present", "remove"].includes(request.sitemap_intent) || !["none", "replacement"].includes(request.redirect_intent)) fail("ACTION_SCHEMA_INVALID", "Lifecycle intent is invalid");
  const authorization = action.authorization;
  assertIso(authorization.approval_timestamp, "authorization.approval_timestamp");
  if (!/^evidence_[A-Za-z0-9_-]{8,80}$/.test(authorization.evidence_reference) || authorization.authorization_verified !== true || authorization.publication_consent_verified !== true || authorization.owner_approved !== true || authorization.reviewer_role !== "owner" || authorization.revoked !== false) fail("ACTION_AUTHORIZATION_INVALID", "Authorization is invalid or revoked");
  const consent = action.consent;
  if (!/^consent_[A-Za-z0-9_-]{8,80}$/.test(consent.consent_reference) || !SHA256.test(consent.consent_record_sha256) || consent.purpose !== "public_website_case" || consent.scope !== "carkey.com.tw" || !["active", "withdrawn"].includes(consent.status)) fail("ACTION_CONSENT_INVALID", "Consent binding is invalid");
  assertIso(consent.granted_at, "consent.granted_at");
  if (consent.expires_at !== null) assertIso(consent.expires_at, "consent.expires_at");
  const approval = action.approval;
  assertIso(approval.approved_at, "approval.approved_at");
  if (!/^approval_[A-Za-z0-9_-]{8,80}$/.test(approval.approval_reference) || approval.role !== "owner" || approval.approved !== true || approval.reviewed_draft_sha256 !== action.draft_sha256 || approval.reviewed_action_sha256 !== computePublicationActionRequestHash(action) || approval.action_hash !== action.action_hash || authorization.approval_timestamp !== approval.approved_at) fail("ACTION_APPROVAL_INVALID", "Owner approval binding is invalid");
  if (consent.expires_at !== null && Date.parse(consent.expires_at) <= Date.parse(approval.approved_at)) fail("ACTION_CONSENT_EXPIRED", "Consent expired before approval");
  const assets = new Set();
  for (const asset of action.asset_reviews) {
    if (!/^assets\/[A-Za-z0-9._/-]+$/.test(asset.path) || asset.path.includes("..") || !SHA256.test(asset.sha256) || asset.status !== "approved" || !["passed_no_exif_gps", "not_applicable_synthetic"].includes(asset.metadata_inspection) || assets.has(asset.path)) fail("ACTION_ASSET_REVIEW_INVALID", "Asset review is invalid");
    assets.add(asset.path);
  }
  if (action.asset_reviews.some((asset, index, list) => index > 0 && list[index - 1].path.localeCompare(asset.path) > 0)) fail("ACTION_ASSET_REVIEW_INVALID", "Asset reviews must be sorted");
  if (action.prior_publication !== null) {
    const prior = action.prior_publication;
    if (!SHA256.test(prior.receipt_hash) || !ACTION_ID.test(prior.action_id) || !Number.isInteger(prior.action_revision) || !Number.isInteger(prior.candidate_revision) || !PUBLIC_RECORD_ID.test(prior.public_record_id) || !["published", "withdrawn"].includes(prior.state) || !SHA256.test(prior.public_content_hash) || !GIT_SHA.test(prior.published_commit) || !prior.canonical_url.startsWith("https://www.carkey.com.tw/") || (prior.deployment_id !== null && !/^dpl_[A-Za-z0-9]+$/.test(prior.deployment_id))) fail("ACTION_PRIOR_PUBLICATION_INVALID", "Prior publication binding is invalid");
    assertIso(prior.verified_at, "prior_publication.verified_at");
    if (Date.parse(approval.approved_at) < Date.parse(prior.verified_at)) fail("ACTION_STALE", "Action approval predates current receipt");
  }
  validateActionLifecycle(action);
  const expected = computePublicationActionHash(action);
  if (expected !== action.action_hash || action.action_id !== `pca_${expected.slice(0, 16)}`) fail("ACTION_HASH_MISMATCH", "Action hash is invalid");
  return action;
}

async function readRegularBytes(filePath, code, maximumBytes = 2 * 1024 * 1024) {
  const info = await lstat(filePath).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink() || info.size > maximumBytes) fail(code, "Input must be a bounded regular file");
  return readFile(filePath);
}

async function readJson(filePath, code) {
  try {
    return JSON.parse((await readRegularBytes(filePath, code, 1024 * 1024)).toString("utf8"));
  } catch (error) {
    if (error instanceof PublicationPromotionError) throw error;
    fail(code, "Input JSON is invalid");
  }
}

async function collectFiles(root, relative = "") {
  const output = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const child = path.posix.join(relative.split(path.sep).join(path.posix.sep), entry.name);
    if (entry.isSymbolicLink()) fail("ACTION_PACKAGE_SYMLINK", "Action package cannot contain symlinks");
    if (entry.isDirectory()) output.push(...await collectFiles(root, child));
    else if (entry.isFile()) output.push(child);
    else fail("ACTION_PACKAGE_ENTRY", "Action package accepts regular files only");
  }
  return output.sort();
}

function computeActionPackageHash(manifest) {
  const input = structuredClone(manifest);
  input.package_hash = "";
  return promotionSha256(canonicalPromotionJson(input));
}

export async function verifyPublicationActionPackage(actionPackageDirectory) {
  const rootInfo = await lstat(actionPackageDirectory).catch(() => null);
  if (!rootInfo?.isDirectory() || rootInfo.isSymbolicLink()) fail("ACTION_PACKAGE_INVALID", "Action package must be a real directory");
  const manifest = await readJson(path.join(actionPackageDirectory, "manifest.json"), "ACTION_PACKAGE_INVALID");
  assertExactKeys(manifest, PACKAGE_MANIFEST_FIELDS, "ACTION_PACKAGE_INVALID", "action package manifest");
  if (manifest.contract_version !== ACTION_CONTRACT_VERSION || manifest.package_format !== ACTION_PACKAGE_FORMAT || manifest.synthetic !== true || manifest.network_required !== false || !SHA256.test(manifest.package_hash) || manifest.package_hash !== computeActionPackageHash(manifest)) fail("ACTION_PACKAGE_HASH_MISMATCH", "Action package manifest is invalid");
  if (!Array.isArray(manifest.files) || manifest.files.length < 3 || manifest.files.length > 30) fail("ACTION_PACKAGE_INVALID", "Action package file list is invalid");
  const expected = ["manifest.json", ...manifest.files.map((file) => file.path)].sort();
  const actual = await collectFiles(actionPackageDirectory);
  if (actual.length !== expected.length || actual.some((entry, index) => entry !== expected[index])) fail("ACTION_PACKAGE_LAYOUT_INVALID", "Action package layout differs from manifest");
  for (const file of manifest.files) {
    assertExactKeys(file, PACKAGE_FILE_FIELDS, "ACTION_PACKAGE_INVALID", "action package file");
    if (!/^(?:action\.json|candidate\/(?:manifest\.json|candidate\.json|assets\/[A-Za-z0-9._-]+))$/.test(file.path) || !SHA256.test(file.sha256) || !Number.isInteger(file.byte_length) || file.byte_length < 1) fail("ACTION_PACKAGE_INVALID", "Action package path or hash is invalid");
    const bytes = await readRegularBytes(path.join(actionPackageDirectory, file.path), "ACTION_PACKAGE_INVALID", 20 * 1024 * 1024);
    if (bytes.byteLength !== file.byte_length || promotionSha256(bytes) !== file.sha256) fail("ACTION_PACKAGE_HASH_MISMATCH", "Action package file hash differs");
  }
  const action = await readJson(path.join(actionPackageDirectory, "action.json"), "ACTION_PACKAGE_INVALID");
  validatePublicationAction(action);
  if (manifest.action_id !== action.action_id || manifest.action_hash !== action.action_hash || manifest.candidate_id !== action.candidate_id || manifest.candidate_hash !== action.candidate_hash || manifest.candidate_package_hash !== action.package_hash) fail("ACTION_PACKAGE_BINDING_MISMATCH", "Action and package manifest differ");
  return { action, manifest, candidatePackageDirectory: path.join(actionPackageDirectory, "candidate") };
}

async function assertDraftBinding(action, draftDirectory) {
  const [draftBytes, candidate, receipt, report] = await Promise.all([
    readRegularBytes(path.join(draftDirectory, "draft.html"), "PROMOTION_DRAFT_INVALID", 5 * 1024 * 1024),
    readJson(path.join(draftDirectory, "candidate-public.json"), "PROMOTION_DRAFT_INVALID"),
    readJson(path.join(draftDirectory, "import-receipt.json"), "PROMOTION_DRAFT_INVALID"),
    readJson(path.join(draftDirectory, "validation-report.json"), "PROMOTION_DRAFT_INVALID")
  ]);
  if (promotionSha256(draftBytes) !== action.draft_sha256 || action.approval.reviewed_draft_sha256 !== action.draft_sha256) fail("PROMOTION_DRAFT_HASH_MISMATCH", "Action approval differs from exact draft bytes");
  if (candidate.candidate_id !== action.candidate_id || candidate.candidate_revision !== action.candidate_revision || candidate.candidate_hash !== action.candidate_hash || candidate.package_hash !== action.package_hash || receipt.candidate_id !== action.candidate_id || receipt.candidate_hash !== action.candidate_hash || receipt.package_hash !== action.package_hash) fail("PROMOTION_CANDIDATE_BINDING_MISMATCH", "Action differs from imported candidate package");
  if (candidate.content_type !== "public_case" || candidate.public_brand !== "極致核心 ProCore" || candidate.publisher !== "極致核心 ProCore Auto Key" || candidate.canonical_url !== null || candidate.final_slug !== null || candidate.publication_date !== null || candidate.sitemap_intent !== "exclude_until_owner_promotion" || candidate.redirect_intent !== "none" || receipt.network_used !== false || receipt.sitemap_modified !== false || receipt.public_root_modified !== false || report.status !== "pass" || report.network_used !== false) fail("PROMOTION_DRAFT_INVALID", "Imported draft is not promotion-safe");
  const html = draftBytes.toString("utf8");
  if (!/noindex, nofollow, noarchive/i.test(html) || /<link[^>]+rel=["']canonical["']/i.test(html) || /CasePilot/i.test(html)) fail("PROMOTION_DRAFT_INVALID", "Draft HTML boundary is invalid");
  const expectedAssets = new Map(candidate.asset_plan.map((asset) => [asset.source, asset]));
  if (expectedAssets.size !== action.asset_reviews.length) fail("PROMOTION_ASSET_BINDING_MISMATCH", "Every candidate asset requires one exact review");
  for (const review of action.asset_reviews) {
    const asset = expectedAssets.get(review.path);
    if (!asset || asset.sha256 !== review.sha256) fail("PROMOTION_ASSET_BINDING_MISMATCH", "Asset review differs from candidate");
    const bytes = await readRegularBytes(path.join(draftDirectory, asset.draft_path), "PROMOTION_ASSET_BINDING_MISMATCH", 20 * 1024 * 1024);
    if (promotionSha256(bytes) !== review.sha256) fail("PROMOTION_ASSET_BINDING_MISMATCH", "Draft asset bytes differ from approval");
  }
  return { candidate, receipt };
}

function validatePriorReceipt(action, receipt) {
  if (action.action === "publish") {
    if (receipt !== null && receipt !== undefined) fail("PROMOTION_PRIOR_RECEIPT_UNEXPECTED", "Publish cannot include a prior receipt");
    return;
  }
  if (!isPlainObject(receipt) || !SHA256.test(receipt.receipt_hash) || computeActionReceiptHash(receipt) !== receipt.receipt_hash) fail("PROMOTION_PRIOR_RECEIPT_INVALID", "Prior receipt hash is invalid");
  const prior = action.prior_publication;
  if (receipt.action_id !== prior.action_id || receipt.action_revision !== prior.action_revision || receipt.candidate_revision !== prior.candidate_revision || receipt.public_record_id !== prior.public_record_id || receipt.resulting_public_content_hash !== prior.public_content_hash || receipt.canonical_url !== prior.canonical_url || receipt.resulting_commit !== prior.published_commit || receipt.deployment_id !== prior.deployment_id || receipt.verified_at !== prior.verified_at || receipt.receipt_hash !== prior.receipt_hash || !["applied_local", "corrected_local", "production_verified"].includes(receipt.state)) fail("PROMOTION_PRIOR_RECEIPT_INVALID", "Prior receipt does not match the action lifecycle binding");
}

async function inspectPublicTarget(repositoryRoot, slug, canonicalUrl, action) {
  const [sitemapBytes, vercelBytes] = await Promise.all([
    readRegularBytes(path.join(repositoryRoot, "sitemap.xml"), "PROMOTION_PUBLIC_STATE_INVALID"),
    readRegularBytes(path.join(repositoryRoot, "vercel.json"), "PROMOTION_PUBLIC_STATE_INVALID")
  ]);
  const sitemap = sitemapBytes.toString("utf8");
  const vercel = vercelBytes.toString("utf8");
  if (action.action === "publish") {
    if (existsSync(path.join(repositoryRoot, `${slug}.html`)) || sitemap.includes(canonicalUrl) || vercel.includes(`/${slug}`)) fail("PROMOTION_SLUG_COLLISION", "Proposed slug already exists");
    return { priorSlug: null, currentPublicContentHash: null };
  }
  const priorSlug = new URL(action.prior_publication.canonical_url).pathname.replace(/^\//, "").replace(/\/$/, "");
  if (!CLEAN_SLUG.test(priorSlug)) fail("PROMOTION_PUBLIC_STATE_INVALID", "Prior canonical is unsupported");
  const pagePath = path.join(repositoryRoot, `${priorSlug}.html`);
  const pageBytes = await readRegularBytes(pagePath, "PROMOTION_PUBLIC_STATE_INVALID", 5 * 1024 * 1024);
  const currentPublicContentHash = promotionSha256(pageBytes);
  if (currentPublicContentHash !== action.expected_current_public_content_hash) fail("PROMOTION_PUBLIC_HASH_STALE", "Current public page hash differs from the approved action");
  if (!sitemap.includes(action.prior_publication.canonical_url)) fail("PROMOTION_PUBLIC_STATE_INVALID", "Prior canonical is absent from sitemap");
  if (action.action === "correct" && (slug !== priorSlug || canonicalUrl !== action.prior_publication.canonical_url)) fail("PROMOTION_CANONICAL_CHANGE_REJECTED", "Correction must preserve canonical URL");
  if (action.action === "withdraw" && action.requested_publication.requested_resolution === "redirect") {
    const replacementSlug = new URL(action.requested_publication.replacement_url).pathname.replace(/^\//, "").replace(/\/$/, "");
    if (!CLEAN_SLUG.test(replacementSlug) || !existsSync(path.join(repositoryRoot, `${replacementSlug}.html`))) fail("PROMOTION_REPLACEMENT_TARGET_INVALID", "Withdrawal replacement target does not exist");
  }
  return { priorSlug, currentPublicContentHash };
}

function receiptTemplate(action, baseSha, branch, canonicalUrl) {
  return {
    contract_version: ACTION_CONTRACT_VERSION,
    receipt_version: ACTION_RECEIPT_VERSION,
    receipt_hash: "",
    previous_receipt_hash: action.prior_publication?.receipt_hash ?? null,
    action_id: action.action_id,
    action_hash: action.action_hash,
    action: action.action,
    action_revision: action.action_revision,
    plan_hash: "",
    state: "planned",
    public_record_id: action.public_record_id,
    candidate_id: action.candidate_id,
    candidate_revision: action.candidate_revision,
    candidate_hash: action.candidate_hash,
    package_hash: action.package_hash,
    carkey_base_sha: baseSha,
    worktree_path: null,
    resulting_changed_paths: [],
    resulting_public_content_hash: null,
    validation_results: [],
    result: "planned",
    rollback: { command: null, verified: false },
    branch,
    resulting_commit: null,
    pull_request_url: null,
    canonical_url: canonicalUrl,
    deployment_id: null,
    sitemap_modified: false,
    redirects_modified: false,
    public_page_modified: false,
    applied_at: null,
    verified_at: null,
    synthetic: action.synthetic,
    network_used: false
  };
}

export async function preparePromotionPlan({ action, draftDirectory, repositoryRoot, currentBaseSha, priorReceipt = null }) {
  validatePublicationAction(action);
  if (!GIT_SHA.test(currentBaseSha) || action.expected_carkey_base_sha !== currentBaseSha) fail("PROMOTION_BASE_DRIFT", "CarKey HEAD differs from approved baseline");
  validatePriorReceipt(action, priorReceipt);
  const { candidate } = await assertDraftBinding(action, draftDirectory);
  if (action.action !== "withdraw" && action.requested_publication.proposed_slug !== candidate.proposed_slug) fail("PROMOTION_SLUG_BINDING_MISMATCH", "Requested slug differs from candidate");
  const proposedSlug = action.action === "withdraw" ? null : action.requested_publication.proposed_slug;
  const canonicalUrl = action.action === "publish" ? `https://www.carkey.com.tw/${proposedSlug}` : action.prior_publication.canonical_url;
  const { priorSlug } = await inspectPublicTarget(repositoryRoot, proposedSlug, canonicalUrl, action);
  const finalSlug = action.action === "withdraw" ? priorSlug : proposedSlug;
  const pagePath = `${finalSlug}.html`;
  const branch = `content/casepilot-${action.action}-${action.action_id.slice(4)}`;
  const publicTitle = publicFacingText(candidate.title);
  const publicDescription = publicFacingText(candidate.description);
  const assetCopies = action.action === "withdraw" ? [] : candidate.asset_plan.map((asset) => ({ source: asset.source, draft_path: asset.draft_path, destination: `img/casepilot/${action.public_record_id}/${publicAssetBasename(asset.source)}`, sha256: asset.sha256, width: asset.width, height: asset.height, alt: publicFacingText(asset.alt) }));
  const governedRegistryFlag = "--preserve-schema-governed-html";
  const withdrawAsset = action.asset_reviews[0]?.path
    ? `/img/casepilot/${action.public_record_id}/${publicAssetBasename(action.asset_reviews[0].path)}`
    : null;
  const registryArguments = action.action === "withdraw"
    ? ["--withdraw", `/${pagePath}`, governedRegistryFlag, ...(withdrawAsset ? ["--case-img", withdrawAsset] : [])]
    : [publicTitle, `/${pagePath}`, "到場處理案例", publicDescription, "--date", action.requested_publication.publication_date.replaceAll("-", "."), "--lastmod", action.requested_publication.publication_date, "--case-region", candidate.generalized_location, "--case-car", `${candidate.vehicle.brand} ${candidate.vehicle.model}`, "--case-img", `/${assetCopies[0].destination}`, "--case-type", "汽車鑰匙案例", governedRegistryFlag];
  const registryPaths = ["blog.json", "cases.json", "sitemap.xml"];
  const historyPath = `data/publication-actions/${action.public_record_id}.json`;
  const assetPaths = action.action === "withdraw" ? action.asset_reviews.map((asset) => `img/casepilot/${action.public_record_id}/${publicAssetBasename(asset.path)}`) : assetCopies.map((asset) => asset.destination);
  const recoveryPaths = action.action === "withdraw" ? assetPaths.map((assetPath) => `data/publication-recovery/${action.public_record_id}/${path.posix.basename(assetPath)}`) : [];
  // The new page carries reviewed outbound internal links. Existing schema-governed
  // HTML remains byte-identical so the immutable rollout gate can keep enforcing
  // its historic migration boundary; the rescue-request utility page supplies a
  // reviewable related-case block, while blog.json is rendered by the homepage.
  const internalLinkTargets = ["rescue-request.html"];
  const operations = {
    files_to_add: action.action === "publish" ? [pagePath, ...assetPaths, historyPath].sort() : recoveryPaths.sort(),
    files_to_modify: action.action === "publish" ? [...new Set([...registryPaths, ...internalLinkTargets])].sort() : [...new Set([pagePath, ...registryPaths, historyPath, ...internalLinkTargets, ...(action.action === "correct" ? assetPaths : [])])].sort(),
    files_to_remove: action.action === "withdraw" ? assetPaths.sort() : [],
    internal_link_targets: internalLinkTargets,
    sitemap_operation: action.requested_publication.sitemap_intent,
    redirect_operation: action.requested_publication.redirect_intent,
    canonical_operation: action.action === "publish" ? "create" : "preserve",
    asset_operation: action.action === "publish" ? "copy" : action.action === "correct" ? "replace_approved" : "archive_then_remove_public"
  };
  const restoreTargets = [...new Set([...operations.files_to_modify, ...operations.files_to_remove])];
  const cleanTargets = operations.files_to_add;
  const rollbackBeforeMerge = `git restore --source ${currentBaseSha} -- ${restoreTargets.join(" ")}${cleanTargets.length ? ` && git clean -f -- ${cleanTargets.join(" ")}` : ""}`;
  const plan = {
    contract_version: ACTION_CONTRACT_VERSION,
    plan_version: PLAN_VERSION,
    state: "validated_branch_plan",
    plan_hash: "",
    action_id: action.action_id,
    action_hash: action.action_hash,
    action: action.action,
    action_revision: action.action_revision,
    public_record_id: action.public_record_id,
    candidate_id: action.candidate_id,
    candidate_revision: action.candidate_revision,
    candidate_hash: action.candidate_hash,
    package_hash: action.package_hash,
    expected_base_sha: action.expected_carkey_base_sha,
    current_base_sha: currentBaseSha,
    expected_current_state: action.expected_state,
    proposed_branch: branch,
    operations,
    lifecycle: {
      reason_code: action.requested_publication.reason_code,
      requested_resolution: action.requested_publication.requested_resolution,
      prior_action_id: action.previous_action_id,
      prior_receipt_hash: action.prior_publication?.receipt_hash ?? null,
      expected_current_public_content_hash: action.expected_current_public_content_hash,
      prior_canonical_url: action.prior_publication?.canonical_url ?? null,
      replacement_url: action.requested_publication.replacement_url,
      preserve_publication_history: true
    },
    public_page: {
      path: pagePath,
      canonical_url: canonicalUrl,
      title: action.action === "withdraw" ? "此案例已停止公開" : publicTitle,
      description: action.action === "withdraw" ? "此案例已依核准程序停止公開並自網站索引移除。" : publicDescription,
      publication_date: action.action === "withdraw" ? null : action.requested_publication.publication_date,
      content_type: "public_case"
    },
    asset_copies: assetCopies,
    registry_sync: { required: true, mode: action.action === "withdraw" ? "remove" : "upsert", tool: "publish_tool.py", arguments: registryArguments, mutated_paths: registryPaths },
    required_checks: ["publication_action_contract", "prior_receipt_and_state", "public_content_privacy", "asset_metadata_and_dimensions", "canonical_and_slug", "publish_tool_registry_sync", "static_site_and_schema", "sitemap_and_internal_links", "measurement", "deployment_boundary", "git_diff_scope", "production_zero_change"],
    risk_flags: action.action === "publish" ? ["new_public_route", "new_public_asset"] : action.action === "correct" ? ["existing_public_content_change", "canonical_must_not_change"] : ["search_visibility_removal", "public_asset_removal", "recovery_required"],
    human_review_checklist: ["Owner-approved action and consent remain valid", "Public copy contains no private or security-sensitive data", "Canonical and lifecycle behavior match the plan", "Changed paths and rollback instructions are acceptable", "PR stays Draft and is not deployed"],
    publication_authority: { apply_automated: false, pr_automated: false, merge_automated: false, deploy_automated: false, owner_review_required: true },
    rollback: { before_merge: rollbackBeforeMerge, after_merge: "Use a reviewed revert or corrective commit; never rewrite main.", production: "Use the governed prior healthy deployment only under separate Owner authority." },
    receipt_template: receiptTemplate(action, currentBaseSha, branch, canonicalUrl),
    synthetic: action.synthetic,
    network_used: false
  };
  plan.plan_hash = computePromotionPlanHash(plan);
  plan.receipt_template.plan_hash = plan.plan_hash;
  plan.receipt_template.receipt_hash = computeActionReceiptHash(plan.receipt_template);
  return plan;
}

export function validatePromotionPlan(plan) {
  if (!isPlainObject(plan) || plan.contract_version !== ACTION_CONTRACT_VERSION || plan.plan_version !== PLAN_VERSION || plan.state !== "validated_branch_plan" || !SHA256.test(plan.plan_hash) || computePromotionPlanHash(plan) !== plan.plan_hash || plan.receipt_template.plan_hash !== plan.plan_hash || computeActionReceiptHash(plan.receipt_template) !== plan.receipt_template.receipt_hash || plan.publication_authority.apply_automated !== false || plan.publication_authority.pr_automated !== false || plan.publication_authority.merge_automated !== false || plan.publication_authority.deploy_automated !== false || plan.network_used !== false) fail("PROMOTION_PLAN_INVALID", "Promotion plan hash or authority boundary is invalid");
  return plan;
}

export async function writePromotionPlan(plan, outputRoot) {
  validatePromotionPlan(plan);
  const planDirectory = path.join(outputRoot, "plans", plan.action_id);
  const planPath = path.join(planDirectory, "promotion-plan.json");
  const bytes = `${canonicalPromotionJson(plan)}\n`;
  await mkdir(planDirectory, { recursive: true });
  const directoryInfo = await lstat(planDirectory);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) fail("PROMOTION_OUTPUT_NOT_EXCLUDED", "Plan directory must be real");
  try {
    const existing = await readFile(planPath, "utf8");
    if (existing !== bytes) fail("PROMOTION_PLAN_CONFLICT", "Action ID is already bound to different plan bytes");
    return { operation: "reused", planPath };
  } catch (error) {
    if (error instanceof PublicationPromotionError) throw error;
    if (error?.code !== "ENOENT") throw error;
  }
  await writeFile(planPath, bytes, { flag: "wx" });
  return { operation: "created", planPath };
}
