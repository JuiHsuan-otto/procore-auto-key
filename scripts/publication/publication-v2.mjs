import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

export const HANDOFF_VERSION = "casepilot-publication-handoff/v2";
export const PREVIEW_RECEIPT_VERSION = "casepilot-publication-preview-receipt/v2";
export const PRODUCTION_RECEIPT_VERSION = "casepilot-publication-production-receipt/v2";
export const CARKEY_REPOSITORY = "JuiHsuan-otto/procore-auto-key";
export const CARKEY_ORIGIN = "https://www.carkey.com.tw";
export const PREVIEW_ENVIRONMENT = "Preview – procore-auto-key";
export const PRODUCTION_ENVIRONMENT = "Production – procore-auto-key";
export const MAX_PUBLICATION_ASSET_BYTES = 4_000_000;

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JOB_ID = /^pub_[a-f0-9]{12}$/;
const CANDIDATE_ID = /^cdt_[a-f0-9]{12}$/;
const CLEAN_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BRANCH = /^publication\/case-[a-f0-9]{12}-job-[a-f0-9]{12}$/;
const SAFE_REPO_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;
const FORBIDDEN_KEYS = new Set([
  "customername", "customerphone", "email", "phone", "lineid", "address",
  "exactaddress", "plate", "licenseplate", "vin", "latitude", "longitude",
  "gps", "rawconversation", "rawevidence", "apikey", "accesstoken", "token",
  "secret", "password", "cookie", "sessionid", "owneremail", "ownersubject",
  "amount", "price", "frequency", "chip"
]);
const FORBIDDEN_PUBLIC_TEXT = [
  /[A-HJ-NPR-Z0-9]{17}/i,
  /(?:車牌|牌照)\s*[:：]?\s*[A-Z0-9-]{4,}/i,
  /(?:姓名|電話|手機|地址)\s*[:：]/i,
  /(?:NT\$|TWD|新臺幣|新台幣|費用|金額|價格)\s*[:：]?\s*[$＄]?\s*\d[\d,]*/i,
  /\b\d{2,4}(?:\.\d+)?\s*(?:MHz|kHz)\b/i,
  /(?:api[_ -]?key|access[_ -]?token|password|cookie|session[_ -]?id)/i,
  /(?:casepilot|synthetic|fixture|合成案例|測試案件)/i
];

export class PublicationV2Error extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.name = "PublicationV2Error";
    this.code = code;
    this.retryable = retryable;
  }
}

function fail(code, message, retryable = false) {
  throw new PublicationV2Error(code, message, retryable);
}

function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, expected, code, label) {
  if (!plain(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail(code, `${label} fields do not match the v2 contract`);
  }
}

function canonicalize(value, seen = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("PUBLICATION_CANONICAL_JSON_INVALID", "Non-finite number in canonical JSON");
    return value;
  }
  if (typeof value !== "object" || seen.has(value)) fail("PUBLICATION_CANONICAL_JSON_INVALID", "Unsupported canonical JSON value");
  seen.add(value);
  const output = Array.isArray(value)
    ? value.map((entry) => canonicalize(entry, seen))
    : Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key], seen)]));
  seen.delete(value);
  return output;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function blankFieldHash(value, field) {
  const copy = structuredClone(value);
  copy[field] = "";
  return sha256(canonicalJson(copy));
}

export function changedPathsHash(paths) {
  if (!Array.isArray(paths) || paths.length === 0 || new Set(paths).size !== paths.length || paths.some((entry) => typeof entry !== "string" || !SAFE_REPO_PATH.test(entry))) {
    fail("PUBLICATION_CHANGED_PATHS_INVALID", "Changed paths are invalid");
  }
  return sha256(canonicalJson([...paths].sort()));
}

function timestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    fail("PUBLICATION_TIMESTAMP_INVALID", `${label} is not a canonical timestamp`);
  }
}

function safePublicValue(value, location = "publicProjection", depth = 0) {
  if (depth > 24) fail("PUBLICATION_PRIVATE_DATA_REJECTED", "Public projection nesting is excessive");
  if (typeof value === "string") {
    if (FORBIDDEN_PUBLIC_TEXT.some((pattern) => pattern.test(value))) fail("PUBLICATION_PRIVATE_DATA_REJECTED", `Unsafe public text at ${location}`);
    return;
  }
  if (Array.isArray(value)) return value.forEach((entry, index) => safePublicValue(entry, `${location}[${index}]`, depth + 1));
  if (!plain(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.replaceAll("_", "").toLowerCase())) fail("PUBLICATION_PRIVATE_DATA_REJECTED", `Forbidden field at ${location}.${key}`);
    safePublicValue(child, `${location}.${key}`, depth + 1);
  }
}

function boundedString(value, label, minimum, maximum) {
  if (typeof value !== "string" || value !== value.trim() || value.length < minimum || value.length > maximum) fail("PUBLICATION_PUBLIC_COPY_INVALID", `${label} is invalid`);
  safePublicValue(value, label);
}

function localRoute(value) {
  return typeof value === "string" && /^\/[A-Za-z0-9._/-]*$/.test(value) && !value.includes("..") && !value.includes("//");
}

function isVercelDeploymentUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && url.pathname === "/" && !url.search && !url.hash && url.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function validateWebsite(website) {
  exactKeys(website, ["seoTitle", "metaDescription", "proposedSlug", "canonicalUrl", "heroMediaIds", "datePublished", "sanitizedNarrative", "publicSafeFacts", "faq", "imageAlt", "suggestedInternalLinks", "breadcrumb", "schemaHeadline", "compatibilityNotes"], "PUBLICATION_WEBSITE_INVALID", "website");
  if (!CLEAN_SLUG.test(website.proposedSlug) || website.proposedSlug.length > 120) fail("PUBLICATION_WEBSITE_INVALID", "Slug is invalid");
  if (website.canonicalUrl !== `${CARKEY_ORIGIN}/${website.proposedSlug}`) fail("PUBLICATION_WEBSITE_INVALID", "Canonical URL does not match the approved CarKey route");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(website.datePublished)) fail("PUBLICATION_WEBSITE_INVALID", "Publication date is required");
  boundedString(website.seoTitle, "website.seoTitle", 5, 70);
  const finalTitle = website.seoTitle.includes("極致核心 ProCore") ? website.seoTitle : `${website.seoTitle} | 極致核心 ProCore`;
  if (finalTitle.length > 70) fail("PUBLICATION_PUBLIC_COPY_INVALID", "Final branded SEO title exceeds 70 characters");
  boundedString(website.metaDescription, "website.metaDescription", 30, 160);
  boundedString(website.sanitizedNarrative, "website.sanitizedNarrative", 40, 1200);
  boundedString(website.imageAlt, "website.imageAlt", 5, 160);
  boundedString(website.schemaHeadline, "website.schemaHeadline", 15, 110);
  if (!Array.isArray(website.heroMediaIds) || website.heroMediaIds.length < 1 || website.heroMediaIds.length > 8 || new Set(website.heroMediaIds).size !== website.heroMediaIds.length) fail("PUBLICATION_WEBSITE_INVALID", "Hero media selection is invalid");
  if (!Array.isArray(website.publicSafeFacts) || website.publicSafeFacts.length < 1 || website.publicSafeFacts.length > 8) fail("PUBLICATION_WEBSITE_INVALID", "Public-safe facts are invalid");
  website.publicSafeFacts.forEach((entry, index) => boundedString(entry, `website.publicSafeFacts[${index}]`, 4, 160));
  if (!Array.isArray(website.faq) || website.faq.length < 1 || website.faq.length > 5) fail("PUBLICATION_WEBSITE_INVALID", "FAQ is invalid");
  website.faq.forEach((entry, index) => {
    exactKeys(entry, ["question", "answer"], "PUBLICATION_WEBSITE_INVALID", `website.faq[${index}]`);
    boundedString(entry.question, `website.faq[${index}].question`, 4, 120);
    boundedString(entry.answer, `website.faq[${index}].answer`, 8, 400);
  });
  if (!Array.isArray(website.suggestedInternalLinks) || website.suggestedInternalLinks.length < 1 || website.suggestedInternalLinks.length > 6) fail("PUBLICATION_WEBSITE_INVALID", "Internal links are invalid");
  website.suggestedInternalLinks.forEach((entry, index) => {
    exactKeys(entry, ["route", "anchor"], "PUBLICATION_WEBSITE_INVALID", `website.suggestedInternalLinks[${index}]`);
    if (!localRoute(entry.route)) fail("PUBLICATION_WEBSITE_INVALID", "Internal link route is invalid");
    boundedString(entry.anchor, `website.suggestedInternalLinks[${index}].anchor`, 2, 60);
  });
  if (!Array.isArray(website.breadcrumb) || website.breadcrumb.length < 2 || website.breadcrumb.length > 4) fail("PUBLICATION_WEBSITE_INVALID", "Breadcrumb is invalid");
  website.breadcrumb.forEach((entry, index) => {
    exactKeys(entry, ["name", "item"], "PUBLICATION_WEBSITE_INVALID", `website.breadcrumb[${index}]`);
    boundedString(entry.name, `website.breadcrumb[${index}].name`, 1, 80);
    if (!(localRoute(entry.item) || entry.item.startsWith(`${CARKEY_ORIGIN}/`) || entry.item === `${CARKEY_ORIGIN}/`)) fail("PUBLICATION_WEBSITE_INVALID", "Breadcrumb item is invalid");
  });
  if (!Array.isArray(website.compatibilityNotes) || website.compatibilityNotes.length > 10) fail("PUBLICATION_WEBSITE_INVALID", "Compatibility notes are invalid");
  website.compatibilityNotes.forEach((entry, index) => boundedString(entry, `website.compatibilityNotes[${index}]`, 4, 200));
  safePublicValue(website);
}

function validateTaxonomy(taxonomy) {
  exactKeys(taxonomy, ["vehicle", "serviceLabel", "region", "relatedRoutes"], "PUBLICATION_TAXONOMY_INVALID", "taxonomy");
  exactKeys(taxonomy.vehicle, ["year", "brand", "model"], "PUBLICATION_TAXONOMY_INVALID", "taxonomy.vehicle");
  if (!Number.isInteger(taxonomy.vehicle.year) || taxonomy.vehicle.year < 1980 || taxonomy.vehicle.year > 2100) fail("PUBLICATION_TAXONOMY_INVALID", "Vehicle year is invalid");
  boundedString(taxonomy.vehicle.brand, "taxonomy.vehicle.brand", 1, 40);
  boundedString(taxonomy.vehicle.model, "taxonomy.vehicle.model", 1, 60);
  boundedString(taxonomy.serviceLabel, "taxonomy.serviceLabel", 2, 40);
  boundedString(taxonomy.region, "taxonomy.region", 2, 20);
  if (!Array.isArray(taxonomy.relatedRoutes) || taxonomy.relatedRoutes.length < 1 || taxonomy.relatedRoutes.length > 6 || new Set(taxonomy.relatedRoutes).size !== taxonomy.relatedRoutes.length || taxonomy.relatedRoutes.some((route) => !localRoute(route))) fail("PUBLICATION_TAXONOMY_INVALID", "Related routes are invalid");
  safePublicValue(taxonomy);
}

