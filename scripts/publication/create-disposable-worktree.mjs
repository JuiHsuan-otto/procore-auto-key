#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { PublicationPromotionError } from "./publication-promotion.mjs";

function valueFor(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

const baseSha = valueFor("--base-sha");
const outputRoot = valueFor("--output-root");
if (!baseSha || !/^[a-f0-9]{40}$/.test(baseSha)) {
  console.error(JSON.stringify({ status: "rejected", code: "WORKTREE_BASE_INVALID" }));
  process.exit(2);
}

try {
  const repositoryRoot = await realpath(process.cwd());
  const root = outputRoot ? path.resolve(outputRoot) : path.join(os.tmpdir(), "carkey-wave2-worktrees");
  await mkdir(root, { recursive: true });
  const worktreePath = await mkdtemp(path.join(root, "publication-"));
  if (path.resolve(worktreePath).startsWith(`${repositoryRoot}${path.sep}`)) throw new PublicationPromotionError("WORKTREE_BOUNDARY_INVALID", "Disposable worktree must remain outside the canonical checkout");
  execFileSync("git", ["cat-file", "-e", `${baseSha}^{commit}`], { cwd: repositoryRoot, stdio: "ignore" });
  execFileSync("git", ["worktree", "add", "--detach", worktreePath, baseSha], { cwd: repositoryRoot, stdio: ["ignore", "pipe", "pipe"] });
  const actual = execFileSync("git", ["rev-parse", "HEAD"], { cwd: worktreePath, encoding: "utf8" }).trim();
  if (actual !== baseSha) throw new PublicationPromotionError("WORKTREE_BASE_INVALID", "Disposable worktree did not resolve to requested baseline");
  console.log(JSON.stringify({ status: "created", worktree_path: worktreePath, baseline_sha: actual, canonical_checkout_unchanged: true, network_used: false }));
} catch (error) {
  if (error instanceof PublicationPromotionError) {
    console.error(JSON.stringify({ status: "rejected", code: error.code }));
    process.exit(1);
  }
  throw error;
}
