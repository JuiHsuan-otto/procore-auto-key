import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { importPublicationPackage } from "./publication-import.mjs";
import {
  computeActionReceiptHash,
  preparePromotionPlan,
  verifyPublicationActionPackage
} from "./publication-promotion.mjs";
import {
  PublicationPrError,
  changedPathDigest,
  choosePublicationBranch,
  commitPublicationChanges,
  computePublicationPrReceiptHash,
  emitPublicationPrReceiptPackage,
  expectedPromotionPaths,
  preparePublicationOrchestration,
  resolveVercelPreviewUrl,
  selectVercelDeploymentCheck,
  stagePublicationChangesSync,
  validateCommitEvidence,
  validatePrEvidence,
  verifyPublicationPrReceiptPackage
} from "./publication-pr-orchestrator.mjs";

const repositoryRoot = path.resolve(".");
const actionPackage = path.resolve("tests/fixtures/publication-action/valid-package");

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "carkey-pr-orchestrator-"));
  const verified = await verifyPublicationActionPackage(actionPackage);
  const imported = await importPublicationPackage({ packageDirectory: verified.candidatePackageDirectory, repositoryRoot, draftRoot: path.join(root, "drafts") });
  const plan = await preparePromotionPlan({ action: verified.action, draftDirectory: imported.candidateDirectory, repositoryRoot, currentBaseSha: verified.action.expected_carkey_base_sha });
  const commitSha = "1".repeat(40);
  const paths = expectedPromotionPaths(plan);
  const applyReceipt = structuredClone(plan.receipt_template);
  Object.assign(applyReceipt, {
    state: "applied_local",
    resulting_changed_paths: paths,
    resulting_public_content_hash: "2".repeat(64),
    validation_results: [{ id: "synthetic_test", status: "pass" }],
    result: "created",
    resulting_commit: commitSha,
    applied_at: "2026-08-05T01:30:00.000Z",
    verified_at: "2026-08-05T01:30:00.000Z"
  });
  applyReceipt.receipt_hash = "";
  applyReceipt.receipt_hash = computeActionReceiptHash(applyReceipt);
  const commitEvidence = {
    evidence_version: "publication-commit-evidence/v1",
    repository: "JuiHsuan-otto/procore-auto-key",
    base_branch: "main",
    base_sha: plan.expected_base_sha,
    feature_branch: "publication/synthetic-cpc-6027337da976411c-r99",
    commit_sha: commitSha,
    commit_tree_sha: "3".repeat(40),
    commit_parent_sha: plan.expected_base_sha,
    changed_paths: paths,
    changed_path_digest: changedPathDigest(paths),
    remote_branch_verified: true,
    committed_at: "2026-08-05T01:30:00.000Z",
    pushed_at: "2026-08-05T01:31:00.000Z"
  };
  const prEvidence = {
    evidence_version: "publication-pr-evidence/v1",
    repository: "JuiHsuan-otto/procore-auto-key",
    number: 99,
    url: "https://github.com/JuiHsuan-otto/procore-auto-key/pull/99",
    state: "OPEN",
    draft: true,
    base_branch: "main",
    base_sha: plan.expected_base_sha,
    head_branch: commitEvidence.feature_branch,
    head_sha: commitSha,
    created_at: "2026-08-05T01:32:00.000Z",
    title_digest: "4".repeat(64),
    body_digest: "5".repeat(64),
    changed_paths: paths,
    changed_path_digest: changedPathDigest(paths),
    checks: [{ name: "Static site release gates", status: "success", required: true, url: "https://github.com/example/check" }, { name: "Vercel", status: "success", required: true, url: "https://vercel.com/example" }],
    required_status: "success"
  };
  const previewEvidence = {
    evidence_version: "publication-preview-evidence/v1",
    deployment_id: "dpl_SyntheticReceiptTest",
    url: "https://synthetic-preview.vercel.app",
    source_sha: commitSha,
    state: "READY",
    target: "preview",
    http_status: 200,
    access_mode: "vercel_sso_protected",
    content_verification: {
      status: "pass",
      method: "authenticated_browser",
      checks: [
        { id: "metadata_and_schema", status: "pass" },
        { id: "public_copy_and_assets", status: "pass" },
        { id: "registries_and_links", status: "pass" },
        { id: "security_headers", status: "pass" }
      ]
    },
    production_promoted: false,
    verified_at: "2026-08-05T01:33:00.000Z"
  };
  return { root, action: verified.action, plan, applyReceipt, commitEvidence, prEvidence, previewEvidence };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof PublicationPrError && error.code === code);
}

