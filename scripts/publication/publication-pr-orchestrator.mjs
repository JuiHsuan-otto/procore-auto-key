import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  canonicalPromotionJson,
  computeActionReceiptHash,
  validatePromotionPlan,
  validatePublicationAction
} from "./publication-promotion.mjs";
import { assertDisposableWorktree } from "./publication-apply.mjs";

export const PR_RECEIPT_CONTRACT_VERSION = "1.0.0";
export const PR_RECEIPT_VERSION = "publication-pr-receipt/v1";
export const PR_RECEIPT_TYPE = "publication_pr";
export const CARKEY_REPOSITORY = "JuiHsuan-otto/procore-auto-key";

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const CANDIDATE_ID = /^cpc_[a-f0-9]{16}$/;
const ACTION_ID = /^pca_[a-f0-9]{16}$/;
const PUBLIC_RECORD_ID = /^pcr_[a-f0-9]{16}$/;
const PUBLICATION_BRANCH = /^publication\/synthetic-[a-z0-9-]+(?:-r[0-9]+)?$/;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;
const EVIDENCE_FILES = [
  ["action", "evidence/action.json"],
  ["plan", "evidence/promotion-plan.json"],
  ["applyReceipt", "evidence/apply-receipt.json"],
  ["commitEvidence", "evidence/commit-evidence.json"],
  ["prEvidence", "evidence/pr-evidence.json"],
  ["previewEvidence", "evidence/preview-evidence.json"]
];
const FORBIDDEN_KEYS = new Set([
  "api_key", "access_token", "oauth_token", "token", "secret", "password", "cookie",
  "session_id", "environment", "owner_email", "owner_subject", "customer_name",
  "customer_phone", "email", "phone", "address", "exact_address", "plate", "vin"
]);

export class PublicationPrError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PublicationPrError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new PublicationPrError(code, message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function canonicalize(value, seen = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("PR_RECEIPT_SCHEMA_INVALID", "Canonical JSON forbids non-finite numbers");
    return value;
  }
  if (typeof value !== "object" || seen.has(value)) fail("PR_RECEIPT_SCHEMA_INVALID", "Canonical JSON received a cycle or unsupported value");
  seen.add(value);
  const result = Array.isArray(value)
    ? value.map((entry) => canonicalize(entry, seen))
    : isPlainObject(value)
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key], seen)]))
      : fail("PR_RECEIPT_SCHEMA_INVALID", "Canonical JSON accepts plain objects only");
  seen.delete(value);
  return result;
}

export function canonicalPrJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function prSha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function changedPathDigest(paths) {
  const normalized = [...new Set(paths)].sort();
  if (!normalized.length || normalized.some((entry) => typeof entry !== "string" || !SAFE_PATH.test(entry))) fail("PR_CHANGED_PATH_INVALID", "Changed paths must be unique repository-relative paths");
  return prSha256(canonicalPrJson(normalized));
}

export function resolveVercelPreviewUrl(commentUrls, inspection) {
  const candidates = [
    ...[...(commentUrls ?? [])].reverse(),
    ...(inspection?.aliases ?? []),
    inspection?.url,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    const raw = candidate.startsWith("https://") ? candidate : `https://${candidate}`;
    try {
      const url = new URL(raw);
      if (url.protocol === "https:" && url.hostname.endsWith(".vercel.app") && url.pathname === "/") return url.toString().replace(/\/$/, "");
    } catch {
      // Try the next deployment-owned candidate.
    }
  }
  fail("PR_PREVIEW_BINDING_INVALID", "Preview URL is missing from Vercel evidence");
}

export function computePublicationPrReceiptHash(receipt) {
  const input = structuredClone(receipt);
  input.receipt_hash = "";
  input.package_hash = "";
  return prSha256(canonicalPrJson(input));
}

export function computePublicationPrPackageHash(receipt) {
  return prSha256(canonicalPrJson({ receipt_hash: receipt.receipt_hash, files: receipt.files }));
}

function assertIso(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail("PR_RECEIPT_SCHEMA_INVALID", `${label} must be a canonical timestamp`);
}

function assertPublicSafe(value, location = "receipt", depth = 0) {
  if (depth > 20) fail("PR_RECEIPT_PRIVATE_FIELD", "Evidence nesting exceeds the public-safe limit");
  if (Array.isArray(value)) return value.forEach((entry, index) => assertPublicSafe(entry, `${location}[${index}]`, depth + 1));
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) fail("PR_RECEIPT_PRIVATE_FIELD", `Forbidden key at ${location}.${key}`);
    assertPublicSafe(child, `${location}.${key}`, depth + 1);
  }
}

