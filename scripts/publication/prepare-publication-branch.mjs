#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { importPublicationPackage, PublicationImportError } from "./publication-import.mjs";
import { assertPlanningOutputBoundary, preparePromotionPlan, PublicationPromotionError, verifyPublicationActionPackage, writePromotionPlan } from "./publication-promotion.mjs";

function valueFor(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

const packageDirectory = valueFor("--package");
const actionFile = valueFor("--action");
const actionPackageDirectory = valueFor("--action-package");
const priorReceiptFile = valueFor("--prior-receipt");
const outputRoot = valueFor("--output-root");
if ((!actionPackageDirectory && (!packageDirectory || !actionFile)) || !outputRoot) {
  console.error("Usage: node scripts/publication/prepare-publication-branch.mjs --action-package <dir> --output-root <deploy-excluded-root> [--prior-receipt <json>]");
  process.exit(2);
}

try {
  const repositoryRoot = process.cwd();
  const resolvedOutput = path.resolve(outputRoot);
  await mkdir(resolvedOutput, { recursive: true });
  const [realRepositoryRoot, realOutputRoot] = await Promise.all([realpath(repositoryRoot), realpath(resolvedOutput)]);
  assertPlanningOutputBoundary(realRepositoryRoot, realOutputRoot);
  let resolvedPackageDirectory;
  let action;
  if (actionPackageDirectory) {
    const verified = await verifyPublicationActionPackage(path.resolve(actionPackageDirectory));
    resolvedPackageDirectory = verified.candidatePackageDirectory;
    action = verified.action;
  } else {
    const actionInfo = await lstat(path.resolve(actionFile));
    if (!actionInfo.isFile() || actionInfo.isSymbolicLink() || actionInfo.size > 1024 * 1024) throw new PublicationPromotionError("ACTION_SCHEMA_INVALID", "Action input must be a bounded regular file");
    resolvedPackageDirectory = path.resolve(packageDirectory);
    action = JSON.parse(await readFile(path.resolve(actionFile), "utf8"));
  }
  const imported = await importPublicationPackage({
    packageDirectory: resolvedPackageDirectory,
    repositoryRoot,
    draftRoot: path.join(realOutputRoot, "drafts"),
    allowExistingSlug: action.action !== "publish"
  });
  const priorReceipt = priorReceiptFile ? JSON.parse(await readFile(path.resolve(priorReceiptFile), "utf8")) : null;
  const currentBaseSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
  const plan = await preparePromotionPlan({ action, draftDirectory: imported.candidateDirectory, repositoryRoot, currentBaseSha, priorReceipt });
  const saved = await writePromotionPlan(plan, realOutputRoot);
  console.log(JSON.stringify({
    status: "accepted",
    import_operation: imported.operation,
    plan_operation: saved.operation,
    action_id: plan.action_id,
    action: plan.action,
    proposed_branch: plan.proposed_branch,
    plan_path: saved.planPath,
    apply_automated: false,
    pr_automated: false,
    network_used: false
  }));
} catch (error) {
  if (error instanceof PublicationImportError || error instanceof PublicationPromotionError) {
    console.error(JSON.stringify({ status: "rejected", code: error.code }));
    process.exit(1);
  }
  throw error;
}
