import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { importPublicationPackage } from "./publication-import.mjs";
import {
  PublicationPromotionError,
  assertPlanningOutputBoundary,
  canonicalPromotionJson,
  computePublicationActionHash,
  computePublicationActionRequestHash,
  preparePromotionPlan,
  promotionSha256,
  validatePromotionPlan,
  validatePublicationAction,
  verifyPublicationActionPackage,
  writePromotionPlan
} from "./publication-promotion.mjs";
import {
  applyPublicationPlan,
  assertDisposableWorktree,
  finalizeApplyReceiptCommit,
  validateApplyInputs,
  verifyAppliedPublication
} from "./publication-apply.mjs";

const repositoryRoot = process.cwd();
const candidatePackage = path.join(repositoryRoot, "tests/fixtures/publication/valid-package");
const actionPackage = path.join(repositoryRoot, "tests/fixtures/publication-action/valid-package");
const correctionCandidatePackage = path.join(repositoryRoot, "tests/fixtures/publication-action/correction-candidate");
const baseSha = "b397cf263eea5749d299d2a8d02d14654efb409e";
const publishToolPath = path.join(repositoryRoot, "publish_tool.py");

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

async function importedDraft(packageDirectory = candidatePackage, siteRoot = repositoryRoot, allowExistingSlug = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), "carkey-promotion-"));
  const imported = await importPublicationPackage({ packageDirectory, repositoryRoot: siteRoot, draftRoot: path.join(root, "drafts"), allowExistingSlug });
  return { root, draftDirectory: imported.candidateDirectory };
}

async function loadPublishAction() {
  return (await verifyPublicationActionPackage(actionPackage)).action;
}

function rehashAction(action) {
  action.approval.reviewed_action_sha256 = "";
  action.approval.reviewed_action_sha256 = computePublicationActionRequestHash(action);
  action.action_id = "";
  action.action_hash = "";
  action.approval.action_hash = "";
  const hash = computePublicationActionHash(action);
  action.action_hash = hash;
  action.action_id = `pca_${hash.slice(0, 16)}`;
  action.approval.action_hash = hash;
  return action;
}

function priorFromReceipt(receipt) {
  return {
    receipt_hash: receipt.receipt_hash,
    action_id: receipt.action_id,
    action_revision: receipt.action_revision,
    candidate_revision: receipt.candidate_revision,
    public_record_id: receipt.public_record_id,
    state: "published",
    public_content_hash: receipt.resulting_public_content_hash,
    canonical_url: receipt.canonical_url,
    published_commit: receipt.resulting_commit,
    deployment_id: receipt.deployment_id,
    verified_at: receipt.verified_at
  };
}

async function correctionAction(publishAction, publishReceipt, correctionDraft, correctionBaseSha) {
  const action = structuredClone(publishAction);
  const manifest = JSON.parse(await readFile(path.join(correctionCandidatePackage, "manifest.json"), "utf8"));
  const draftHash = promotionSha256(await readFile(path.join(correctionDraft, "draft.html")));
  action.action = "correct";
  action.action_revision = 2;
  action.candidate_id = manifest.candidate_id;
  action.candidate_revision = 2;
  action.candidate_hash = manifest.candidate_hash;
  action.package_hash = manifest.package_hash;
  action.draft_sha256 = draftHash;
  action.previous_action_id = publishReceipt.action_id;
  action.expected_state = "published";
  action.expected_current_public_content_hash = publishReceipt.resulting_public_content_hash;
  action.proposed_public_content_hash = draftHash;
  action.expected_carkey_base_sha = correctionBaseSha;
  Object.assign(action.requested_publication, { reason_code: "factual_correction", requested_resolution: "correct_in_place", canonical_continuity_required: true, publication_date: "2026-08-06" });
  Object.assign(action.authorization, { approval_timestamp: "2026-08-05T00:15:00.000Z", evidence_reference: "evidence_wave2_synthetic_002" });
  Object.assign(action.approval, { approval_reference: "approval_wave2_synthetic_002", reviewed_draft_sha256: draftHash, approved_at: "2026-08-05T00:15:00.000Z" });
  action.prior_publication = priorFromReceipt(publishReceipt);
  return rehashAction(action);
}