function run(command, args, cwd, code = "PR_ORCHESTRATION_GIT_INVALID") {
  try {
    return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const message = error?.stderr?.toString("utf8")?.trim();
    fail(code, message ? `${command} failed: ${message}` : `${command} failed`);
  }
}

function git(cwd, args, code) {
  return run("git", args, cwd, code);
}

async function boundedJson(file, code = "PR_RECEIPT_EVIDENCE_INVALID") {
  const info = await lstat(file).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink() || info.size < 2 || info.size > 2 * 1024 * 1024) fail(code, "Evidence must be a bounded regular JSON file");
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    fail(code, "Evidence JSON is invalid");
  }
}

async function collectFiles(root, relative = "") {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const child = path.posix.join(relative.split(path.sep).join(path.posix.sep), entry.name);
    if (entry.isSymbolicLink()) fail("PR_RECEIPT_PACKAGE_SYMLINK", "Receipt package cannot contain symlinks");
    if (entry.isDirectory()) output.push(...await collectFiles(root, child));
    else if (entry.isFile()) output.push(child);
    else fail("PR_RECEIPT_PACKAGE_INVALID", "Receipt package accepts regular files only");
  }
  return output.sort();
}

function worktreeChangedPaths(worktreeRoot, cached = false) {
  const args = cached
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACDMRTUXB"]
    : ["status", "--porcelain=v1", "--untracked-files=all"];
  let output;
  try {
    output = execFileSync("git", args, { cwd: worktreeRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    fail("PR_WORKTREE_STATE_INVALID", "Unable to inspect publication worktree paths");
  }
  return output ? output.split("\n").filter(Boolean).map((line) => cached ? line : line.slice(3)).sort() : [];
}

export function expectedPromotionPaths(plan) {
  validatePromotionPlan(plan);
  return [...new Set([
    ...plan.operations.files_to_add,
    ...plan.operations.files_to_modify,
    ...plan.operations.files_to_remove
  ])].sort();
}

export function choosePublicationBranch(preferred, occupied = []) {
  if (!PUBLICATION_BRANCH.test(preferred)) fail("PR_BRANCH_INVALID", "Publication branch name is outside policy");
  const used = new Set(occupied);
  if (!used.has(preferred)) return preferred;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${preferred}-r${index}`;
    if (!used.has(candidate)) return candidate;
  }
  fail("PR_BRANCH_COLLISION", "No collision-safe publication branch is available");
}

export function validateCommitEvidence(evidence, plan) {
  assertPublicSafe(evidence, "commit_evidence");
  const expectedPaths = expectedPromotionPaths(plan);
  if (!isPlainObject(evidence) || evidence.evidence_version !== "publication-commit-evidence/v1" || evidence.repository !== CARKEY_REPOSITORY || evidence.base_branch !== "main" || evidence.base_sha !== plan.expected_base_sha || !PUBLICATION_BRANCH.test(evidence.feature_branch) || !GIT_SHA.test(evidence.commit_sha) || !GIT_SHA.test(evidence.commit_tree_sha) || evidence.commit_parent_sha !== plan.expected_base_sha || JSON.stringify(evidence.changed_paths) !== JSON.stringify(expectedPaths) || evidence.changed_path_digest !== changedPathDigest(expectedPaths) || evidence.remote_branch_verified !== true) fail("PR_COMMIT_BINDING_INVALID", "Commit evidence does not bind the exact promotion plan");
  assertIso(evidence.committed_at, "commit_evidence.committed_at");
  assertIso(evidence.pushed_at, "commit_evidence.pushed_at");
  return evidence;
}

export function validatePrEvidence(evidence, plan, commitEvidence) {
  assertPublicSafe(evidence, "pr_evidence");
  const expectedPaths = expectedPromotionPaths(plan);
  if (!isPlainObject(evidence) || evidence.evidence_version !== "publication-pr-evidence/v1" || evidence.repository !== CARKEY_REPOSITORY || !Number.isInteger(evidence.number) || evidence.number < 1 || evidence.url !== `https://github.com/${CARKEY_REPOSITORY}/pull/${evidence.number}` || evidence.state !== "OPEN" || evidence.draft !== true || evidence.base_branch !== "main" || evidence.base_sha !== plan.expected_base_sha || evidence.head_branch !== commitEvidence.feature_branch || evidence.head_sha !== commitEvidence.commit_sha || JSON.stringify(evidence.changed_paths) !== JSON.stringify(expectedPaths) || evidence.changed_path_digest !== changedPathDigest(expectedPaths) || !SHA256.test(evidence.title_digest) || !SHA256.test(evidence.body_digest) || evidence.required_status !== "success" || !Array.isArray(evidence.checks) || !evidence.checks.length) fail("PR_DRAFT_BINDING_INVALID", "Draft PR evidence does not bind the commit and plan");
  assertIso(evidence.created_at, "pr_evidence.created_at");
  for (const check of evidence.checks) {
    if (!isPlainObject(check) || typeof check.name !== "string" || !check.name || !["success", "neutral", "skipped"].includes(check.status) || typeof check.required !== "boolean" || (check.url !== null && (typeof check.url !== "string" || !check.url.startsWith("https://")))) fail("PR_CHECKS_FAILED", "PR check evidence is incomplete or failed");
  }
  return evidence;
}

export function validatePreviewEvidence(evidence, commitEvidence) {
  assertPublicSafe(evidence, "preview_evidence");
  if (!isPlainObject(evidence) || evidence.evidence_version !== "publication-preview-evidence/v1" || !/^dpl_[A-Za-z0-9]+$/.test(evidence.deployment_id) || typeof evidence.url !== "string" || !evidence.url.startsWith("https://") || evidence.source_sha !== commitEvidence.commit_sha || evidence.state !== "READY" || evidence.target !== "preview" || evidence.http_status !== 200 || evidence.production_promoted !== false) fail("PR_PREVIEW_BINDING_INVALID", "Preview evidence is not READY on the publication commit");
  assertIso(evidence.verified_at, "preview_evidence.verified_at");
  return evidence;
}

export function validatePublicationPrReceipt(receipt) {
  assertPublicSafe(receipt);
  if (!isPlainObject(receipt) || receipt.contract_version !== PR_RECEIPT_CONTRACT_VERSION || receipt.receipt_version !== PR_RECEIPT_VERSION || receipt.receipt_type !== PR_RECEIPT_TYPE || receipt.source_system !== "carkey" || receipt.target_system !== "casepilot" || receipt.synthetic !== true || !CANDIDATE_ID.test(receipt.candidate_id) || !ACTION_ID.test(receipt.publication_action_id) || !SHA256.test(receipt.action_hash) || !SHA256.test(receipt.promotion_plan_hash) || !SHA256.test(receipt.apply_receipt_hash) || !PUBLIC_RECORD_ID.test(receipt.public_record_id) || !Number.isInteger(receipt.publication_revision) || receipt.publication_revision < 1 || receipt.publication_status !== "pr_created" || receipt.merged_sha !== null || receipt.production_deployment_id !== null || receipt.published_url !== null || receipt.published_at !== null || receipt.no_network_generation !== true || receipt.human_review_required !== true || !SHA256.test(receipt.receipt_hash) || !SHA256.test(receipt.package_hash)) fail("PR_RECEIPT_SCHEMA_INVALID", "Receipt identity or publication boundary is invalid");
  assertIso(receipt.created_at, "receipt.created_at");
  const repository = receipt.repository;
  if (!isPlainObject(repository) || repository.full_name !== CARKEY_REPOSITORY || repository.base_branch !== "main" || !GIT_SHA.test(repository.base_sha) || !PUBLICATION_BRANCH.test(repository.feature_branch) || !GIT_SHA.test(repository.commit_sha) || !GIT_SHA.test(repository.commit_tree_sha) || repository.commit_parent_sha !== repository.base_sha || !Array.isArray(repository.changed_paths) || repository.changed_path_digest !== changedPathDigest(repository.changed_paths)) fail("PR_RECEIPT_SCHEMA_INVALID", "Repository binding is invalid");
  const pr = receipt.pull_request;
  if (!isPlainObject(pr) || !Number.isInteger(pr.number) || pr.url !== `https://github.com/${CARKEY_REPOSITORY}/pull/${pr.number}` || pr.state !== "OPEN" || pr.draft !== true || pr.head_sha !== repository.commit_sha || pr.base_sha !== repository.base_sha || !SHA256.test(pr.title_digest) || !SHA256.test(pr.body_digest)) fail("PR_RECEIPT_SCHEMA_INVALID", "PR binding is invalid");
  assertIso(pr.created_at, "pull_request.created_at");
  if (!isPlainObject(receipt.checks) || receipt.checks.required_status !== "success" || !Array.isArray(receipt.checks.summary) || !receipt.checks.summary.length || receipt.checks.summary.some((check) => !["success", "neutral", "skipped"].includes(check.status))) fail("PR_CHECKS_FAILED", "Required checks are not successful");
  const preview = receipt.preview;
  if (!isPlainObject(preview) || !/^dpl_[A-Za-z0-9]+$/.test(preview.deployment_id) || typeof preview.url !== "string" || !preview.url.startsWith("https://") || preview.source_sha !== repository.commit_sha || preview.state !== "READY") fail("PR_PREVIEW_BINDING_INVALID", "Preview binding is invalid");
  if (!Array.isArray(receipt.files) || receipt.files.length !== EVIDENCE_FILES.length || receipt.files.some((file) => !isPlainObject(file) || !file.path.startsWith("evidence/") || !SHA256.test(file.sha256) || !Number.isInteger(file.byte_length) || file.byte_length < 1 || file.byte_length > 2 * 1024 * 1024 || file.mime !== "application/json")) fail("PR_RECEIPT_PACKAGE_INVALID", "Evidence file manifest is invalid");
  if (computePublicationPrReceiptHash(receipt) !== receipt.receipt_hash || computePublicationPrPackageHash(receipt) !== receipt.package_hash) fail("PR_RECEIPT_HASH_MISMATCH", "Receipt or package hash is invalid");
  return receipt;
}

export async function preparePublicationOrchestration({ action, plan, applyReceipt, worktreeRoot, canonicalRepositoryRoot, featureBranch }) {
  validatePublicationAction(action);
  validatePromotionPlan(plan);
  assertDisposableWorktree(worktreeRoot, plan.expected_base_sha, canonicalRepositoryRoot);
  const expectedPaths = expectedPromotionPaths(plan);
  const actualPaths = worktreeChangedPaths(worktreeRoot);
  if (action.action !== "publish" || action.synthetic !== true || action.action_id !== plan.action_id || action.action_hash !== plan.action_hash || computeActionReceiptHash(applyReceipt) !== applyReceipt.receipt_hash || applyReceipt.action_id !== action.action_id || applyReceipt.plan_hash !== plan.plan_hash || applyReceipt.carkey_base_sha !== plan.expected_base_sha || JSON.stringify(applyReceipt.resulting_changed_paths) !== JSON.stringify(expectedPaths) || JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths) || !PUBLICATION_BRANCH.test(featureBranch)) fail("PR_PREPARE_BINDING_INVALID", "Applied worktree does not match the approved synthetic publish plan");
  return { status: "prepared", action_id: action.action_id, plan_hash: plan.plan_hash, base_sha: plan.expected_base_sha, feature_branch: featureBranch, changed_paths: expectedPaths, changed_path_digest: changedPathDigest(expectedPaths), network_used: false };
}

export function stagePublicationChangesSync({ plan, worktreeRoot, canonicalRepositoryRoot, featureBranch }) {
  validatePromotionPlan(plan);
  assertDisposableWorktree(worktreeRoot, plan.expected_base_sha, canonicalRepositoryRoot);
  if (!PUBLICATION_BRANCH.test(featureBranch)) fail("PR_BRANCH_INVALID", "Publication branch is outside policy");
  const occupied = git(canonicalRepositoryRoot, ["for-each-ref", "--format=%(refname:short)", "refs/heads"], "PR_WORKTREE_STATE_INVALID").split("\n").filter(Boolean);
  if (occupied.includes(featureBranch)) fail("PR_BRANCH_COLLISION", "Publication branch already exists locally");
  git(worktreeRoot, ["switch", "-c", featureBranch], "PR_BRANCH_CREATE_FAILED");
  const expected = expectedPromotionPaths(plan);
  git(worktreeRoot, ["add", "--", ...expected], "PR_EXACT_STAGE_FAILED");
  const staged = worktreeChangedPaths(worktreeRoot, true);
  if (JSON.stringify(staged) !== JSON.stringify(expected)) fail("PR_EXACT_STAGE_FAILED", "Staged paths differ from the promotion plan");
  const status = git(worktreeRoot, ["status", "--porcelain=v1", "--untracked-files=all"], "PR_WORKTREE_STATE_INVALID").split("\n").filter(Boolean);
  if (status.some((line) => line[1] !== " ")) fail("PR_EXACT_STAGE_FAILED", "Unstaged or untracked work remains after exact staging");
  return { status: "staged", feature_branch: featureBranch, changed_paths: staged, changed_path_digest: changedPathDigest(staged), network_used: false };
}

export function commitPublicationChanges({ plan, worktreeRoot, featureBranch, committedAt }) {
  assertIso(committedAt, "committed_at");
  const expected = expectedPromotionPaths(plan);
  if (git(worktreeRoot, ["branch", "--show-current"], "PR_WORKTREE_STATE_INVALID") !== featureBranch || JSON.stringify(worktreeChangedPaths(worktreeRoot, true)) !== JSON.stringify(expected)) fail("PR_COMMIT_BINDING_INVALID", "Publication branch or staged paths drifted before commit");
  const actionId = plan.action_id;
  const candidateId = plan.candidate_id;
  const body = `Synthetic demonstration\nGenerated from approved publication action\nRequires Owner review\nNot Production-approved\nAction-ID: ${actionId}\nCandidate-ID: ${candidateId}`;
  git(worktreeRoot, ["commit", "-m", "feat(case): add synthetic publication workflow case", "-m", body], "PR_COMMIT_FAILED");
  const commitSha = git(worktreeRoot, ["rev-parse", "HEAD"], "PR_COMMIT_BINDING_INVALID");
  const treeSha = git(worktreeRoot, ["rev-parse", "HEAD^{tree}"], "PR_COMMIT_BINDING_INVALID");
  const parentSha = git(worktreeRoot, ["rev-parse", "HEAD^"], "PR_COMMIT_BINDING_INVALID");
  const committedPaths = git(worktreeRoot, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], "PR_COMMIT_BINDING_INVALID").split("\n").filter(Boolean).sort();
  if (parentSha !== plan.expected_base_sha || JSON.stringify(committedPaths) !== JSON.stringify(expected) || git(worktreeRoot, ["status", "--porcelain"], "PR_WORKTREE_STATE_INVALID") !== "") fail("PR_COMMIT_BINDING_INVALID", "Publication commit is not a clean single-plan commit");
  return {
    evidence_version: "publication-commit-evidence/v1",
    repository: CARKEY_REPOSITORY,
    base_branch: "main",
    base_sha: plan.expected_base_sha,
    feature_branch: featureBranch,
    commit_sha: commitSha,
    commit_tree_sha: treeSha,
    commit_parent_sha: parentSha,
    changed_paths: committedPaths,
    changed_path_digest: changedPathDigest(committedPaths),
    remote_branch_verified: false,
    committed_at: committedAt,
    pushed_at: null
  };
}