function validateAsset(asset, handoff) {
  exactKeys(asset, ["mediaId", "sha256", "mime", "byteLength", "width", "height", "altText", "downloadPath"], "PUBLICATION_ASSET_INVALID", "asset");
  const params = new URL(asset.downloadPath, "https://casepilot.invalid");
  const expectedPath = `/api/publication/worker/media/${encodeURIComponent(asset.mediaId)}`;
  if (!/^med_[a-f0-9]{12}$/.test(asset.mediaId) || !SHA256.test(asset.sha256) || !["image/jpeg", "image/png", "image/webp"].includes(asset.mime) || !Number.isInteger(asset.byteLength) || asset.byteLength < 32 || asset.byteLength > MAX_PUBLICATION_ASSET_BYTES || !(asset.width === null || Number.isInteger(asset.width)) || !(asset.height === null || Number.isInteger(asset.height)) || !asset.downloadPath.startsWith("/") || params.pathname !== expectedPath || params.searchParams.get("jobId") !== handoff.jobId || params.searchParams.get("claimId") !== handoff.claimId || params.searchParams.get("phase") !== handoff.phase) {
    fail("PUBLICATION_ASSET_INVALID", "Asset binding or download path is invalid");
  }
  boundedString(asset.altText, "asset.altText", 5, 160);
}

function validateProductionAuthorization(value, handoff, now) {
  exactKeys(value, ["authorizationHash", "idempotencyKey", "authorizedAt", "expiresAt", "candidateHash", "bindingHash", "previewReceiptHash", "prNumber", "headSha", "baseSha", "previewGithubDeploymentId", "previewUrl", "revoked"], "PUBLICATION_PRODUCTION_AUTH_INVALID", "productionAuthorization");
  timestamp(value.authorizedAt, "productionAuthorization.authorizedAt");
  timestamp(value.expiresAt, "productionAuthorization.expiresAt");
  if (!SHA256.test(value.authorizationHash) || !SHA256.test(value.candidateHash) || !SHA256.test(value.bindingHash) || !SHA256.test(value.previewReceiptHash) || !GIT_SHA.test(value.headSha) || !GIT_SHA.test(value.baseSha) || !Number.isInteger(value.prNumber) || value.prNumber < 1 || !Number.isInteger(value.previewGithubDeploymentId) || value.previewGithubDeploymentId < 1 || !isVercelDeploymentUrl(value.previewUrl) || value.revoked !== false || value.candidateHash !== handoff.candidateHash || value.bindingHash !== handoff.bindingHash || Date.parse(value.expiresAt) <= now.getTime() || blankFieldHash(value, "authorizationHash") !== value.authorizationHash) {
    fail("PUBLICATION_PRODUCTION_AUTH_INVALID", "Production authorization is invalid or stale");
  }
}

export function validateHandoff(handoff, now = new Date()) {
  exactKeys(handoff, ["schemaVersion", "sourceKind", "phase", "jobId", "claimId", "claimExpiresAt", "handoffHash", "repository", "candidateId", "candidateHash", "sourceHash", "bindingHash", "previewApprovalHash", "taxonomy", "website", "assets", "previewReceipt", "productionAuthorization"], "PUBLICATION_HANDOFF_INVALID", "handoff");
  if (handoff.schemaVersion !== HANDOFF_VERSION || handoff.sourceKind !== "owner_attested_real" || !["preview", "production"].includes(handoff.phase) || !JOB_ID.test(handoff.jobId) || !UUID.test(handoff.claimId) || !CANDIDATE_ID.test(handoff.candidateId) || ![handoff.handoffHash, handoff.candidateHash, handoff.sourceHash, handoff.bindingHash, handoff.previewApprovalHash].every((value) => SHA256.test(value))) fail("PUBLICATION_HANDOFF_INVALID", "Handoff identity or real-source attestation is invalid");
  timestamp(handoff.claimExpiresAt, "claimExpiresAt");
  if (Date.parse(handoff.claimExpiresAt) <= now.getTime()) fail("PUBLICATION_CLAIM_EXPIRED", "Worker claim has expired");
  exactKeys(handoff.repository, ["fullName", "baseBranch"], "PUBLICATION_REPOSITORY_INVALID", "repository");
  if (handoff.repository.fullName !== CARKEY_REPOSITORY || handoff.repository.baseBranch !== "main") fail("PUBLICATION_REPOSITORY_INVALID", "Repository binding is invalid");
  validateTaxonomy(handoff.taxonomy);
  validateWebsite(handoff.website);
  if (!Array.isArray(handoff.assets) || handoff.assets.length < 1 || handoff.assets.length > 8 || new Set(handoff.assets.map((asset) => asset.mediaId)).size !== handoff.assets.length) fail("PUBLICATION_ASSET_INVALID", "Asset collection is invalid");
  handoff.assets.forEach((asset) => validateAsset(asset, handoff));
  if (JSON.stringify(handoff.website.heroMediaIds) !== JSON.stringify(handoff.assets.map((asset) => asset.mediaId))) fail("PUBLICATION_ASSET_INVALID", "Website media order differs from approved assets");
  if (handoff.phase === "preview") {
    if (handoff.previewReceipt !== null || handoff.productionAuthorization !== null) fail("PUBLICATION_HANDOFF_INVALID", "Preview claim must not carry later-stage authority");
  } else {
    validatePreviewReceipt(handoff.previewReceipt);
    validateProductionAuthorization(handoff.productionAuthorization, handoff, now);
    if (handoff.previewReceipt.receiptHash !== handoff.productionAuthorization.previewReceiptHash || handoff.previewReceipt.pullRequest.number !== handoff.productionAuthorization.prNumber || handoff.previewReceipt.repository.headSha !== handoff.productionAuthorization.headSha || handoff.previewReceipt.repository.baseSha !== handoff.productionAuthorization.baseSha || handoff.previewReceipt.previewDeployment.githubDeploymentId !== handoff.productionAuthorization.previewGithubDeploymentId || handoff.previewReceipt.previewDeployment.environmentUrl !== handoff.productionAuthorization.previewUrl) fail("PUBLICATION_PRODUCTION_AUTH_INVALID", "Production authorization does not bind the exact Preview");
  }
  if (blankFieldHash(handoff, "handoffHash") !== handoff.handoffHash) fail("PUBLICATION_HANDOFF_HASH_MISMATCH", "Handoff hash is invalid");
  return handoff;
}

