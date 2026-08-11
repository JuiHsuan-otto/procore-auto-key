#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  CARKEY_ORIGIN,
  CARKEY_REPOSITORY,
  MAX_PUBLICATION_ASSET_BYTES,
  PREVIEW_ENVIRONMENT,
  PRODUCTION_ENVIRONMENT,
  PublicationV2Error,
  applyPreviewHandoff,
  assertDisposableWorktree,
  canonicalJson,
  changedPathsHash,
  createFailureReceipt,
  createPreviewReceipt,
  createProductionReceipt,
  publicationBranch,
  blankFieldHash,
  selectExactDeployment,
  sha256,
  validateHandoff
} from "./publication-v2.mjs";

const POLL_MS = Number(process.env.PUBLICATION_POLL_MS ?? 15_000);
const POLL_ATTEMPTS = Number(process.env.PUBLICATION_POLL_ATTEMPTS ?? 40);
const WORKER_DEADLINE_AT = Date.now() + Number(process.env.PUBLICATION_WORKER_DEADLINE_MS ?? 75 * 60_000);
export const CASEPILOT_PUBLICATION_ORIGIN = "https://casepilot-automotive-git-feat-cas-f0ce72-ottoyeh-7522s-projects.vercel.app";

function fail(code, message, retryable = false) {
  throw new PublicationV2Error(code, message, retryable);
}

function run(command, args, cwd, code = "PUBLICATION_COMMAND_FAILED") {
  try {
    return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: process.env }).trim();
  } catch (error) {
    const message = error?.stderr?.toString("utf8")?.trim();
    fail(code, message || `${command} failed`);
  }
}

function runBuffer(command, args, cwd, code = "PUBLICATION_COMMAND_FAILED") {
  try { return execFileSync(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env }); }
  catch (error) { fail(code, error?.stderr?.toString("utf8")?.trim() || `${command} failed`); }
}

function ghJson(args, cwd, code) {
  const value = run("gh", args, cwd, code);
  try { return JSON.parse(value); } catch { fail(code, "GitHub returned invalid JSON"); }
}