test("selects collision-safe publication branches deterministically", () => {
  const preferred = "publication/synthetic-cpc-6027337da976411c";
  assert.equal(choosePublicationBranch(preferred, []), preferred);
  assert.equal(choosePublicationBranch(preferred, [preferred]), `${preferred}-r2`);
  assert.equal(choosePublicationBranch(preferred, [preferred, `${preferred}-r2`]), `${preferred}-r3`);
});

test("changed-path digest is sorted and rejects unsafe paths", () => {
  assert.equal(changedPathDigest(["b.json", "a.html"]), changedPathDigest(["a.html", "b.json"]));
  expectCode(() => changedPathDigest(["../private.json"]), "PR_CHANGED_PATH_INVALID");
});

test("resolves a Preview URL from a Vercel comment or deployment metadata", () => {
  assert.equal(resolveVercelPreviewUrl(["https://comment-preview.vercel.app"], { url: "fallback.vercel.app" }), "https://comment-preview.vercel.app");
  assert.equal(resolveVercelPreviewUrl([], { aliases: ["alias-preview.vercel.app"], url: "fallback.vercel.app" }), "https://alias-preview.vercel.app");
  assert.equal(resolveVercelPreviewUrl([], { url: "fallback.vercel.app" }), "https://fallback.vercel.app");
  expectCode(() => resolveVercelPreviewUrl([], { url: "https://example.com" }), "PR_PREVIEW_BINDING_INVALID");
});

test("selects the CarKey deployment when Vercel reports named project contexts", () => {
  const selected = selectVercelDeploymentCheck([
    { name: "Vercel – repo", url: "https://vercel.com/team/repo/dpl_other" },
    { name: "Vercel – procore-auto-key", url: "https://vercel.com/team/procore-auto-key/dpl_carkey" }
  ]);
  assert.equal(selected.name, "Vercel – procore-auto-key");
  assert.equal(selectVercelDeploymentCheck([{ name: "Vercel", url: "https://vercel.com/team/project/dpl_legacy" }]).name, "Vercel");
});

test("emits and verifies a deterministic hashed PR receipt package", async () => {
  const data = await fixture();
  const output = path.join(data.root, "receipt-package");
  const receipt = await emitPublicationPrReceiptPackage({ ...data, outputDirectory: output, createdAt: "2026-08-05T01:34:00.000Z" });
  const verified = await verifyPublicationPrReceiptPackage(output);
  assert.equal(verified.receipt_hash, receipt.receipt_hash);
  assert.equal(verified.publication_status, "pr_created");
  assert.equal(verified.merged_sha, null);
  assert.equal(verified.published_url, null);
  assert.equal(verified.no_network_generation, true);
});