function validateDeployment(value, environment, sourceSha, code) {
  exactKeys(value, ["githubDeploymentId", "githubDeploymentStatusId", "environment", "environmentUrl", "sourceSha", "state", "providerDeploymentId", "providerDeploymentIdStatus", "accessMode"], code, "deployment");
  if (!Number.isInteger(value.githubDeploymentId) || value.githubDeploymentId < 1 || !Number.isInteger(value.githubDeploymentStatusId) || value.githubDeploymentStatusId < 1 || value.environment !== environment || value.sourceSha !== sourceSha || value.state !== "success" || !isVercelDeploymentUrl(value.environmentUrl) || !["anonymous_verified", "vercel_sso_protected"].includes(value.accessMode) || !["verified", "unavailable"].includes(value.providerDeploymentIdStatus) || value.providerDeploymentIdStatus === "unavailable" && value.providerDeploymentId !== null || value.providerDeploymentIdStatus === "verified" && !/^dpl_[A-Za-z0-9]+$/.test(value.providerDeploymentId ?? "")) fail(code, "GitHub deployment evidence is invalid");
}

export function validatePreviewReceipt(receipt) {
  exactKeys(receipt, ["schemaVersion", "status", "receiptHash", "jobId", "claimId", "handoffHash", "candidateHash", "sourceHash", "bindingHash", "previewApprovalHash", "repository", "pullRequest", "checks", "previewDeployment", "publicResult", "previewVerificationHash", "createdAt"], "PUBLICATION_PREVIEW_RECEIPT_INVALID", "preview receipt");
  if (receipt.schemaVersion !== PREVIEW_RECEIPT_VERSION || receipt.status !== "preview_ready" || !JOB_ID.test(receipt.jobId) || !UUID.test(receipt.claimId) || ![receipt.receiptHash, receipt.handoffHash, receipt.candidateHash, receipt.sourceHash, receipt.bindingHash, receipt.previewApprovalHash, receipt.previewVerificationHash].every((value) => SHA256.test(value))) fail("PUBLICATION_PREVIEW_RECEIPT_INVALID", "Preview receipt identity is invalid");
  exactKeys(receipt.repository, ["fullName", "baseBranch", "baseSha", "featureBranch", "headSha", "treeSha", "changedPaths", "changedPathsHash"], "PUBLICATION_PREVIEW_RECEIPT_INVALID", "repository");
  if (receipt.repository.fullName !== CARKEY_REPOSITORY || receipt.repository.baseBranch !== "main" || !GIT_SHA.test(receipt.repository.baseSha) || !BRANCH.test(receipt.repository.featureBranch) || !GIT_SHA.test(receipt.repository.headSha) || !GIT_SHA.test(receipt.repository.treeSha) || JSON.stringify(receipt.repository.changedPaths) !== JSON.stringify([...receipt.repository.changedPaths].sort()) || receipt.repository.changedPathsHash !== changedPathsHash(receipt.repository.changedPaths)) fail("PUBLICATION_PREVIEW_RECEIPT_INVALID", "Repository receipt binding is invalid");
  exactKeys(receipt.pullRequest, ["number", "url", "state", "draft", "baseRef", "baseSha", "headSha"], "PUBLICATION_PREVIEW_RECEIPT_INVALID", "pullRequest");
  if (!Number.isInteger(receipt.pullRequest.number) || receipt.pullRequest.number < 1 || receipt.pullRequest.url !== `https://github.com/${CARKEY_REPOSITORY}/pull/${receipt.pullRequest.number}` || receipt.pullRequest.state !== "OPEN" || receipt.pullRequest.draft !== true || receipt.pullRequest.baseRef !== "main" || receipt.pullRequest.baseSha !== receipt.repository.baseSha || receipt.pullRequest.headSha !== receipt.repository.headSha) fail("PUBLICATION_PREVIEW_RECEIPT_INVALID", "Pull request receipt binding is invalid");
  exactKeys(receipt.checks, ["requiredStatus", "checksDigest", "items"], "PUBLICATION_PREVIEW_RECEIPT_INVALID", "checks");
  if (receipt.checks.requiredStatus !== "success" || !SHA256.test(receipt.checks.checksDigest) || !Array.isArray(receipt.checks.items) || receipt.checks.items.length < 2 || receipt.checks.items.some((entry) => !plain(entry) || typeof entry.name !== "string" || !["success", "neutral", "skipped"].includes(entry.conclusion) || typeof entry.required !== "boolean" || !(entry.detailsUrl === null || String(entry.detailsUrl).startsWith("https://"))) || !receipt.checks.items.some((entry) => entry.name === "Static site release gates" && entry.conclusion === "success") || receipt.checks.checksDigest !== sha256(canonicalJson(receipt.checks.items))) fail("PUBLICATION_PREVIEW_RECEIPT_INVALID", "Required check evidence is incomplete");
  validateDeployment(receipt.previewDeployment, PREVIEW_ENVIRONMENT, receipt.repository.headSha, "PUBLICATION_PREVIEW_DEPLOYMENT_INVALID");
  exactKeys(receipt.publicResult, ["publicationPath", "canonicalUrl", "contentSha256", "assetManifestHash", "schemaTypes", "sitemapIncluded", "httpStatus", "noindexVerified"], "PUBLICATION_PREVIEW_RECEIPT_INVALID", "publicResult");
  if (!localRoute(receipt.publicResult.publicationPath) || receipt.publicResult.canonicalUrl !== `${CARKEY_ORIGIN}${receipt.publicResult.publicationPath}` || !SHA256.test(receipt.publicResult.contentSha256) || !SHA256.test(receipt.publicResult.assetManifestHash) || JSON.stringify(receipt.publicResult.schemaTypes) !== JSON.stringify(["Article", "BreadcrumbList", "FAQPage"]) || receipt.publicResult.sitemapIncluded !== true || ![200, 302, 401, 403].includes(receipt.publicResult.httpStatus) || receipt.previewDeployment.accessMode === "anonymous_verified" && (receipt.publicResult.httpStatus !== 200 || receipt.publicResult.noindexVerified !== true) || receipt.previewDeployment.accessMode === "vercel_sso_protected" && receipt.publicResult.noindexVerified !== false) fail("PUBLICATION_PREVIEW_RECEIPT_INVALID", "Preview public-result verification is incomplete");
  const verificationProjection = { repository: receipt.repository, pullRequest: receipt.pullRequest, checks: receipt.checks, previewDeployment: receipt.previewDeployment, publicResult: receipt.publicResult };
  if (receipt.previewVerificationHash !== sha256(canonicalJson(verificationProjection))) fail("PUBLICATION_PREVIEW_RECEIPT_INVALID", "Preview verification hash is invalid");
  timestamp(receipt.createdAt, "createdAt");
  if (blankFieldHash(receipt, "receiptHash") !== receipt.receiptHash) fail("PUBLICATION_PREVIEW_RECEIPT_HASH_MISMATCH", "Preview receipt hash is invalid");
  return receipt;
}

