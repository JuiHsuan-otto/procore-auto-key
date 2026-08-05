#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { verifyPublicationActionPackage } from "./publication-promotion.mjs";
import { finalizeApplyReceiptCommit } from "./publication-apply.mjs";
import {
  CARKEY_REPOSITORY,
  PublicationPrError,
  changedPathDigest,
  commitPublicationChanges,
  emitPublicationPrReceiptPackage,
  expectedPromotionPaths,
  prSha256,
  preparePublicationOrchestration,
  pushPublicationBranch,
  resolveVercelPreviewUrl,
  stagePublicationChangesSync,
  validateCommitEvidence,
  validatePrEvidence,
  validatePreviewEvidence,
  verifyPublicationPrReceiptPackage,
  writeCanonicalJson
} from "./publication-pr-orchestrator.mjs";

function valueFor(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function run(command, args, cwd = process.cwd(), code = "PR_EXTERNAL_COMMAND_FAILED") {
  try {
    return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const message = error?.stderr?.toString("utf8")?.trim();
    throw new PublicationPrError(code, message ? `${command} failed: ${message}` : `${command} failed`);
  }
}

async function boundedJson(file) {
  const info = await lstat(file).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink() || info.size < 2 || info.size > 2 * 1024 * 1024) throw new PublicationPrError("PR_EVIDENCE_INVALID", "Input must be a bounded regular JSON file");
  return JSON.parse(await readFile(file, "utf8"));
}

function required(flag) {
  const value = valueFor(flag);
  if (!value) throw new PublicationPrError("PR_USAGE", `Missing ${flag}`);
  return value;
}

function normalizedChecks(rollup) {
  if (!Array.isArray(rollup) || !rollup.length) throw new PublicationPrError("PR_CHECKS_PENDING", "PR checks have not started");
  return rollup.map((check) => {
    if (check.__typename === "StatusContext") {
      if (check.state !== "SUCCESS") throw new PublicationPrError(check.state === "PENDING" ? "PR_CHECKS_PENDING" : "PR_CHECKS_FAILED", `${check.context} is ${check.state}`);
      return { name: check.context, status: "success", required: true, url: check.targetUrl || null };
    }
    if (check.status !== "COMPLETED") throw new PublicationPrError("PR_CHECKS_PENDING", `${check.name} is ${check.status}`);
    const conclusion = String(check.conclusion ?? "").toLowerCase();
    if (!["success", "neutral", "skipped"].includes(conclusion)) throw new PublicationPrError("PR_CHECKS_FAILED", `${check.name} concluded ${check.conclusion}`);
    return { name: check.name, status: conclusion, required: true, url: check.detailsUrl || null };
  }).sort((left, right) => left.name.localeCompare(right.name));
}

async function createDraftPr({ plan, commitEvidence, bodyFile, output }) {
  validateCommitEvidence(commitEvidence, plan);
  const title = "Synthetic review: publication workflow case";
  const body = await readFile(bodyFile, "utf8");
  const url = run("gh", ["pr", "create", "--repo", CARKEY_REPOSITORY, "--draft", "--base", "main", "--head", commitEvidence.feature_branch, "--title", title, "--body-file", bodyFile], process.cwd(), "PR_CREATE_FAILED");
  const view = JSON.parse(run("gh", ["pr", "view", url, "--repo", CARKEY_REPOSITORY, "--json", "number,url,title,body,state,isDraft,createdAt,baseRefName,baseRefOid,headRefName,headRefOid,files"], process.cwd(), "PR_VERIFY_FAILED"));
  const changedPaths = view.files.map((file) => file.path).sort();
  const expectedPaths = expectedPromotionPaths(plan);
  if (view.url !== url || view.title !== title || view.state !== "OPEN" || view.isDraft !== true || view.baseRefName !== "main" || view.baseRefOid !== plan.expected_base_sha || view.headRefName !== commitEvidence.feature_branch || view.headRefOid !== commitEvidence.commit_sha || JSON.stringify(changedPaths) !== JSON.stringify(expectedPaths) || prSha256(view.body) !== prSha256(body)) throw new PublicationPrError("PR_DRAFT_BINDING_INVALID", "Created Draft PR differs from the approved commit/body");
  const evidence = {
    evidence_version: "publication-pr-evidence/v1",
    repository: CARKEY_REPOSITORY,
    number: view.number,
    url: view.url,
    state: view.state,
    draft: view.isDraft,
    base_branch: view.baseRefName,
    base_sha: view.baseRefOid,
    head_branch: view.headRefName,
    head_sha: view.headRefOid,
    created_at: new Date(view.createdAt).toISOString(),
    title_digest: prSha256(view.title),
    body_digest: prSha256(view.body),
    changed_paths: changedPaths,
    changed_path_digest: changedPathDigest(changedPaths),
    checks: [],
    required_status: "pending"
  };
  await writeCanonicalJson(output, evidence);
  return evidence;
}