function withdrawalAction(correctAction, correctionReceipt, withdrawalBaseSha) {
  const action = structuredClone(correctAction);
  action.action = "withdraw";
  action.action_revision = 3;
  action.previous_action_id = correctionReceipt.action_id;
  action.expected_current_public_content_hash = correctionReceipt.resulting_public_content_hash;
  action.proposed_public_content_hash = null;
  action.expected_carkey_base_sha = withdrawalBaseSha;
  action.requested_publication = { proposed_slug: null, publication_date: null, reason_code: "consent_withdrawal", requested_resolution: "noindex", replacement_url: null, canonical_continuity_required: true, preserve_publication_history: true, sitemap_intent: "remove", redirect_intent: "none" };
  Object.assign(action.authorization, { approval_timestamp: "2026-08-05T00:25:00.000Z", evidence_reference: "evidence_wave2_synthetic_003" });
  Object.assign(action.consent, { status: "withdrawn", public_content_consent: false, withdrawal_requested: true });
  Object.assign(action.approval, { approval_reference: "approval_wave2_synthetic_003", approved_at: "2026-08-05T00:25:00.000Z" });
  action.prior_publication = priorFromReceipt(correctionReceipt);
  return rehashAction(action);
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof PublicationPromotionError && error.code === code);
}

async function expectCodeAsync(promise, code) {
  await assert.rejects(promise, (error) => error instanceof PublicationPromotionError && error.code === code);
}

function createWorktree(parent, name, sha) {
  const worktree = path.join(parent, name);
  git(repositoryRoot, ["worktree", "add", "--detach", worktree, sha]);
  return worktree;
}

function commitWorktree(worktree, message) {
  git(worktree, ["add", "--all"]);
  git(worktree, ["-c", "user.name=Wave2 Synthetic", "-c", "user.email=wave2-synthetic@users.noreply.github.com", "commit", "-m", message]);
  return git(worktree, ["rev-parse", "HEAD"]);
}

test("verifies the hashed action package and prepares a deterministic CarKey-owned plan", async () => {
  const verified = await verifyPublicationActionPackage(actionPackage);
  const { draftDirectory } = await importedDraft();
  const first = await preparePromotionPlan({ action: verified.action, draftDirectory, repositoryRoot, currentBaseSha: baseSha });
  const second = await preparePromotionPlan({ action: verified.action, draftDirectory, repositoryRoot, currentBaseSha: baseSha });
  assert.equal(canonicalPromotionJson(first), canonicalPromotionJson(second));
  assert.equal(validatePromotionPlan(first), first);
  assert.equal(first.plan_hash.length, 64);
  assert.equal(first.operations.canonical_operation, "create");
  assert.equal(first.registry_sync.tool, "publish_tool.py");
  assert.deepEqual(first.registry_sync.mutated_paths, ["blog.json", "cases.json", "sitemap.xml"]);
  assert.equal(first.registry_sync.arguments.includes("--preserve-schema-governed-html"), true);
  assert.deepEqual(first.operations.internal_link_targets, ["rescue-request.html"]);
  assert.equal(first.operations.files_to_modify.includes("blog.html"), false);
  assert.equal(first.operations.files_to_modify.includes("cases.html"), false);
  assert.equal(first.operations.files_to_modify.includes("all-keys-lost-service.html"), false);
  assert.equal(first.publication_authority.apply_automated, false);
  assert.equal(first.network_used, false);
});

test("allows planning output only outside the repo or under deploy-excluded drafts", () => {
  assert.doesNotThrow(() => assertPlanningOutputBoundary(repositoryRoot, path.join(repositoryRoot, "drafts/wave2")));
  assert.doesNotThrow(() => assertPlanningOutputBoundary(repositoryRoot, path.join(os.tmpdir(), "wave2-outside-repo")));
  expectCode(() => assertPlanningOutputBoundary(repositoryRoot, path.join(repositoryRoot, "wave2-output")), "PROMOTION_OUTPUT_NOT_EXCLUDED");
});

test("rejects base drift, tampering, revoked authorization, missing consent, and private data", async () => {
  const action = await loadPublishAction();
  const { draftDirectory } = await importedDraft();
  await expectCodeAsync(preparePromotionPlan({ action, draftDirectory, repositoryRoot, currentBaseSha: "a".repeat(40) }), "PROMOTION_BASE_DRIFT");
  for (const mutate of [
    (copy) => { copy.requested_publication.publication_date = "2026-08-06"; },
    (copy) => { copy.authorization.revoked = true; rehashAction(copy); },
    (copy) => { copy.consent.public_content_consent = false; rehashAction(copy); },
    (copy) => { copy.customer_phone = "synthetic-private-sentinel"; }
  ]) {
    const copy = structuredClone(action);
    mutate(copy);
    assert.throws(() => validatePublicationAction(copy), PublicationPromotionError);
  }
});

test("rejects changed approved draft and asset bytes", async () => {
  const action = await loadPublishAction();
  const first = await importedDraft();
  await writeFile(path.join(first.draftDirectory, "draft.html"), "tampered", "utf8");
  await expectCodeAsync(preparePromotionPlan({ action, draftDirectory: first.draftDirectory, repositoryRoot, currentBaseSha: baseSha }), "PROMOTION_DRAFT_HASH_MISMATCH");
  const second = await importedDraft();
  await writeFile(path.join(second.draftDirectory, "assets/synthetic-toyota-vios-case.svg"), "tampered", "utf8");
  await expectCodeAsync(preparePromotionPlan({ action, draftDirectory: second.draftDirectory, repositoryRoot, currentBaseSha: baseSha }), "PROMOTION_ASSET_BINDING_MISMATCH");
});