export function createPreviewReceipt(input) {
  const receipt = { schemaVersion: PREVIEW_RECEIPT_VERSION, status: "preview_ready", receiptHash: "", ...input };
  receipt.previewVerificationHash = sha256(canonicalJson({ repository: receipt.repository, pullRequest: receipt.pullRequest, checks: receipt.checks, previewDeployment: receipt.previewDeployment, publicResult: receipt.publicResult }));
  receipt.receiptHash = blankFieldHash(receipt, "receiptHash");
  return validatePreviewReceipt(receipt);
}

export function validateProductionReceipt(receipt) {
  exactKeys(receipt, ["schemaVersion", "status", "receiptHash", "jobId", "claimId", "handoffHash", "candidateHash", "sourceHash", "bindingHash", "previewReceiptHash", "authorizationHash", "repository", "pullRequest", "productionDeployment", "publicResult", "productionVerificationHash", "rollback", "createdAt"], "PUBLICATION_PRODUCTION_RECEIPT_INVALID", "production receipt");
  if (receipt.schemaVersion !== PRODUCTION_RECEIPT_VERSION || receipt.status !== "published" || !JOB_ID.test(receipt.jobId) || !UUID.test(receipt.claimId) || ![receipt.receiptHash, receipt.handoffHash, receipt.candidateHash, receipt.sourceHash, receipt.bindingHash, receipt.previewReceiptHash, receipt.authorizationHash, receipt.productionVerificationHash].every((value) => SHA256.test(value))) fail("PUBLICATION_PRODUCTION_RECEIPT_INVALID", "Production receipt identity is invalid");
  exactKeys(receipt.repository, ["fullName", "baseBranch", "mainBeforeSha", "authorizedHeadSha", "mergeSha", "mainAfterSha"], "PUBLICATION_PRODUCTION_RECEIPT_INVALID", "repository");
  if (receipt.repository.fullName !== CARKEY_REPOSITORY || receipt.repository.baseBranch !== "main" || ![receipt.repository.mainBeforeSha, receipt.repository.authorizedHeadSha, receipt.repository.mergeSha].every((value) => GIT_SHA.test(value)) || receipt.repository.mainAfterSha !== receipt.repository.mergeSha) fail("PUBLICATION_PRODUCTION_RECEIPT_INVALID", "Production repository evidence is invalid");
  exactKeys(receipt.pullRequest, ["number", "url", "mergedAt", "mergeMethod"], "PUBLICATION_PRODUCTION_RECEIPT_INVALID", "pullRequest");
  if (!Number.isInteger(receipt.pullRequest.number) || receipt.pullRequest.number < 1 || receipt.pullRequest.url !== `https://github.com/${CARKEY_REPOSITORY}/pull/${receipt.pullRequest.number}` || receipt.pullRequest.mergeMethod !== "merge") fail("PUBLICATION_PRODUCTION_RECEIPT_INVALID", "Merged PR evidence is invalid");
  timestamp(receipt.pullRequest.mergedAt, "pullRequest.mergedAt");
  validateDeployment(receipt.productionDeployment, PRODUCTION_ENVIRONMENT, receipt.repository.mergeSha, "PUBLICATION_PRODUCTION_DEPLOYMENT_INVALID");
  exactKeys(receipt.publicResult, ["publicationPath", "canonicalUrl", "contentSha256", "assetManifestHash", "schemaTypes", "sitemapIncluded", "httpStatus"], "PUBLICATION_PRODUCTION_RECEIPT_INVALID", "publicResult");
  if (!localRoute(receipt.publicResult.publicationPath) || receipt.publicResult.canonicalUrl !== `${CARKEY_ORIGIN}${receipt.publicResult.publicationPath}` || !SHA256.test(receipt.publicResult.contentSha256) || !SHA256.test(receipt.publicResult.assetManifestHash) || JSON.stringify(receipt.publicResult.schemaTypes) !== JSON.stringify(["Article", "BreadcrumbList", "FAQPage"]) || receipt.publicResult.sitemapIncluded !== true || receipt.publicResult.httpStatus !== 200) fail("PUBLICATION_PRODUCTION_RECEIPT_INVALID", "Production public-result verification is incomplete");
  exactKeys(receipt.rollback, ["mode", "automaticRollbackPerformed", "previousGithubDeploymentId"], "PUBLICATION_PRODUCTION_RECEIPT_INVALID", "rollback");
  if (receipt.rollback.mode !== "revert_pr" || receipt.rollback.automaticRollbackPerformed !== false || !(receipt.rollback.previousGithubDeploymentId === null || Number.isInteger(receipt.rollback.previousGithubDeploymentId))) fail("PUBLICATION_PRODUCTION_RECEIPT_INVALID", "Rollback receipt is invalid");
  const verificationProjection = { repository: receipt.repository, pullRequest: receipt.pullRequest, productionDeployment: receipt.productionDeployment, publicResult: receipt.publicResult, rollback: receipt.rollback };
  if (receipt.productionVerificationHash !== sha256(canonicalJson(verificationProjection))) fail("PUBLICATION_PRODUCTION_RECEIPT_INVALID", "Production verification hash is invalid");
  timestamp(receipt.createdAt, "createdAt");
  if (blankFieldHash(receipt, "receiptHash") !== receipt.receiptHash) fail("PUBLICATION_PRODUCTION_RECEIPT_HASH_MISMATCH", "Production receipt hash is invalid");
  return receipt;
}

