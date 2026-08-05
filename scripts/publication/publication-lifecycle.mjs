#!/usr/bin/env node
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  PublicationPromotionError,
  verifyPublicationActionPackage
} from "./publication-promotion.mjs";
import {
  applyPublicationPlan,
  finalizeApplyReceiptCommit,
  validateApplyInputs,
  verifyAppliedPublication
} from "./publication-apply.mjs";

function valueFor(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

async function boundedJson(file, code) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024) throw new PublicationPromotionError(code, "JSON path must be a bounded regular file");
  return JSON.parse(await readFile(file, "utf8"));
}

const mode = valueFor("--mode");
const actionPackage = valueFor("--action-package");
const planFile = valueFor("--plan");
const draftDirectory = valueFor("--draft");
const worktreeRoot = valueFor("--worktree");
const receiptRoot = valueFor("--receipt-root");
const receiptFile = valueFor("--receipt");
const appliedAt = valueFor("--applied-at");
const commit = valueFor("--commit");

try {
  if (mode === "finalize") {
    if (!receiptFile || !commit) throw new PublicationPromotionError("APPLY_USAGE", "finalize requires --receipt and --commit");
    const receipt = await finalizeApplyReceiptCommit(path.resolve(receiptFile), commit);
    console.log(JSON.stringify({ status: "finalized", action_id: receipt.action_id, receipt_hash: receipt.receipt_hash, resulting_commit: receipt.resulting_commit, network_used: false }));
    process.exit(0);
  }
  if (!["validate", "apply", "verify"].includes(mode) || !actionPackage || !planFile || !draftDirectory || !worktreeRoot) {
    throw new PublicationPromotionError("APPLY_USAGE", "Usage: --mode validate|apply|verify --action-package <dir> --plan <json> --draft <dir> --worktree <dir>");
  }
  const canonicalRepositoryRoot = process.cwd();
  const verifiedPackage = await verifyPublicationActionPackage(path.resolve(actionPackage));
  const action = verifiedPackage.action;
  const plan = await boundedJson(path.resolve(planFile), "PROMOTION_PLAN_INVALID");
  const common = { action, plan, draftDirectory: path.resolve(draftDirectory), worktreeRoot: path.resolve(worktreeRoot), canonicalRepositoryRoot };
  if (mode === "validate") {
    await validateApplyInputs(common);
    console.log(JSON.stringify({ status: "validated", action_id: action.action_id, plan_hash: plan.plan_hash, disposable_worktree: true, network_used: false }));
  } else if (mode === "apply") {
    if (!receiptRoot || !appliedAt) throw new PublicationPromotionError("APPLY_USAGE", "apply requires --receipt-root and --applied-at");
    const result = await applyPublicationPlan({ ...common, publishToolPath: path.join(canonicalRepositoryRoot, "publish_tool.py"), receiptRoot: path.resolve(receiptRoot), appliedAt });
    console.log(JSON.stringify({ status: "applied", operation: result.operation, action_id: action.action_id, receipt_path: result.receiptPath, receipt_hash: result.receipt.receipt_hash, network_used: false }));
  } else {
    const result = await verifyAppliedPublication(common);
    console.log(JSON.stringify({ status: "verified", action_id: action.action_id, resulting_public_content_hash: result.resultingPublicContentHash, changed_paths: result.changedPaths, network_used: false }));
  }
} catch (error) {
  if (error instanceof PublicationPromotionError) {
    console.error(JSON.stringify({ status: "rejected", code: error.code }));
    process.exit(1);
  }
  throw error;
}