test("writes and reuses exact plan bytes, then raises typed conflict", async () => {
  const action = await loadPublishAction();
  const { root, draftDirectory } = await importedDraft();
  const plan = await preparePromotionPlan({ action, draftDirectory, repositoryRoot, currentBaseSha: baseSha });
  const first = await writePromotionPlan(plan, root);
  const replay = await writePromotionPlan(plan, root);
  assert.equal(first.operation, "created");
  assert.equal(replay.operation, "reused");
  const conflict = structuredClone(plan);
  conflict.risk_flags.push("different");
  conflict.plan_hash = "0".repeat(64);
  await expectCodeAsync(writePromotionPlan(conflict, root), "PROMOTION_PLAN_INVALID");
});

test("rejects canonical checkout apply, wrong baseline, and worktree drift", async () => {
  expectCode(() => assertDisposableWorktree(repositoryRoot, baseSha, repositoryRoot), "APPLY_DISPOSABLE_WORKTREE_REQUIRED");
  const temp = await mkdtemp(path.join(os.tmpdir(), "carkey-worktree-negative-"));
  const worktree = createWorktree(temp, "target", baseSha);
  try {
    expectCode(() => assertDisposableWorktree(worktree, "a".repeat(40), repositoryRoot), "APPLY_DISPOSABLE_WORKTREE_REQUIRED");
    const action = await loadPublishAction();
    const { draftDirectory } = await importedDraft(candidatePackage, worktree);
    const plan = await preparePromotionPlan({ action, draftDirectory, repositoryRoot: worktree, currentBaseSha: baseSha });
    await writeFile(path.join(worktree, "synthetic-drift.txt"), "drift", "utf8");
    await expectCodeAsync(validateApplyInputs({ action, plan, draftDirectory, worktreeRoot: worktree, canonicalRepositoryRoot: repositoryRoot }), "APPLY_WORKTREE_DRIFT");
  } finally {
    git(repositoryRoot, ["worktree", "remove", "--force", worktree]);
  }
});