export function createProductionReceipt(input) {
  const receipt = { schemaVersion: PRODUCTION_RECEIPT_VERSION, status: "published", receiptHash: "", ...input };
  receipt.productionVerificationHash = sha256(canonicalJson({ repository: receipt.repository, pullRequest: receipt.pullRequest, productionDeployment: receipt.productionDeployment, publicResult: receipt.publicResult, rollback: receipt.rollback }));
  receipt.receiptHash = blankFieldHash(receipt, "receiptHash");
  return validateProductionReceipt(receipt);
}

export function createFailureReceipt({ phase, handoff, code, retryable, detail, createdAt, rollback, stage = "pre_merge" }) {
  const receipt = {
    schemaVersion: phase === "preview" ? PREVIEW_RECEIPT_VERSION : PRODUCTION_RECEIPT_VERSION,
    status: "failed", receiptHash: "", jobId: handoff.jobId, claimId: handoff.claimId,
    handoffHash: handoff.handoffHash, candidateHash: handoff.candidateHash, bindingHash: handoff.bindingHash,
    failure: { code, retryable, detailDigest: sha256(String(detail)) }, createdAt
  };
  if (phase === "production") {
    receipt.failure.stage = stage;
    receipt.rollback = rollback ?? { required: false, attempted: false, status: "not_required", triggerMergeSha: null, revertPrNumber: null, revertPrUrl: null, revertHeadSha: null, rollbackMergeSha: null, productionGithubDeploymentId: null, verifiedAt: null, routeHttpStatus: null, sitemapOccurrenceCount: null, rollbackVerificationHash: null };
  }
  receipt.receiptHash = blankFieldHash(receipt, "receiptHash");
  return receipt;
}