export function originUrl(raw) {
  if (!raw) fail("PUBLICATION_ORIGIN_MISSING", "CASEPILOT_PUBLICATION_ORIGIN is not configured");
  let url;
  try { url = new URL(raw); } catch { fail("PUBLICATION_ORIGIN_INVALID", "CasePilot publication origin is invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || url.origin !== CASEPILOT_PUBLICATION_ORIGIN) fail("PUBLICATION_ORIGIN_INVALID", "CasePilot publication origin must exactly match the compiled OIDC audience receiver");
  return url.origin;
}

export async function githubOidcToken(fetchImpl = fetch) {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) fail("PUBLICATION_OIDC_UNAVAILABLE", "GitHub Actions OIDC is unavailable");
  const url = new URL(requestUrl);
  url.searchParams.set("audience", "casepilot-publication");
  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${requestToken}`, Accept: "application/json" }, redirect: "error" });
  if (!response.ok) fail("PUBLICATION_OIDC_FAILED", `OIDC request failed with HTTP ${response.status}`, true);
  const body = await response.json();
  if (typeof body?.value !== "string" || body.value.split(".").length !== 3) fail("PUBLICATION_OIDC_FAILED", "OIDC response did not contain a JWT");
  return body.value;
}

async function apiRequest(origin, token, pathname, { method = "GET", body, fetchImpl = fetch } = {}) {
  const url = new URL(pathname, `${origin}/`);
  if (url.origin !== origin) fail("PUBLICATION_API_BOUNDARY", "CasePilot API request escaped its configured origin");
  const response = await fetchImpl(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? canonicalJson(body) : undefined,
    redirect: "error",
    cache: "no-store"
  });
  return response;
}

export async function claimJob({ phase, origin, token, fetchImpl = fetch }) {
  const response = await apiRequest(origin, token, "/api/publication/worker/claim", { method: "POST", body: { phase }, fetchImpl });
  if (response.status === 204) return null;
  if (!response.ok) fail("PUBLICATION_CLAIM_FAILED", `Claim failed with HTTP ${response.status}`, response.status >= 500);
  const handoff = await response.json();
  return validateHandoff(handoff);
}

export async function readBoundedResponseBytes(response, { expectedBytes = null, maxBytes = MAX_PUBLICATION_ASSET_BYTES } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || expectedBytes !== null && (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1 || expectedBytes > maxBytes)) {
    fail("PUBLICATION_MEDIA_BOUND_INVALID", "Publication response byte bound is invalid");
  }
  const declaredRaw = response.headers.get("content-length");
  if (declaredRaw === null || !/^(?:0|[1-9]\d*)$/.test(declaredRaw)) {
    fail("PUBLICATION_MEDIA_LENGTH_REQUIRED", "Publication response requires an exact Content-Length before reading");
  }
  const declaredBytes = Number(declaredRaw);
  if (!Number.isSafeInteger(declaredBytes) || declaredBytes > maxBytes || expectedBytes !== null && declaredBytes !== expectedBytes) {
    fail("PUBLICATION_MEDIA_LENGTH_MISMATCH", "Publication response Content-Length exceeds or differs from its approved bound");
  }
  const reader = response.body?.getReader();
  if (!reader) fail("PUBLICATION_MEDIA_BODY_MISSING", "Publication response body is unavailable");
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      assertWithinWorkerDeadline();
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) fail("PUBLICATION_MEDIA_BODY_INVALID", "Publication response yielded an invalid byte chunk");
      const nextTotal = total + value.byteLength;
      if (nextTotal > declaredBytes || nextTotal > maxBytes || expectedBytes !== null && nextTotal > expectedBytes) {
        await reader.cancel("publication byte limit exceeded").catch(() => undefined);
        fail("PUBLICATION_MEDIA_TOO_LARGE", "Publication response exceeded its approved byte bound");
      }
      chunks.push(Buffer.from(value));
      total = nextTotal;
    }
  } finally {
    reader.releaseLock();
  }
  if (total !== declaredBytes || expectedBytes !== null && total !== expectedBytes) {
    fail("PUBLICATION_MEDIA_LENGTH_MISMATCH", "Publication response body length differs from its approved binding");
  }
  return Buffer.concat(chunks, total);
}

export async function downloadApprovedAssets({ handoff, origin, token, fetchImpl = fetch }) {
  const mediaById = new Map();
  for (const asset of handoff.assets) {
    const response = await apiRequest(origin, token, asset.downloadPath, { fetchImpl });
    if (!response.ok) fail("PUBLICATION_MEDIA_DOWNLOAD_FAILED", `Approved media download failed with HTTP ${response.status}`, response.status >= 500);
    const contentType = response.headers.get("content-type")?.split(";")[0];
    const bytes = await readBoundedResponseBytes(response, { expectedBytes: asset.byteLength });
    if (contentType !== asset.mime || bytes.length !== asset.byteLength || sha256(bytes) !== asset.sha256) fail("PUBLICATION_MEDIA_BINDING_MISMATCH", "Downloaded media differs from the approved binding");
    mediaById.set(asset.mediaId, bytes);
  }
  return mediaById;
}

async function postReceipt({ phase, handoff, receipt, origin, fetchImpl = fetch }) {
  const endpoint = `/api/publication/worker/receipts/${phase}`;
  const freshToken = await githubOidcToken(fetchImpl);
  const response = await apiRequest(origin, freshToken, endpoint, { method: "POST", body: receipt, fetchImpl });
  if (!response.ok) fail("PUBLICATION_RECEIPT_POST_FAILED", `${phase} receipt failed with HTTP ${response.status}`, response.status >= 500);
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export function assertWithinWorkerDeadline(now = Date.now(), deadline = WORKER_DEADLINE_AT) {
  if (now >= deadline) fail("PUBLICATION_WORKER_DEADLINE", "Publication worker reached its bounded total deadline", true);
}

export function assertAuthorizedMergeParents({
  mergeSha,
  parentLine,
  authorizedBaseSha,
  authorizedHeadSha
}) {
  const parents = String(parentLine ?? "").trim().split(/\s+/);
  if (
    parents.length !== 3 ||
    parents[0] !== mergeSha ||
    parents[1] !== authorizedBaseSha ||
    parents[2] !== authorizedHeadSha
  ) {
    fail(
      "PUBLICATION_MERGE_PARENT_MISMATCH",
      "GitHub merge did not preserve the exact Owner-authorized base and head"
    );
  }
}

export function assertMergeAuthorityFresh(handoff, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN;
  const claimExpiresAt = Date.parse(handoff?.claimExpiresAt);
  const authorization = handoff?.productionAuthorization;
  const authorizedAt = Date.parse(authorization?.authorizedAt);
  const authorizationExpiresAt = Date.parse(authorization?.expiresAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(claimExpiresAt) || !Number.isFinite(authorizedAt) || !Number.isFinite(authorizationExpiresAt) || authorization?.revoked !== false || authorizedAt > nowMs || claimExpiresAt <= nowMs || authorizationExpiresAt <= nowMs) {
    fail("PUBLICATION_MERGE_AUTHORITY_EXPIRED", "Owner Production authorization or worker claim expired before merge");
  }
  return true;
}

export async function rebuildAuthorizedAssetManifest({ handoff, changedPaths, readAssetBytes }) {
  const expectedPaths = handoff.assets.map((asset) => `img/cases/${handoff.candidateId}/${asset.mediaId}.webp`);
  const changedAssetPaths = changedPaths.filter((entry) => entry.startsWith("img/cases/")).sort();
  if (JSON.stringify([...expectedPaths].sort()) !== JSON.stringify(changedAssetPaths)) {
    fail("PUBLICATION_COMMIT_CONTENT_MISMATCH", "Authorized commit asset paths differ from the Preview receipt");
  }
  return Promise.all(handoff.assets.map(async (asset, index) => {
    const assetPath = expectedPaths[index];
    const bytes = Buffer.from(await readAssetBytes(assetPath));
    if (bytes.byteLength > MAX_PUBLICATION_ASSET_BYTES) fail("PUBLICATION_COMMIT_CONTENT_MISMATCH", "Authorized sanitized asset exceeds the publication byte limit");
    let metadata;
    try { metadata = await sharp(bytes, { failOn: "error", limitInputPixels: 64_000_000 }).metadata(); }
    catch { fail("PUBLICATION_COMMIT_CONTENT_MISMATCH", "Authorized sanitized asset cannot be decoded"); }
    if (metadata.format !== "webp" || !Number.isInteger(metadata.width) || !Number.isInteger(metadata.height) || metadata.exif || metadata.icc || metadata.xmp || metadata.iptc) {
      fail("PUBLICATION_COMMIT_CONTENT_MISMATCH", "Authorized sanitized asset projection is invalid");
    }
    return { path: assetPath, sha256: sha256(bytes), width: metadata.width, height: metadata.height, altText: asset.altText };
  }));
}

export function normalizeChecks(rollup) {
  if (!Array.isArray(rollup) || rollup.length === 0) fail("PUBLICATION_CHECKS_PENDING", "PR checks have not started", true);
  const items = rollup.map((check) => {
    if (check.__typename === "StatusContext") {
      const conclusion = String(check.state ?? "").toLowerCase();
      if (conclusion === "pending" || conclusion === "expected") fail("PUBLICATION_CHECKS_PENDING", `${check.context} is pending`, true);
      if (conclusion !== "success") fail("PUBLICATION_CHECKS_FAILED", `${check.context} failed`);
      return { name: check.context, conclusion, required: true, detailsUrl: check.targetUrl || null };
    }
    if (check.status !== "COMPLETED") fail("PUBLICATION_CHECKS_PENDING", `${check.name} is pending`, true);
    const conclusion = String(check.conclusion ?? "").toLowerCase();
    if (!["success", "neutral", "skipped"].includes(conclusion)) fail("PUBLICATION_CHECKS_FAILED", `${check.name} failed`);
    return { name: check.name, conclusion, required: true, detailsUrl: check.detailsUrl || null };
  }).sort((left, right) => left.name.localeCompare(right.name));
  if (!items.some((entry) => entry.name === "Static site release gates" && entry.conclusion === "success")) fail("PUBLICATION_REQUIRED_CHECK_MISSING", "Static site release gate is missing");
  return { requiredStatus: "success", checksDigest: sha256(canonicalJson(items)), items };
}

async function waitForPrChecks(prNumber, expected, cwd) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    assertWithinWorkerDeadline();
    const view = ghJson(["pr", "view", String(prNumber), "--repo", CARKEY_REPOSITORY, "--json", "number,url,state,isDraft,baseRefName,baseRefOid,headRefName,headRefOid,files,statusCheckRollup"], cwd, "PUBLICATION_PR_VERIFY_FAILED");
    if (view.state !== "OPEN" || expected.allowReady !== true && view.isDraft !== true || view.baseRefName !== "main" || view.baseRefOid !== expected.baseSha || view.headRefOid !== expected.headSha || JSON.stringify(view.files.map((file) => file.path).sort()) !== JSON.stringify(expected.changedPaths)) fail("PUBLICATION_PR_BINDING_MISMATCH", "Draft PR differs from the exact generated commit");
    try { return { view, checks: normalizeChecks(view.statusCheckRollup) }; }
    catch (error) {
      if (!(error instanceof PublicationV2Error) || !error.retryable || attempt === POLL_ATTEMPTS - 1) throw error;
      await sleep(POLL_MS);
    }
  }
  fail("PUBLICATION_CHECKS_TIMEOUT", "PR checks timed out", true);
}

async function deploymentEvidence({ environment, sourceSha, cwd }) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    assertWithinWorkerDeadline();
    const deployments = ghJson(["api", `repos/${CARKEY_REPOSITORY}/deployments?sha=${sourceSha}&per_page=100`], cwd, "PUBLICATION_DEPLOYMENT_QUERY_FAILED");
    const statuses = new Map();
    for (const deployment of deployments.filter((entry) => entry.environment === environment && entry.sha === sourceSha)) {
      statuses.set(deployment.id, ghJson(["api", `repos/${CARKEY_REPOSITORY}/deployments/${deployment.id}/statuses?per_page=100`], cwd, "PUBLICATION_DEPLOYMENT_QUERY_FAILED"));
    }
    try { return selectExactDeployment(deployments, statuses, { environment, sourceSha }); }
    catch (error) {
      if (!(error instanceof PublicationV2Error) || !error.retryable || attempt === POLL_ATTEMPTS - 1) throw error;
      await sleep(POLL_MS);
    }
  }
  fail("PUBLICATION_DEPLOYMENT_TIMEOUT", "Deployment timed out", true);
}

function routeUrl(base, publicationPath) {
  return new URL(publicationPath, `${new URL(base).origin}/`).toString();
}

export async function verifyPublicResult({ baseUrl, generated, requireNoindex, fetchImpl = fetch }) {
  const pageResponse = await fetchImpl(routeUrl(baseUrl, generated.publicationPath), { redirect: "follow", cache: "no-store" });
  if (pageResponse.status !== 200) fail("PUBLICATION_PAGE_VERIFY_FAILED", `Publication page returned HTTP ${pageResponse.status}`, true);
  const html = await pageResponse.text();
  const schemas = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((match) => {
    try { return JSON.parse(match[1]); } catch { fail("PUBLICATION_SCHEMA_VERIFY_FAILED", "Published JSON-LD is not valid JSON", true); }
  });
  const types = new Set(schemas.flatMap((schema) => Array.isArray(schema) ? schema : [schema]).map((schema) => schema?.["@type"]));
  if (sha256(Buffer.from(html)) !== generated.contentSha256 || !html.includes(`<link rel="canonical" href="${generated.canonicalUrl}">`) || !["Article", "BreadcrumbList", "FAQPage"].every((type) => types.has(type))) fail("PUBLICATION_PAGE_VERIFY_FAILED", "Published HTML differs from the exact generated content", true);
  const noindex = /\bnoindex\b/i.test(pageResponse.headers.get("x-robots-tag") ?? "") || /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
  if (requireNoindex && !noindex) fail("PUBLICATION_PREVIEW_INDEXING_GUARD_MISSING", "Preview response is missing X-Robots-Tag: noindex");
  if (!requireNoindex && noindex) fail("PUBLICATION_PRODUCTION_NOINDEX", "Production page must remain indexable");
  const sitemap = await fetchImpl(new URL("/sitemap.xml", baseUrl), { redirect: "follow", cache: "no-store" });
  const sitemapText = sitemap.ok ? await sitemap.text() : "";
  const escapedCanonical = generated.canonicalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!sitemap.ok || (sitemapText.match(new RegExp(`<loc>${escapedCanonical}<\\/loc>`, "g")) ?? []).length !== 1) fail("PUBLICATION_SITEMAP_VERIFY_FAILED", "Sitemap must contain the exact canonical URL once", true);
  const blogResponse = await fetchImpl(new URL("/blog.json", baseUrl), { redirect: "follow", cache: "no-store" });
  const casesResponse = await fetchImpl(new URL("/cases.json", baseUrl), { redirect: "follow", cache: "no-store" });
  let blog;
  let cases;
  try { blog = await blogResponse.json(); cases = await casesResponse.json(); } catch { fail("PUBLICATION_REGISTRY_VERIFY_FAILED", "Published route registries are not valid JSON", true); }
  const firstAssetPath = generated.assetManifest[0]?.path;
  if (!blogResponse.ok || !casesResponse.ok || !Array.isArray(blog) || !Array.isArray(cases) || blog.filter((entry) => entry?.link === generated.publicationPath).length !== 1 || !firstAssetPath || cases.filter((entry) => entry?.img === `/${firstAssetPath}`).length !== 1) fail("PUBLICATION_REGISTRY_VERIFY_FAILED", "Published route registries do not contain the exact case once", true);
  for (const asset of generated.assetManifest) {
    const response = await fetchImpl(new URL(`/${asset.path}`, baseUrl), { redirect: "follow", cache: "no-store" });
    if (!response.ok) fail("PUBLICATION_ASSET_VERIFY_FAILED", `Published asset returned HTTP ${response.status}: ${asset.path}`, true);
    const bytes = await readBoundedResponseBytes(response);
    if (sha256(bytes) !== asset.sha256) fail("PUBLICATION_ASSET_VERIFY_FAILED", `Published asset differs: ${asset.path}`, true);
  }
  return { publicationPath: generated.publicationPath, canonicalUrl: generated.canonicalUrl, contentSha256: generated.contentSha256, assetManifestHash: generated.assetManifestHash, schemaTypes: generated.schemaTypes, sitemapIncluded: true, httpStatus: 200, ...(requireNoindex ? { noindexVerified: true } : {}) };
}

export async function verifyPreviewAccess({ deploymentUrl, generated, fetchImpl = fetch }) {
  const response = await fetchImpl(routeUrl(deploymentUrl, generated.publicationPath), { redirect: "manual", cache: "no-store" });
  if (response.status === 200) {
    const publicResult = await verifyPublicResult({ baseUrl: deploymentUrl, generated, requireNoindex: true, fetchImpl });
    return { accessMode: "anonymous_verified", publicResult };
  }
  const location = response.headers.get("location") ?? "";
  let authLocation = false;
  try {
    const host = new URL(location, deploymentUrl).hostname;
    authLocation = host === "vercel.com" || host.endsWith(".vercel.com") || /\b(?:sso|login|auth)\b/i.test(location);
  } catch {}
  const vercelEvidence = Boolean(response.headers.get("x-vercel-id")) || /vercel/i.test(response.headers.get("server") ?? "") || authLocation;
  if (![302, 401, 403].includes(response.status) || !vercelEvidence) fail("PUBLICATION_PREVIEW_ACCESS_INVALID", "Preview was neither exact anonymous content nor provably Vercel-protected");
  return { accessMode: "vercel_sso_protected", publicResult: { publicationPath: generated.publicationPath, canonicalUrl: generated.canonicalUrl, contentSha256: generated.contentSha256, assetManifestHash: generated.assetManifestHash, schemaTypes: generated.schemaTypes, sitemapIncluded: true, httpStatus: response.status, noindexVerified: false } };
}

async function verifyPublicResultWithRetry(options) {
  let lastError;
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    assertWithinWorkerDeadline();
    try { return await verifyPublicResult(options); }
    catch (error) {
      lastError = error;
      if (!(error instanceof PublicationV2Error) || !error.retryable || attempt === POLL_ATTEMPTS - 1) throw error;
      await sleep(POLL_MS);
    }
  }
  throw lastError;
}

async function verifyRollbackPublicState(publicationPath, canonicalUrl) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    assertWithinWorkerDeadline();
    const page = await fetch(routeUrl(CARKEY_ORIGIN, publicationPath), { redirect: "manual", cache: "no-store" });
    const sitemap = await fetch(new URL("/sitemap.xml", CARKEY_ORIGIN), { redirect: "follow", cache: "no-store" });
    const sitemapText = sitemap.ok ? await sitemap.text() : "";
    const occurrenceCount = sitemapText.split(`<loc>${canonicalUrl}</loc>`).length - 1;
    if (page.status === 404 && sitemap.ok && occurrenceCount === 0) return { routeHttpStatus: 404, sitemapOccurrenceCount: 0 };
    if (attempt === POLL_ATTEMPTS - 1) fail("PUBLICATION_ROLLBACK_VERIFY_FAILED", "Rollback route or sitemap did not restore the pre-publication state");
    await sleep(POLL_MS);
  }
}

async function rollbackMergedPublication({ handoff, mergeSha, canonicalRoot }) {
  const branch = `rollback/case-${handoff.candidateId.slice(4)}-job-${handoff.jobId.slice(4)}-from-${mergeSha.slice(0, 8)}`;
  const empty = { required: true, attempted: true, status: "manual_required", triggerMergeSha: mergeSha, revertPrNumber: null, revertPrUrl: null, revertHeadSha: null, rollbackMergeSha: null, productionGithubDeploymentId: null, verifiedAt: null, routeHttpStatus: null, sitemapOccurrenceCount: null, rollbackVerificationHash: null };
  try {
    run("git", ["fetch", "origin", "main", "--prune"], canonicalRoot, "PUBLICATION_ROLLBACK_FETCH_FAILED");
    let currentMain = run("git", ["rev-parse", "origin/main"], canonicalRoot);
    const existing = ghJson(["pr", "list", "--repo", CARKEY_REPOSITORY, "--head", branch, "--base", "main", "--state", "all", "--json", "number,url,state,isDraft,headRefOid,baseRefOid,mergeCommit,mergedAt"], canonicalRoot, "PUBLICATION_ROLLBACK_PR_QUERY_FAILED");
    if (existing.length > 1) fail("PUBLICATION_ROLLBACK_PR_CONFLICT", "Rollback branch has multiple PRs");
    let rollbackPr = existing[0] ?? null;
    let revertHeadSha = rollbackPr?.headRefOid ?? null;
    if (!rollbackPr) {
      if (currentMain !== mergeSha) fail("PUBLICATION_ROLLBACK_BASE_DRIFT", "Automatic rollback requires origin/main to remain the exact publication merge");
      const worktree = await prepareWorktree(canonicalRoot, mergeSha);
      try {
        run("git", ["switch", "-c", branch], worktree, "PUBLICATION_ROLLBACK_BRANCH_FAILED");
        try {
          execFileSync("git", ["-c", "user.name=CasePilot Rollback Worker", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "revert", "-m", "1", "--no-edit", mergeSha], { cwd: worktree, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: process.env });
        } catch { fail("PUBLICATION_ROLLBACK_REVERT_FAILED", "Unable to create the exact merge revert"); }
        revertHeadSha = run("git", ["rev-parse", "HEAD"], worktree);
        if (run("git", ["rev-parse", "HEAD^"], worktree) !== mergeSha || run("git", ["rev-parse", "HEAD^{tree}"], worktree) !== run("git", ["rev-parse", `${mergeSha}^1^{tree}`], worktree)) fail("PUBLICATION_ROLLBACK_TREE_INVALID", "Revert does not exactly restore the pre-publication tree");
        run("git", ["push", "origin", `HEAD:refs/heads/${branch}`], worktree, "PUBLICATION_ROLLBACK_PUSH_FAILED");
        const body = path.join(worktree, ".git-rollback-pr-body.md");
        await writeFile(body, `Automatic safety rollback for publication merge ${mergeSha}.\n\nThis exact revert restores the first-parent tree because post-merge publication verification failed.\n`);
        const url = run("gh", ["pr", "create", "--repo", CARKEY_REPOSITORY, "--draft", "--base", "main", "--head", branch, "--title", `Rollback publication ${handoff.candidateId}`, "--body-file", body], worktree, "PUBLICATION_ROLLBACK_PR_CREATE_FAILED");
        rollbackPr = { number: Number(new URL(url).pathname.split("/").at(-1)), url, state: "OPEN", isDraft: true, headRefOid: revertHeadSha, baseRefOid: mergeSha };
        run("gh", ["workflow", "run", "seo-validation.yml", "--repo", CARKEY_REPOSITORY, "--ref", branch], worktree, "PUBLICATION_ROLLBACK_CI_DISPATCH_FAILED");
      } finally {
        run("git", ["worktree", "remove", "--force", worktree], canonicalRoot, "PUBLICATION_WORKTREE_CLEANUP_FAILED");
        await rm(worktree, { recursive: true, force: true });
      }
    } else {
      run("git", ["fetch", "origin", `refs/heads/${branch}:refs/remotes/origin/${branch}`], canonicalRoot, "PUBLICATION_ROLLBACK_BRANCH_FETCH_FAILED");
      if (run("git", ["rev-parse", `${revertHeadSha}^`], canonicalRoot) !== mergeSha || run("git", ["rev-parse", `${revertHeadSha}^{tree}`], canonicalRoot) !== run("git", ["rev-parse", `${mergeSha}^1^{tree}`], canonicalRoot)) fail("PUBLICATION_ROLLBACK_TREE_INVALID", "Existing rollback branch is not the exact first-parent restore");
    }
    if (rollbackPr.state !== "MERGED") {
      currentMain = run("git", ["rev-parse", "origin/main"], canonicalRoot);
      if (currentMain !== mergeSha || rollbackPr.headRefOid !== revertHeadSha || rollbackPr.baseRefOid !== mergeSha) fail("PUBLICATION_ROLLBACK_PR_BINDING_INVALID", "Rollback PR differs from the exact revert and base");
      await waitForPrChecks(rollbackPr.number, { baseSha: mergeSha, headSha: revertHeadSha, changedPaths: handoff.previewReceipt.repository.changedPaths, allowReady: true }, canonicalRoot);
      if (rollbackPr.isDraft) run("gh", ["pr", "ready", String(rollbackPr.number), "--repo", CARKEY_REPOSITORY], canonicalRoot, "PUBLICATION_ROLLBACK_PR_READY_FAILED");
      run("gh", ["pr", "merge", String(rollbackPr.number), "--repo", CARKEY_REPOSITORY, "--merge", "--match-head-commit", revertHeadSha], canonicalRoot, "PUBLICATION_ROLLBACK_PR_MERGE_FAILED");
    }
    let mergedRollback;
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
      assertWithinWorkerDeadline();
      mergedRollback = ghJson(["pr", "view", String(rollbackPr.number), "--repo", CARKEY_REPOSITORY, "--json", "number,url,state,mergedAt,mergeCommit,headRefOid,baseRefOid"], canonicalRoot, "PUBLICATION_ROLLBACK_PR_QUERY_FAILED");
      if (mergedRollback.state === "MERGED" && mergedRollback.mergeCommit?.oid) break;
      if (attempt === POLL_ATTEMPTS - 1) fail("PUBLICATION_ROLLBACK_MERGE_TIMEOUT", "Rollback PR did not merge", true);
      await sleep(POLL_MS);
    }
    const rollbackMergeSha = mergedRollback.mergeCommit.oid;
    run("git", ["fetch", "origin", "main", "--prune"], canonicalRoot, "PUBLICATION_ROLLBACK_FETCH_FAILED");
    if (run("git", ["rev-parse", "origin/main"], canonicalRoot) !== rollbackMergeSha) fail("PUBLICATION_ROLLBACK_MAIN_DRIFT", "origin/main differs from the rollback merge");
    const deployment = await deploymentEvidence({ environment: PRODUCTION_ENVIRONMENT, sourceSha: rollbackMergeSha, cwd: canonicalRoot });
    const publicState = await verifyRollbackPublicState(handoff.previewReceipt.publicResult.publicationPath, handoff.previewReceipt.publicResult.canonicalUrl);
    const result = { required: true, attempted: true, status: "restored", triggerMergeSha: mergeSha, revertPrNumber: mergedRollback.number, revertPrUrl: mergedRollback.url, revertHeadSha, rollbackMergeSha, productionGithubDeploymentId: deployment.githubDeploymentId, verifiedAt: new Date().toISOString(), ...publicState, rollbackVerificationHash: "" };
    result.rollbackVerificationHash = blankFieldHash(result, "rollbackVerificationHash");
    return result;
  } catch {
    return empty;
  }
}

async function prepareWorktree(canonicalRoot, baseSha) {
  const root = await mkdtemp(path.join(os.tmpdir(), "carkey-publication-v2-"));
  run("git", ["worktree", "add", "--detach", root, baseSha], canonicalRoot, "PUBLICATION_WORKTREE_CREATE_FAILED");
  assertDisposableWorktree(root, canonicalRoot, baseSha);
  return root;
}

async function previewPhase({ handoff, origin, token, canonicalRoot }) {
  run("git", ["fetch", "origin", "main", "--prune"], canonicalRoot, "PUBLICATION_FETCH_FAILED");
  const baseSha = run("git", ["rev-parse", "origin/main"], canonicalRoot);
  const branch = publicationBranch(handoff);
  const remoteBranch = run("git", ["ls-remote", "--heads", "origin", branch], canonicalRoot);
  const worktree = await prepareWorktree(canonicalRoot, baseSha);
  try {
    const mediaById = await downloadApprovedAssets({ handoff, origin, token: await githubOidcToken() });
    const generated = await applyPreviewHandoff({ handoff, worktreeRoot: worktree, mediaById });
    run("git", ["switch", "-c", branch], worktree, "PUBLICATION_BRANCH_CREATE_FAILED");
    run("git", ["add", "--", ...generated.changedPaths], worktree, "PUBLICATION_STAGE_FAILED");
    const staged = run("git", ["diff", "--cached", "--name-only"], worktree).split("\n").filter(Boolean).sort();
    if (changedPathsHash(staged) !== generated.changedPathsHash) fail("PUBLICATION_STAGED_PATH_DRIFT", "Staged paths differ from generated paths");
    const stagedTreeSha = run("git", ["write-tree"], worktree, "PUBLICATION_TREE_FAILED");
    let headSha;
    let treeSha;
    let prUrl;
    let prNumber;
    if (remoteBranch) {
      headSha = remoteBranch.split(/\s+/)[0];
      run("git", ["fetch", "origin", `refs/heads/${branch}:refs/remotes/origin/${branch}`], worktree, "PUBLICATION_BRANCH_RESUME_FAILED");
      treeSha = run("git", ["rev-parse", `${headSha}^{tree}`], worktree);
      if (treeSha !== stagedTreeSha || run("git", ["rev-parse", `${headSha}^`], worktree) !== baseSha) fail("PUBLICATION_BRANCH_CONFLICT", "Existing publication branch differs from the exact approved tree or base");
      const prs = ghJson(["pr", "list", "--repo", CARKEY_REPOSITORY, "--head", branch, "--base", "main", "--state", "open", "--json", "number,url,state,isDraft,headRefOid,baseRefOid"], worktree, "PUBLICATION_PR_RESUME_FAILED");
      if (prs.length !== 1 || prs[0].isDraft !== true || prs[0].headRefOid !== headSha || prs[0].baseRefOid !== baseSha) fail("PUBLICATION_PR_RESUME_CONFLICT", "Existing branch has no unique exact Draft PR");
      prUrl = prs[0].url;
      prNumber = prs[0].number;
    } else {
      try {
        execFileSync("git", ["-c", "user.name=CasePilot Publication Worker", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "commit", "-m", `content: add approved case ${handoff.candidateId}`], { cwd: worktree, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_AUTHOR_DATE: `${handoff.website.datePublished}T00:00:00+08:00`, GIT_COMMITTER_DATE: `${handoff.website.datePublished}T00:00:00+08:00` } });
      } catch { fail("PUBLICATION_COMMIT_FAILED", "Unable to create deterministic publication commit"); }
      headSha = run("git", ["rev-parse", "HEAD"], worktree);
      treeSha = run("git", ["rev-parse", "HEAD^{tree}"], worktree);
      if (treeSha !== stagedTreeSha || run("git", ["rev-parse", "HEAD^"], worktree) !== baseSha) fail("PUBLICATION_COMMIT_PARENT_DRIFT", "Publication commit does not have the exact tree and main parent");
      run("git", ["push", "origin", `HEAD:refs/heads/${branch}`], worktree, "PUBLICATION_PUSH_FAILED");
    }
    const bodyPath = path.join(worktree, ".git-publication-pr-body.md");
    await writeFile(bodyPath, `CasePilot Owner-approved public-safe publication.\n\n- Candidate: ${handoff.candidateId}\n- Candidate hash: ${handoff.candidateHash}\n- Binding hash: ${handoff.bindingHash}\n- Base SHA: ${baseSha}\n- Head SHA: ${headSha}\n\nThis PR remains Draft until a second explicit Owner production authorization.\n`);
    if (!remoteBranch) {
      prUrl = run("gh", ["pr", "create", "--repo", CARKEY_REPOSITORY, "--draft", "--base", "main", "--head", branch, "--title", `Owner-approved case ${handoff.candidateId}`, "--body-file", bodyPath], worktree, "PUBLICATION_PR_CREATE_FAILED");
      prNumber = Number(new URL(prUrl).pathname.split("/").at(-1));
      run("gh", ["workflow", "run", "seo-validation.yml", "--repo", CARKEY_REPOSITORY, "--ref", branch], worktree, "PUBLICATION_CI_DISPATCH_FAILED");
    }
    const { view, checks: githubChecks } = await waitForPrChecks(prNumber, { baseSha, headSha, changedPaths: generated.changedPaths }, worktree);
    const localHeadCheck = { name: "casepilot-local-exact-head-preview", conclusion: "success", required: true, detailsUrl: null };
    const checkItems = [...githubChecks.items, localHeadCheck].sort((left, right) => left.name.localeCompare(right.name));
    const checks = { requiredStatus: "success", checksDigest: sha256(canonicalJson(checkItems)), items: checkItems };
    const previewDeployment = await deploymentEvidence({ environment: PREVIEW_ENVIRONMENT, sourceSha: headSha, cwd: worktree });
    const previewAccess = await verifyPreviewAccess({ deploymentUrl: previewDeployment.environmentUrl, generated });
    previewDeployment.accessMode = previewAccess.accessMode;
    const publicResult = previewAccess.publicResult;
    const receipt = createPreviewReceipt({ jobId: handoff.jobId, claimId: handoff.claimId, handoffHash: handoff.handoffHash, candidateHash: handoff.candidateHash, sourceHash: handoff.sourceHash, bindingHash: handoff.bindingHash, previewApprovalHash: handoff.previewApprovalHash, repository: { fullName: CARKEY_REPOSITORY, baseBranch: "main", baseSha, featureBranch: branch, headSha, treeSha, changedPaths: generated.changedPaths, changedPathsHash: generated.changedPathsHash }, pullRequest: { number: view.number, url: view.url, state: view.state, draft: view.isDraft, baseRef: view.baseRefName, baseSha: view.baseRefOid, headSha: view.headRefOid }, checks, previewDeployment, publicResult, previewVerificationHash: "", createdAt: new Date().toISOString() });
    try { await postReceipt({ phase: "preview", handoff, receipt, origin }); }
    catch (error) { error.suppressFailureReceipt = true; throw error; }
    return receipt;
  } finally {
    run("git", ["worktree", "remove", "--force", worktree], canonicalRoot, "PUBLICATION_WORKTREE_CLEANUP_FAILED");
    await rm(worktree, { recursive: true, force: true });
  }
}

async function productionPhase({ handoff, origin, token, canonicalRoot }) {
  const preview = handoff.previewReceipt;
  const auth = handoff.productionAuthorization;
  run("git", ["fetch", "origin", "main", "--prune"], canonicalRoot, "PUBLICATION_FETCH_FAILED");
  const currentMainSha = run("git", ["rev-parse", "origin/main"], canonicalRoot);
  const pr = ghJson(["pr", "view", String(preview.pullRequest.number), "--repo", CARKEY_REPOSITORY, "--json", "number,url,state,isDraft,baseRefName,baseRefOid,headRefOid,files,statusCheckRollup,mergedAt,mergeCommit"], canonicalRoot, "PUBLICATION_PR_VERIFY_FAILED");
  if (!["OPEN", "MERGED"].includes(pr.state) || pr.baseRefName !== "main" || pr.headRefOid !== auth.headSha || JSON.stringify(pr.files.map((file) => file.path).sort()) !== JSON.stringify(preview.repository.changedPaths)) fail("PUBLICATION_PR_BINDING_MISMATCH", "Authorized PR no longer matches the exact Preview");
  const previewDeployment = await deploymentEvidence({ environment: PREVIEW_ENVIRONMENT, sourceSha: auth.headSha, cwd: canonicalRoot });
  if (previewDeployment.githubDeploymentId !== auth.previewGithubDeploymentId || previewDeployment.environmentUrl !== auth.previewUrl) fail("PUBLICATION_PREVIEW_BINDING_MISMATCH", "Authorized Preview deployment changed");
  const priorDeployments = ghJson(["api", `repos/${CARKEY_REPOSITORY}/deployments?environment=${encodeURIComponent(PRODUCTION_ENVIRONMENT)}&per_page=100`], canonicalRoot, "PUBLICATION_DEPLOYMENT_QUERY_FAILED");
  let previousGithubDeploymentId = priorDeployments.find((entry) => entry.environment === PRODUCTION_ENVIRONMENT)?.id ?? null;
  let merged;
  const mainBeforeSha = preview.repository.baseSha;
  if (pr.state === "OPEN") {
    if (currentMainSha !== preview.repository.baseSha || currentMainSha !== auth.baseSha || pr.baseRefOid !== currentMainSha) fail("PUBLICATION_BASE_DRIFT", "main changed after Preview; a new Preview is required");
    normalizeChecks(pr.statusCheckRollup);
    assertMergeAuthorityFresh(handoff);
    if (pr.isDraft) run("gh", ["pr", "ready", String(pr.number), "--repo", CARKEY_REPOSITORY], canonicalRoot, "PUBLICATION_PR_READY_FAILED");
    assertMergeAuthorityFresh(handoff);
    run("gh", ["pr", "merge", String(pr.number), "--repo", CARKEY_REPOSITORY, "--merge", "--match-head-commit", auth.headSha], canonicalRoot, "PUBLICATION_PR_MERGE_FAILED");
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
      assertWithinWorkerDeadline();
      merged = ghJson(["pr", "view", String(pr.number), "--repo", CARKEY_REPOSITORY, "--json", "number,url,state,mergedAt,mergeCommit,headRefOid,baseRefName"], canonicalRoot, "PUBLICATION_PR_VERIFY_FAILED");
      if (merged.state === "MERGED" && merged.mergeCommit?.oid) break;
      if (attempt === POLL_ATTEMPTS - 1) fail("PUBLICATION_MERGE_TIMEOUT", "PR did not reach merged state", true);
      await sleep(POLL_MS);
    }
  } else {
    merged = pr;
    if (!merged.mergeCommit?.oid) fail("PUBLICATION_MERGED_RESUME_DRIFT", "Merged PR lacks its merge commit");
    if (currentMainSha !== merged.mergeCommit.oid) {
      const rollback = await rollbackMergedPublication({ handoff, mergeSha: merged.mergeCommit.oid, canonicalRoot });
      const error = new PublicationV2Error(rollback.status === "restored" ? "PUBLICATION_POST_MERGE_VERIFICATION_ROLLED_BACK" : "ROLLBACK_REQUIRED", "Publication was merged but is not the current main; rollback evidence was evaluated", false);
      error.rollback = rollback;
      error.stage = "post_merge";
      throw error;
    }
    previousGithubDeploymentId = priorDeployments.find((entry) => entry.environment === PRODUCTION_ENVIRONMENT && entry.sha !== merged.mergeCommit.oid)?.id ?? null;
  }
  const mergeSha = merged.mergeCommit.oid;
  try {
    run("git", ["fetch", "origin", "main", "--prune"], canonicalRoot, "PUBLICATION_FETCH_FAILED");
    const mainAfterSha = run("git", ["rev-parse", "origin/main"], canonicalRoot);
    if (mainAfterSha !== mergeSha) fail("PUBLICATION_MAIN_AFTER_DRIFT", "origin/main is not the exact merge commit");
    assertAuthorizedMergeParents({
      mergeSha,
      parentLine: run(
        "git",
        ["rev-list", "--parents", "-n", "1", mergeSha],
        canonicalRoot,
        "PUBLICATION_MERGE_PARENT_QUERY_FAILED"
      ),
      authorizedBaseSha: auth.baseSha,
      authorizedHeadSha: auth.headSha
    });
    const productionDeployment = await deploymentEvidence({ environment: PRODUCTION_ENVIRONMENT, sourceSha: mergeSha, cwd: canonicalRoot });
    const pagePath = `${preview.publicResult.publicationPath.slice(1)}.html`;
    const pageBytes = runBuffer("git", ["show", `${auth.headSha}:${pagePath}`], canonicalRoot, "PUBLICATION_COMMIT_CONTENT_MISSING");
    const assetManifest = await rebuildAuthorizedAssetManifest({
      handoff,
      changedPaths: preview.repository.changedPaths,
      readAssetBytes: (assetPath) => runBuffer("git", ["show", `${auth.headSha}:${assetPath}`], canonicalRoot, "PUBLICATION_COMMIT_CONTENT_MISSING")
    });
    const generated = { publicationPath: preview.publicResult.publicationPath, canonicalUrl: preview.publicResult.canonicalUrl, contentSha256: sha256(pageBytes), assetManifestHash: sha256(canonicalJson(assetManifest)), schemaTypes: preview.publicResult.schemaTypes, assetManifest };
    if (generated.contentSha256 !== preview.publicResult.contentSha256 || generated.assetManifestHash !== preview.publicResult.assetManifestHash || assetManifest.length === 0) fail("PUBLICATION_COMMIT_CONTENT_MISMATCH", "Authorized commit content differs from the Preview receipt");
    const deploymentAccess = await verifyPreviewAccess({ deploymentUrl: productionDeployment.environmentUrl, generated }).catch((error) => {
      if (error?.code === "PUBLICATION_PREVIEW_INDEXING_GUARD_MISSING") return { accessMode: "anonymous_verified" };
      throw error;
    });
    productionDeployment.accessMode = deploymentAccess.accessMode;
    const publicResult = await verifyPublicResultWithRetry({ baseUrl: CARKEY_ORIGIN, generated, requireNoindex: false });
    const receipt = createProductionReceipt({ jobId: handoff.jobId, claimId: handoff.claimId, handoffHash: handoff.handoffHash, candidateHash: handoff.candidateHash, sourceHash: handoff.sourceHash, bindingHash: handoff.bindingHash, previewReceiptHash: preview.receiptHash, authorizationHash: auth.authorizationHash, repository: { fullName: CARKEY_REPOSITORY, baseBranch: "main", mainBeforeSha, authorizedHeadSha: auth.headSha, mergeSha, mainAfterSha }, pullRequest: { number: merged.number, url: merged.url, mergedAt: new Date(merged.mergedAt).toISOString(), mergeMethod: "merge" }, productionDeployment, publicResult, productionVerificationHash: "", rollback: { mode: "revert_pr", automaticRollbackPerformed: false, previousGithubDeploymentId }, createdAt: new Date().toISOString() });
    await postReceipt({ phase: "production", handoff, receipt, origin });
    return receipt;
  } catch (cause) {
    const rollback = await rollbackMergedPublication({ handoff, mergeSha, canonicalRoot });
    const error = new PublicationV2Error(rollback.status === "restored" ? "PUBLICATION_POST_MERGE_VERIFICATION_ROLLED_BACK" : "ROLLBACK_REQUIRED", cause instanceof Error ? cause.message : "Post-merge verification failed", false);
    error.rollback = rollback;
    error.stage = "post_merge";
    throw error;
  }
}

export async function runPhase(phase) {
  const origin = originUrl(process.env.CASEPILOT_PUBLICATION_ORIGIN);
  if (process.env.GITHUB_REPOSITORY !== CARKEY_REPOSITORY || process.env.GITHUB_REF !== "refs/heads/main") fail("PUBLICATION_WORKFLOW_REF_INVALID", "Publication worker must run from the CarKey main workflow");
  const canonicalRoot = run("git", ["rev-parse", "--show-toplevel"], process.cwd());
  const token = await githubOidcToken();
  const handoff = await claimJob({ phase, origin, token });
  if (!handoff) return { phase, status: "idle" };
  try {
    const receipt = phase === "preview" ? await previewPhase({ handoff, origin, token, canonicalRoot }) : await productionPhase({ handoff, origin, token, canonicalRoot });
    return { phase, status: receipt.status, receiptHash: receipt.receiptHash };
  } catch (error) {
    const code = error instanceof PublicationV2Error ? error.code : "PUBLICATION_WORKER_FAILED";
    const retryable = error instanceof PublicationV2Error ? error.retryable : false;
    if (!error?.suppressFailureReceipt) {
      const receipt = createFailureReceipt({ phase, handoff, code, retryable, detail: error instanceof Error ? error.message : code, createdAt: new Date().toISOString(), rollback: error?.rollback, stage: error?.stage ?? "pre_merge" });
      await postReceipt({ phase, handoff, receipt, origin }).catch(() => undefined);
    }
    throw error;
  }
}

async function main() {
  const valueIndex = process.argv.indexOf("--phase");
  const requested = valueIndex >= 0 ? process.argv[valueIndex + 1] : null;
  if (!["preview", "production", "both"].includes(requested)) fail("PUBLICATION_USAGE", "Use --phase preview|production|both");
  const phases = requested === "both" ? ["preview", "production"] : [requested];
  for (const phase of phases) {
    const result = await runPhase(phase);
    process.stdout.write(`${canonicalJson(result)}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${canonicalJson({ status: "failed", code: error?.code ?? "PUBLICATION_WORKER_FAILED" })}\n`);
    process.exitCode = 1;
  });
}