test("rejects receipt and evidence tampering", async () => {
  const data = await fixture();
  const output = path.join(data.root, "tampered-package");
  await emitPublicationPrReceiptPackage({ ...data, outputDirectory: output, createdAt: "2026-08-05T01:34:00.000Z" });
  const receiptPath = path.join(output, "publication-pr-receipt.json");
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  receipt.pull_request.head_sha = "9".repeat(40);
  await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`);
  await assert.rejects(verifyPublicationPrReceiptPackage(output), (error) => error.code === "PR_RECEIPT_SCHEMA_INVALID" || error.code === "PR_RECEIPT_HASH_MISMATCH");
});

test("rejects wrong commit, wrong PR head, non-draft, and failed checks", async () => {
  const data = await fixture();
  expectCode(() => validateCommitEvidence({ ...data.commitEvidence, commit_parent_sha: "8".repeat(40) }, data.plan), "PR_COMMIT_BINDING_INVALID");
  expectCode(() => validatePrEvidence({ ...data.prEvidence, head_sha: "8".repeat(40) }, data.plan, data.commitEvidence), "PR_DRAFT_BINDING_INVALID");
  expectCode(() => validatePrEvidence({ ...data.prEvidence, draft: false }, data.plan, data.commitEvidence), "PR_DRAFT_BINDING_INVALID");
  expectCode(() => validatePrEvidence({ ...data.prEvidence, required_status: "failure" }, data.plan, data.commitEvidence), "PR_DRAFT_BINDING_INVALID");
});

test("rejects an evidence file hash mismatch", async () => {
  const data = await fixture();
  const output = path.join(data.root, "evidence-tamper");
  await emitPublicationPrReceiptPackage({ ...data, outputDirectory: output, createdAt: "2026-08-05T01:34:00.000Z" });
  await writeFile(path.join(output, "evidence/pr-evidence.json"), "{}\n");
  await assert.rejects(verifyPublicationPrReceiptPackage(output), (error) => error.code === "PR_RECEIPT_PACKAGE_HASH_MISMATCH");
});

test("stages and commits exactly the promotion-plan paths in an owned worktree", async () => {
  const data = await fixture();
  const worktree = path.join(data.root, "publication-worktree");
  const branch = `publication/synthetic-cpc-6027337da976411c-r${Date.now()}`;
  execFileSync("git", ["worktree", "add", "--detach", worktree, data.plan.expected_base_sha], { cwd: repositoryRoot, stdio: "ignore" });
  try {
    for (const file of data.plan.operations.files_to_modify) await writeFile(path.join(worktree, file), `${await readFile(path.join(worktree, file), "utf8")}\n<!-- synthetic orchestrator test -->\n`);
    for (const file of data.plan.operations.files_to_add) {
      await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(path.join(worktree, file)), { recursive: true }));
      await writeFile(path.join(worktree, file), "synthetic orchestrator test\n");
    }
    const prepared = await preparePublicationOrchestration({ action: data.action, plan: data.plan, applyReceipt: data.applyReceipt, worktreeRoot: worktree, canonicalRepositoryRoot: repositoryRoot, featureBranch: branch });
    assert.deepEqual(prepared.changed_paths, expectedPromotionPaths(data.plan));
    const staged = stagePublicationChangesSync({ plan: data.plan, worktreeRoot: worktree, canonicalRepositoryRoot: repositoryRoot, featureBranch: branch });
    assert.deepEqual(staged.changed_paths, expectedPromotionPaths(data.plan));
    const evidence = commitPublicationChanges({ plan: data.plan, worktreeRoot: worktree, featureBranch: branch, committedAt: "2026-08-05T01:35:00.000Z" });
    assert.equal(evidence.commit_parent_sha, data.plan.expected_base_sha);
    assert.equal(evidence.remote_branch_verified, false);
  } finally {
    execFileSync("git", ["worktree", "remove", "--force", worktree], { cwd: repositoryRoot, stdio: "ignore" });
    execFileSync("git", ["branch", "-D", branch], { cwd: repositoryRoot, stdio: "ignore" });
  }
});

test("receipt hash ignores only its two integrity placeholders", async () => {
  const data = await fixture();
  const output = path.join(data.root, "hash-package");
  const receipt = await emitPublicationPrReceiptPackage({ ...data, outputDirectory: output, createdAt: "2026-08-05T01:34:00.000Z" });
  assert.equal(computePublicationPrReceiptHash(receipt), receipt.receipt_hash);
  const changed = structuredClone(receipt);
  changed.publication_revision += 1;
  assert.notEqual(computePublicationPrReceiptHash(changed), receipt.receipt_hash);
});