function magicMatches(bytes, mime) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export async function sanitizeAssets(handoff, mediaById) {
  const results = [];
  for (const asset of handoff.assets) {
    const bytes = mediaById.get(asset.mediaId);
    if (!Buffer.isBuffer(bytes) || bytes.byteLength !== asset.byteLength || sha256(bytes) !== asset.sha256 || !magicMatches(bytes, asset.mime)) fail("PUBLICATION_ASSET_HASH_MISMATCH", "Downloaded asset does not match its approved binding");
    let metadata;
    try { metadata = await sharp(bytes, { failOn: "error", limitInputPixels: 64_000_000 }).metadata(); } catch { fail("PUBLICATION_ASSET_DECODE_FAILED", "Approved asset cannot be decoded"); }
    if (metadata.pages > 1 || asset.width !== null && metadata.width !== asset.width || asset.height !== null && metadata.height !== asset.height) fail("PUBLICATION_ASSET_DIMENSION_MISMATCH", "Asset dimensions differ from the approved binding");
    const output = await sharp(bytes, { failOn: "error", limitInputPixels: 64_000_000 }).rotate().webp({ quality: 86, alphaQuality: 90, effort: 5 }).toBuffer();
    const outputMetadata = await sharp(output).metadata();
    if (output.byteLength > MAX_PUBLICATION_ASSET_BYTES || outputMetadata.format !== "webp" || outputMetadata.exif || outputMetadata.icc || outputMetadata.xmp || outputMetadata.iptc) fail("PUBLICATION_ASSET_SANITIZATION_FAILED", "Sanitized asset exceeded the publication limit or retained metadata");
    results.push({ mediaId: asset.mediaId, bytes: output, sha256: sha256(output), width: outputMetadata.width, height: outputMetadata.height, altText: asset.altText });
  }
  return results;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function safeJson(value) {
  return canonicalJson(value).replaceAll("<", "\\u003c");
}

function run(command, args, cwd, code) {
  try { return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (error) { fail(code, error?.stderr?.toString("utf8")?.trim() || `${command} failed`); }
}

function contacts(worktreeRoot) {
  const html = run("git", ["show", "HEAD:rescue-request.html"], worktreeRoot, "PUBLICATION_CARKEY_COMPATIBILITY");
  const telephone = html.match(/href=["'](tel:[^"']+)["']/i)?.[1];
  const line = html.match(/href=["'](https:\/\/(?:line\.me|lin\.ee)\/[^"']+)["']/i)?.[1];
  if (!telephone || !line) fail("PUBLICATION_CARKEY_COMPATIBILITY", "Current public contact links are unavailable");
  return { telephone, line };
}

function renderPage(handoff, assets, publicContacts) {
  const website = handoff.website;
  const taxonomy = handoff.taxonomy;
  const canonical = `${CARKEY_ORIGIN}/${website.proposedSlug}`;
  const seoTitle = website.seoTitle.includes("極致核心 ProCore") ? website.seoTitle : `${website.seoTitle} | 極致核心 ProCore`;
  const records = assets.map((asset) => ({ ...asset, path: `img/cases/${handoff.candidateId}/${asset.mediaId}.webp` }));
  const article = { "@context": "https://schema.org", "@type": "Article", "@id": `${canonical}#article`, url: canonical, headline: website.schemaHeadline, description: website.metaDescription, image: records.map((asset) => `${CARKEY_ORIGIN}/${asset.path}`), datePublished: website.datePublished, dateModified: website.datePublished, inLanguage: "zh-TW", publisher: { "@type": "Organization", name: "極致核心 ProCore Auto Key" }, author: { "@type": "Organization", name: "極致核心 ProCore Auto Key" }, mainEntityOfPage: canonical };
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", "@id": `${canonical}#breadcrumb`, itemListElement: website.breadcrumb.map((entry, index) => ({ "@type": "ListItem", position: index + 1, name: entry.name, item: entry.item.startsWith("https://") ? entry.item : `${CARKEY_ORIGIN}${entry.item}` })) };
  const faq = { "@context": "https://schema.org", "@type": "FAQPage", "@id": `${canonical}#faq`, mainEntity: website.faq.map((entry) => ({ "@type": "Question", name: entry.question, acceptedAnswer: { "@type": "Answer", text: entry.answer } })) };
  const gallery = records.map((asset, index) => `<figure><img src="/${asset.path}" width="${asset.width}" height="${asset.height}" alt="${escapeHtml(asset.altText)}" loading="${index === 0 ? "eager" : "lazy"}"><figcaption>${escapeHtml(asset.altText)}</figcaption></figure>`).join("\n");
  const facts = website.publicSafeFacts.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("\n");
  const faqs = website.faq.map((entry) => `<details><summary>${escapeHtml(entry.question)}</summary><p>${escapeHtml(entry.answer)}</p></details>`).join("\n");
  const links = website.suggestedInternalLinks.map((entry) => `<a href="${escapeHtml(entry.route)}">${escapeHtml(entry.anchor)}</a>`).join("\n");
  const html = `<!doctype html>\n<html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(seoTitle)}</title><meta name="description" content="${escapeHtml(website.metaDescription)}"><link rel="canonical" href="${canonical}"><meta name="robots" content="index, follow, max-image-preview:large"><meta property="og:type" content="article"><meta property="og:site_name" content="極致核心 ProCore Auto Key"><meta property="og:title" content="${escapeHtml(seoTitle)}"><meta property="og:description" content="${escapeHtml(website.metaDescription)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${CARKEY_ORIGIN}/${records[0].path}"><link rel="stylesheet" href="/assets/css/tailwind-procore.css"><style>body{margin:0;background:#050505;color:#e5e5e5;font-family:system-ui,sans-serif;line-height:1.8}main{width:min(960px,calc(100% - 32px));margin:auto;padding:40px 0 72px}.panel{margin-top:24px;padding:clamp(20px,5vw,44px);background:#171717;border:1px solid #333;border-radius:22px}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}figure{margin:0}img{display:block;width:100%;height:auto;border-radius:16px}a{color:#f5d66f;margin-right:18px}.cta{display:inline-block;padding:12px 18px;border:1px solid #d4af37;border-radius:999px}</style><script type="application/ld+json" data-seo="article">${safeJson(article)}</script><script type="application/ld+json" data-seo="breadcrumb">${safeJson(breadcrumb)}</script><script type="application/ld+json" data-seo="faq">${safeJson(faq)}</script></head><body><main><nav><a href="/">PROCORE</a><a href="/cases">案例</a><a href="/blog">專欄</a></nav><header class="panel"><p>${escapeHtml(taxonomy.region)}｜${escapeHtml(taxonomy.vehicle.year)} ${escapeHtml(taxonomy.vehicle.brand)} ${escapeHtml(taxonomy.vehicle.model)}｜${escapeHtml(taxonomy.serviceLabel)}</p><h1>${escapeHtml(website.schemaHeadline)}</h1><p>${escapeHtml(website.metaDescription)}</p><div class="gallery">${gallery}</div></header><article class="panel"><h2 id="case-overview">案例概況</h2><p>${escapeHtml(website.sanitizedNarrative)}</p><h2 id="public-facts">公開安全資訊</h2><ul>${facts}</ul><h2 id="faq">車主常見問題</h2>${faqs}<nav aria-label="相關連結">${links}</nav><p><a class="cta" href="${escapeHtml(publicContacts.telephone)}">電話聯絡</a><a class="cta" href="${escapeHtml(publicContacts.line)}">LINE 諮詢</a></p></article></main><script src="/assets/js/procore-conversion-tracking.js" defer></script></body></html>\n`;
  safePublicValue(html, "renderedHtml");
  return { html, canonical, records };
}

export async function applyPreviewHandoff({ handoff, worktreeRoot, mediaById, now = new Date() }) {
  validateHandoff(handoff, now);
  if (handoff.phase !== "preview") fail("PUBLICATION_PHASE_INVALID", "Only Preview handoffs can generate site content");
  const pagePath = `${handoff.website.proposedSlug}.html`;
  if (existsSync(path.join(worktreeRoot, pagePath))) fail("PUBLICATION_SLUG_COLLISION", "Proposed route already exists");
  for (const route of new Set([...handoff.website.suggestedInternalLinks.map((link) => link.route), ...handoff.taxonomy.relatedRoutes])) {
    const file = route === "/" ? "index.html" : `${route.slice(1)}.html`;
    if (!existsSync(path.join(worktreeRoot, file))) fail("PUBLICATION_INTERNAL_LINK_INVALID", `Internal link does not exist: ${route}`);
  }
  const sanitized = await sanitizeAssets(handoff, mediaById);
  const rendered = renderPage(handoff, sanitized, contacts(worktreeRoot));
  await writeFile(path.join(worktreeRoot, pagePath), rendered.html, { flag: "wx" });
  for (const asset of rendered.records) {
    const destination = path.join(worktreeRoot, asset.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, asset.bytes, { flag: "wx" });
  }
  const firstAsset = rendered.records[0];
  run("python3", ["publish_tool.py", "--root", worktreeRoot, handoff.website.seoTitle, `/${pagePath}`, "到場處理案例", handoff.website.metaDescription, "--date", handoff.website.datePublished.replaceAll("-", "."), "--lastmod", handoff.website.datePublished, "--case-region", handoff.taxonomy.region, "--case-car", `${handoff.taxonomy.vehicle.brand} ${handoff.taxonomy.vehicle.model}`, "--case-img", `/${firstAsset.path}`, "--case-type", handoff.taxonomy.serviceLabel, "--preserve-schema-governed-html"], worktreeRoot, "PUBLICATION_REGISTRY_SYNC_FAILED");
  const historyPath = `data/publication-actions/${handoff.candidateId}.json`;
  await mkdir(path.dirname(path.join(worktreeRoot, historyPath)), { recursive: true });
  await writeFile(path.join(worktreeRoot, historyPath), `${canonicalJson({ historyVersion: "publication-history/v2", candidateId: handoff.candidateId, candidateHash: handoff.candidateHash, sourceHash: handoff.sourceHash, bindingHash: handoff.bindingHash, canonicalUrl: rendered.canonical })}\n`, { flag: "wx" });
  let status;
  try { status = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: worktreeRoot, encoding: "utf8" }); }
  catch { fail("PUBLICATION_GIT_STATE_INVALID", "Unable to inspect generated paths"); }
  const changedPaths = status.split("\0").filter(Boolean).map((line) => line.slice(3)).sort();
  const expected = [pagePath, ...rendered.records.map((asset) => asset.path), "blog.json", "cases.json", "sitemap.xml", historyPath].sort();
  if (JSON.stringify(changedPaths) !== JSON.stringify(expected)) fail("PUBLICATION_CHANGED_PATH_DRIFT", `Generated paths differ from the exact allowlist: ${canonicalJson({ changedPaths, expected })}`);
  const route = `/${handoff.website.proposedSlug}`;
  const sitemap = await readFile(path.join(worktreeRoot, "sitemap.xml"), "utf8");
  const blog = JSON.parse(await readFile(path.join(worktreeRoot, "blog.json"), "utf8"));
  if (!sitemap.includes(rendered.canonical) || !blog.some((entry) => entry.link === route)) fail("PUBLICATION_REGISTRY_VERIFY_FAILED", "Sitemap or blog registry does not contain the exact route");
  const assetManifest = rendered.records.map((asset) => ({ path: asset.path, sha256: asset.sha256, width: asset.width, height: asset.height, altText: asset.altText }));
  return { changedPaths, changedPathsHash: changedPathsHash(changedPaths), publicationPath: route, canonicalUrl: rendered.canonical, contentSha256: sha256(Buffer.from(rendered.html)), assetManifest, assetManifestHash: sha256(canonicalJson(assetManifest)), schemaTypes: ["Article", "BreadcrumbList", "FAQPage"] };
}