export function pushPublicationBranch({ worktreeRoot, commitEvidence, pushedAt }) {
  assertIso(pushedAt, "pushed_at");
  git(worktreeRoot, ["push", "-u", "origin", commitEvidence.feature_branch], "PR_PUSH_FAILED");
  const remote = git(worktreeRoot, ["ls-remote", "--heads", "origin", commitEvidence.feature_branch], "PR_REMOTE_BRANCH_INVALID");
  const remoteSha = remote.split(/\s+/)[0];
  if (remoteSha !== commitEvidence.commit_sha) fail("PR_REMOTE_BRANCH_INVALID", "Remote publication branch differs from the local commit");
  return { ...structuredClone(commitEvidence), remote_branch_verified: true, pushed_at: pushedAt };
}

export async function writeCanonicalJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${canonicalPrJson(value)}\n`, "utf8");
}

export async function emitPublicationPrReceiptPackage({ action, plan, applyReceipt, commitEvidence, prEvidence, previewEvidence, outputDirectory, createdAt }) {
  validatePublicationAction(action);
  validatePromotionPlan(plan);
  if (computeActionReceiptHash(applyReceipt) !== applyReceipt.receipt_hash || applyReceipt.action_id !== action.action_id || applyReceipt.plan_hash !== plan.plan_hash || applyReceipt.resulting_commit !== commitEvidence.commit_sha) fail("PR_APPLY_RECEIPT_INVALID", "Apply receipt does not bind the publication commit");
  validateCommitEvidence(commitEvidence, plan);
  validatePrEvidence(prEvidence, plan, commitEvidence);
  validatePreviewEvidence(previewEvidence, commitEvidence);
  assertIso(createdAt, "receipt.created_at");
  if (existsSync(outputDirectory)) {
    const existing = await collectFiles(outputDirectory);
    if (existing.length) fail("PR_RECEIPT_OUTPUT_CONFLICT", "Receipt output directory is not empty");
  }
  await mkdir(path.join(outputDirectory, "evidence"), { recursive: true });
  const inputs = { action, plan, applyReceipt, commitEvidence, prEvidence, previewEvidence };
  const files = [];
  for (const [key, relative] of EVIDENCE_FILES) {
    const bytes = Buffer.from(`${canonicalPrJson(inputs[key])}\n`, "utf8");
    await writeFile(path.join(outputDirectory, relative), bytes, { flag: "wx" });
    files.push({ path: relative, sha256: prSha256(bytes), byte_length: bytes.byteLength, mime: "application/json" });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  const receipt = {
    contract_version: PR_RECEIPT_CONTRACT_VERSION,
    receipt_version: PR_RECEIPT_VERSION,
    receipt_type: PR_RECEIPT_TYPE,
    source_system: "carkey",
    target_system: "casepilot",
    synthetic: true,
    candidate_id: action.candidate_id,
    publication_action_id: action.action_id,
    action_hash: action.action_hash,
    promotion_plan_hash: plan.plan_hash,
    apply_receipt_hash: applyReceipt.receipt_hash,
    public_record_id: action.public_record_id,
    publication_revision: action.action_revision,
    repository: {
      full_name: commitEvidence.repository,
      base_branch: commitEvidence.base_branch,
      base_sha: commitEvidence.base_sha,
      feature_branch: commitEvidence.feature_branch,
      commit_sha: commitEvidence.commit_sha,
      commit_tree_sha: commitEvidence.commit_tree_sha,
      commit_parent_sha: commitEvidence.commit_parent_sha,
      changed_paths: commitEvidence.changed_paths,
      changed_path_digest: commitEvidence.changed_path_digest
    },
    pull_request: {
      number: prEvidence.number,
      url: prEvidence.url,
      state: prEvidence.state,
      draft: prEvidence.draft,
      head_sha: prEvidence.head_sha,
      base_sha: prEvidence.base_sha,
      created_at: prEvidence.created_at,
      title_digest: prEvidence.title_digest,
      body_digest: prEvidence.body_digest
    },
    checks: { summary: prEvidence.checks, required_status: prEvidence.required_status },
    preview: {
      deployment_id: previewEvidence.deployment_id,
      url: previewEvidence.url,
      source_sha: previewEvidence.source_sha,
      state: previewEvidence.state
    },
    publication_status: "pr_created",
    merged_sha: null,
    production_deployment_id: null,
    published_url: null,
    published_at: null,
    files,
    receipt_hash: "",
    package_hash: "",
    created_at: createdAt,
    no_network_generation: true,
    human_review_required: true
  };
  receipt.receipt_hash = computePublicationPrReceiptHash(receipt);
  receipt.package_hash = computePublicationPrPackageHash(receipt);
  validatePublicationPrReceipt(receipt);
  await writeFile(path.join(outputDirectory, "publication-pr-receipt.json"), `${canonicalPrJson(receipt)}\n`, { flag: "wx" });
  return receipt;
}

export async function verifyPublicationPrReceiptPackage(outputDirectory) {
  const receipt = await boundedJson(path.join(outputDirectory, "publication-pr-receipt.json"));
  validatePublicationPrReceipt(receipt);
  const expected = ["publication-pr-receipt.json", ...receipt.files.map((file) => file.path)].sort();
  const actual = await collectFiles(outputDirectory);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail("PR_RECEIPT_PACKAGE_INVALID", "Receipt package layout differs from the manifest");
  for (const file of receipt.files) {
    const info = await lstat(path.join(outputDirectory, file.path));
    const bytes = await readFile(path.join(outputDirectory, file.path));
    if (!info.isFile() || info.isSymbolicLink() || info.size !== file.byte_length || prSha256(bytes) !== file.sha256) fail("PR_RECEIPT_PACKAGE_HASH_MISMATCH", `Evidence file drift: ${file.path}`);
  }
  return receipt;
}