test("runs publish, correct, and withdraw in fresh disposable worktrees with idempotency and rollback", { timeout: 60_000 }, async () => {
  const sourceStatusBefore = git(repositoryRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const temp = await mkdtemp(path.join(os.tmpdir(), "carkey-wave2-lifecycle-"));
  const receiptRoot = path.join(temp, "receipts");
  const worktrees = [];
  try {
    const publishWorktree = createWorktree(temp, "publish", baseSha);
    worktrees.push(publishWorktree);
    const publishAction = await loadPublishAction();
    const publishDraft = await importedDraft(candidatePackage, publishWorktree);
    const publishPlan = await preparePromotionPlan({ action: publishAction, draftDirectory: publishDraft.draftDirectory, repositoryRoot: publishWorktree, currentBaseSha: baseSha });
    const governedBlogHtml = await readFile(path.join(publishWorktree, "blog.html"), "utf8");
    const governedCasesHtml = await readFile(path.join(publishWorktree, "cases.html"), "utf8");
    const originalFetch = globalThis.fetch;
    let networkCalled = false;
    globalThis.fetch = async () => { networkCalled = true; throw new Error("network forbidden"); };
    const published = await applyPublicationPlan({ action: publishAction, plan: publishPlan, draftDirectory: publishDraft.draftDirectory, worktreeRoot: publishWorktree, canonicalRepositoryRoot: repositoryRoot, publishToolPath, receiptRoot, appliedAt: "2026-08-05T00:08:00.000Z" });
    const replay = await applyPublicationPlan({ action: publishAction, plan: publishPlan, draftDirectory: publishDraft.draftDirectory, worktreeRoot: publishWorktree, canonicalRepositoryRoot: repositoryRoot, publishToolPath, receiptRoot, appliedAt: "2026-08-05T00:08:00.000Z" });
    globalThis.fetch = originalFetch;
    assert.equal(networkCalled, false);
    assert.equal(published.operation, "created");
    assert.equal(replay.operation, "reused");
    assert.equal(await readFile(path.join(publishWorktree, "blog.html"), "utf8"), governedBlogHtml);
    assert.equal(await readFile(path.join(publishWorktree, "cases.html"), "utf8"), governedCasesHtml);
    const publishedHtml = await readFile(path.join(publishWorktree, publishPlan.public_page.path), "utf8");
    assert.doesNotMatch(publishedHtml, /synthetic|fixture|合成/i);
    assert.doesNotMatch(publishedHtml, /這筆本案例/);
    assert.doesNotMatch(publishPlan.asset_copies[0].destination, /synthetic|fixture/i);
    assert.equal((await readFile(path.join(publishWorktree, "rescue-request.html"), "utf8")).split(`href="/${publishPlan.public_page.path.replace(/\.html$/, "")}#`).length - 1, 3);
    assert.equal((await verifyAppliedPublication({ action: publishAction, plan: publishPlan, draftDirectory: publishDraft.draftDirectory, worktreeRoot: publishWorktree })).resultingPublicContentHash, published.receipt.resulting_public_content_hash);
    const publishCommit = commitWorktree(publishWorktree, "test: synthetic publication");
    const publishReceipt = await finalizeApplyReceiptCommit(published.receiptPath, publishCommit);

    const correctWorktree = createWorktree(temp, "correct", publishCommit);
    worktrees.push(correctWorktree);
    const correctionDraft = await importedDraft(correctionCandidatePackage, correctWorktree, true);
    const correctAction = await correctionAction(publishAction, publishReceipt, correctionDraft.draftDirectory, publishCommit);
    validatePublicationAction(correctAction);
    const correctPlan = await preparePromotionPlan({ action: correctAction, draftDirectory: correctionDraft.draftDirectory, repositoryRoot: correctWorktree, currentBaseSha: publishCommit, priorReceipt: publishReceipt });
    const corrected = await applyPublicationPlan({ action: correctAction, plan: correctPlan, draftDirectory: correctionDraft.draftDirectory, worktreeRoot: correctWorktree, canonicalRepositoryRoot: repositoryRoot, publishToolPath, receiptRoot, appliedAt: "2026-08-05T00:18:00.000Z" });
    const correctedHtml = await readFile(path.join(correctWorktree, correctPlan.public_page.path), "utf8");
    assert.match(correctedHtml, /"datePublished":"2026-08-05"/);
    assert.match(correctedHtml, /"dateModified":"2026-08-06"/);
    assert.equal((correctedHtml.match(/<link rel="canonical"/g) ?? []).length, 1);
    assert.equal((await readFile(path.join(correctWorktree, "sitemap.xml"), "utf8")).split(correctPlan.public_page.canonical_url).length - 1, 1);
    const correctionCommit = commitWorktree(correctWorktree, "test: synthetic correction");
    const correctionReceipt = await finalizeApplyReceiptCommit(corrected.receiptPath, correctionCommit);

    const withdrawWorktree = createWorktree(temp, "withdraw", correctionCommit);
    worktrees.push(withdrawWorktree);
    const withdrawalDraft = await importedDraft(correctionCandidatePackage, withdrawWorktree, true);
    const withdrawAction = withdrawalAction(correctAction, correctionReceipt, correctionCommit);
    validatePublicationAction(withdrawAction);
    const withdrawPlan = await preparePromotionPlan({ action: withdrawAction, draftDirectory: withdrawalDraft.draftDirectory, repositoryRoot: withdrawWorktree, currentBaseSha: correctionCommit, priorReceipt: correctionReceipt });
    const withdrawn = await applyPublicationPlan({ action: withdrawAction, plan: withdrawPlan, draftDirectory: withdrawalDraft.draftDirectory, worktreeRoot: withdrawWorktree, canonicalRepositoryRoot: repositoryRoot, publishToolPath, receiptRoot, appliedAt: "2026-08-05T00:28:00.000Z" });
    assert.equal(withdrawn.receipt.state, "withdrawn_local");
    const tombstone = await readFile(path.join(withdrawWorktree, withdrawPlan.public_page.path), "utf8");
    assert.match(tombstone, /noindex, nofollow, noarchive/);
    assert.doesNotMatch(tombstone, /"@type":"Article"/);
    assert.doesNotMatch(await readFile(path.join(withdrawWorktree, "sitemap.xml"), "utf8"), new RegExp(withdrawPlan.public_page.canonical_url));
    assert.equal(existsSync(path.join(withdrawWorktree, withdrawPlan.operations.files_to_remove[0])), false);
    assert.equal(existsSync(path.join(withdrawWorktree, withdrawPlan.operations.files_to_add[0])), true);

    git(withdrawWorktree, ["restore", "--source", correctionCommit, "--", ...withdrawPlan.operations.files_to_modify, ...withdrawPlan.operations.files_to_remove]);
    git(withdrawWorktree, ["clean", "-f", "--", ...withdrawPlan.operations.files_to_add]);
    assert.equal(git(withdrawWorktree, ["status", "--porcelain=v1", "--untracked-files=all"]), "");
    assert.equal(sourceStatusBefore, git(repositoryRoot, ["status", "--porcelain=v1", "--untracked-files=all"]));
  } finally {
    for (const worktree of worktrees.reverse()) {
      try { git(repositoryRoot, ["worktree", "remove", "--force", worktree]); } catch { /* best-effort cleanup of owned test worktree */ }
    }
  }
});