export function publicationBranch(handoff) {
  const branch = `publication/case-${handoff.candidateId.slice(4)}-job-${handoff.jobId.slice(4)}`;
  if (!BRANCH.test(branch)) fail("PUBLICATION_BRANCH_INVALID", "Publication branch is invalid");
  return branch;
}

export function assertDisposableWorktree(worktreeRoot, canonicalRoot, expectedBaseSha) {
  const top = run("git", ["rev-parse", "--show-toplevel"], worktreeRoot, "PUBLICATION_WORKTREE_INVALID");
  const gitDir = run("git", ["rev-parse", "--path-format=absolute", "--git-dir"], worktreeRoot, "PUBLICATION_WORKTREE_INVALID");
  const head = run("git", ["rev-parse", "HEAD"], worktreeRoot, "PUBLICATION_WORKTREE_INVALID");
  if (realpathSync(top) !== realpathSync(worktreeRoot) || realpathSync(top) === realpathSync(canonicalRoot) || !gitDir.includes(`${path.sep}worktrees${path.sep}`) || head !== expectedBaseSha || run("git", ["status", "--porcelain"], worktreeRoot, "PUBLICATION_WORKTREE_INVALID")) fail("PUBLICATION_WORKTREE_INVALID", "A clean disposable worktree at the exact base is required");
  return true;
}

export function selectExactDeployment(deployments, statusesById, { environment, sourceSha }) {
  const candidates = deployments.filter((deployment) => deployment.environment === environment && deployment.sha === sourceSha);
  if (candidates.length !== 1) fail("PUBLICATION_DEPLOYMENT_AMBIGUOUS", `Expected exactly one ${environment} deployment for the authorized SHA`, true);
  const deployment = candidates[0];
  const statuses = statusesById.get(deployment.id) ?? [];
  const status = statuses.find((entry) => entry.state === "success" && isVercelDeploymentUrl(entry.environment_url));
  if (!status) fail("PUBLICATION_DEPLOYMENT_NOT_READY", "Exact GitHub deployment is not ready", true);
  return { githubDeploymentId: deployment.id, githubDeploymentStatusId: status.id, environment, environmentUrl: status.environment_url, sourceSha, state: "success", providerDeploymentId: null, providerDeploymentIdStatus: "unavailable", accessMode: "anonymous_verified" };
}