async function verifyDraftPr({ plan, commitEvidence, prEvidence, prOutput, previewOutput, verifiedAt }) {
  const view = JSON.parse(run("gh", ["pr", "view", String(prEvidence.number), "--repo", CARKEY_REPOSITORY, "--json", "number,url,title,body,state,isDraft,createdAt,baseRefName,baseRefOid,headRefName,headRefOid,files,statusCheckRollup"], process.cwd(), "PR_VERIFY_FAILED"));
  const checks = normalizedChecks(view.statusCheckRollup);
  const changedPaths = view.files.map((file) => file.path).sort();
  const updated = {
    ...structuredClone(prEvidence),
    state: view.state,
    draft: view.isDraft,
    base_sha: view.baseRefOid,
    head_sha: view.headRefOid,
    title_digest: prSha256(view.title),
    body_digest: prSha256(view.body),
    changed_paths: changedPaths,
    changed_path_digest: changedPathDigest(changedPaths),
    checks,
    required_status: "success"
  };
  validatePrEvidence(updated, plan, commitEvidence);
  const vercelCheck = checks.find((check) => check.name === "Vercel");
  if (!vercelCheck?.url) throw new PublicationPrError("PR_PREVIEW_BINDING_INVALID", "Vercel check is missing");
  const rawId = new URL(vercelCheck.url).pathname.split("/").filter(Boolean).at(-1);
  const deploymentId = rawId.startsWith("dpl_") ? rawId : `dpl_${rawId}`;
  const comments = JSON.parse(run("gh", ["api", `repos/${CARKEY_REPOSITORY}/issues/${view.number}/comments`], process.cwd(), "PR_PREVIEW_BINDING_INVALID"));
  const previewUrls = comments.flatMap((comment) => [...String(comment.body ?? "").matchAll(/\[Preview\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1]));
  const inspection = JSON.parse(run("vercel", ["inspect", deploymentId, "--json"], process.cwd(), "PR_PREVIEW_BINDING_INVALID"));
  const previewUrl = resolveVercelPreviewUrl(previewUrls, inspection);
  const httpStatus = Number(run("curl", ["-L", "--max-time", "30", "--silent", "--show-error", "--output", "/dev/null", "--write-out", "%{http_code}", previewUrl], process.cwd(), "PR_PREVIEW_HTTP_FAILED"));
  const preview = {
    evidence_version: "publication-preview-evidence/v1",
    deployment_id: inspection.id,
    url: previewUrl,
    source_sha: commitEvidence.commit_sha,
    state: inspection.readyState,
    target: inspection.target,
    http_status: httpStatus,
    production_promoted: false,
    verified_at: verifiedAt
  };
  validatePreviewEvidence(preview, commitEvidence);
  await writeCanonicalJson(prOutput, updated);
  await writeCanonicalJson(previewOutput, preview);
  return { pr: updated, preview };
}

const mode = valueFor("--mode");

try {
  if (mode === "prepare") {
    const featureBranch = required("--branch");
    const localBranches = run("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads"], process.cwd(), "PR_WORKTREE_STATE_INVALID").split("\n").filter(Boolean);
    const remoteBranch = run("git", ["ls-remote", "--heads", "origin", featureBranch], process.cwd(), "PR_REMOTE_BRANCH_INVALID");
    if (localBranches.includes(featureBranch) || remoteBranch) throw new PublicationPrError("PR_BRANCH_COLLISION", "Publication branch already exists locally or remotely");
    const verified = await verifyPublicationActionPackage(path.resolve(required("--action-package")));
    const plan = await boundedJson(path.resolve(required("--plan")));
    const applyReceipt = await boundedJson(path.resolve(required("--apply-receipt")));
    const result = await preparePublicationOrchestration({ action: verified.action, plan, applyReceipt, worktreeRoot: path.resolve(required("--worktree")), canonicalRepositoryRoot: process.cwd(), featureBranch });
    console.log(JSON.stringify(result));
  } else if (mode === "stage") {
    const plan = await boundedJson(path.resolve(required("--plan")));
    console.log(JSON.stringify(stagePublicationChangesSync({ plan, worktreeRoot: path.resolve(required("--worktree")), canonicalRepositoryRoot: process.cwd(), featureBranch: required("--branch") })));
  } else if (mode === "commit") {
    const plan = await boundedJson(path.resolve(required("--plan")));
    const evidence = commitPublicationChanges({ plan, worktreeRoot: path.resolve(required("--worktree")), featureBranch: required("--branch"), committedAt: required("--timestamp") });
    await writeCanonicalJson(path.resolve(required("--output")), evidence);
    console.log(JSON.stringify({ status: "committed", commit_sha: evidence.commit_sha, changed_path_digest: evidence.changed_path_digest }));
  } else if (mode === "push") {
    const evidence = await boundedJson(path.resolve(required("--commit-evidence")));
    const pushed = pushPublicationBranch({ worktreeRoot: path.resolve(required("--worktree")), commitEvidence: evidence, pushedAt: required("--timestamp") });
    await writeCanonicalJson(path.resolve(required("--output")), pushed);
    console.log(JSON.stringify({ status: "pushed", commit_sha: pushed.commit_sha, feature_branch: pushed.feature_branch, remote_verified: true }));
  } else if (mode === "finalize-apply-receipt") {
    const receipt = await finalizeApplyReceiptCommit(path.resolve(required("--apply-receipt")), required("--commit"));
    console.log(JSON.stringify({ status: "finalized", receipt_hash: receipt.receipt_hash, resulting_commit: receipt.resulting_commit, network_used: false }));
  } else if (mode === "create-draft-pr") {
    const plan = await boundedJson(path.resolve(required("--plan")));
    const commitEvidence = await boundedJson(path.resolve(required("--commit-evidence")));
    const evidence = await createDraftPr({ plan, commitEvidence, bodyFile: path.resolve(required("--body-file")), output: path.resolve(required("--output")) });
    console.log(JSON.stringify({ status: "pr_created", pr_number: evidence.number, pr_url: evidence.url, draft: evidence.draft }));
  } else if (mode === "verify-pr") {
    const result = await verifyDraftPr({ plan: await boundedJson(path.resolve(required("--plan"))), commitEvidence: await boundedJson(path.resolve(required("--commit-evidence"))), prEvidence: await boundedJson(path.resolve(required("--pr-evidence"))), prOutput: path.resolve(required("--pr-output")), previewOutput: path.resolve(required("--preview-output")), verifiedAt: required("--timestamp") });
    console.log(JSON.stringify({ status: "verified", pr_number: result.pr.number, checks: result.pr.required_status, preview: result.preview.state, preview_source_sha: result.preview.source_sha }));
  } else if (mode === "emit-receipt") {
    const action = await boundedJson(path.resolve(required("--action")));
    const plan = await boundedJson(path.resolve(required("--plan")));
    const applyReceipt = await boundedJson(path.resolve(required("--apply-receipt")));
    const commitEvidence = await boundedJson(path.resolve(required("--commit-evidence")));
    const prEvidence = await boundedJson(path.resolve(required("--pr-evidence")));
    const previewEvidence = await boundedJson(path.resolve(required("--preview-evidence")));
    const receipt = await emitPublicationPrReceiptPackage({ action, plan, applyReceipt, commitEvidence, prEvidence, previewEvidence, outputDirectory: path.resolve(required("--output")), createdAt: required("--timestamp") });
    console.log(JSON.stringify({ status: "emitted", receipt_hash: receipt.receipt_hash, package_hash: receipt.package_hash, publication_status: receipt.publication_status, network_used: false }));
  } else if (mode === "verify-receipt") {
    const receipt = await verifyPublicationPrReceiptPackage(path.resolve(required("--package")));
    console.log(JSON.stringify({ status: "verified", receipt_hash: receipt.receipt_hash, package_hash: receipt.package_hash, publication_status: receipt.publication_status, network_used: false }));
  } else {
    throw new PublicationPrError("PR_USAGE", "Use --mode prepare|stage|commit|push|finalize-apply-receipt|create-draft-pr|verify-pr|emit-receipt|verify-receipt");
  }
} catch (error) {
  if (error instanceof PublicationPrError || typeof error?.code === "string") {
    console.error(JSON.stringify({ status: "rejected", code: error.code ?? "PR_ORCHESTRATION_FAILED" }));
    process.exit(1);
  }
  throw error;
}
