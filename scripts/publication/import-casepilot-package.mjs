#!/usr/bin/env node
import path from "node:path";
import process from "node:process";

import { importPublicationPackage, PublicationImportError } from "./publication-import.mjs";

function valueFor(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

const packageDirectory = valueFor("--package");
const outputRoot = valueFor("--output-root");
if (!packageDirectory) {
  console.error("Usage: node scripts/publication/import-casepilot-package.mjs --package <package-dir> [--output-root <draft-root>]");
  process.exit(2);
}

try {
  const repositoryRoot = process.cwd();
  const result = await importPublicationPackage({
    packageDirectory: path.resolve(packageDirectory),
    repositoryRoot,
    ...(outputRoot ? { draftRoot: path.resolve(outputRoot) } : {})
  });
  console.log(JSON.stringify({
    status: "accepted",
    operation: result.operation,
    candidate_id: result.receipt.candidate_id,
    candidate_hash: result.receipt.candidate_hash,
    package_hash: result.receipt.package_hash,
    draft_directory: result.candidateDirectory,
    synthetic: true,
    network_used: false
  }));
} catch (error) {
  if (error instanceof PublicationImportError) {
    console.error(JSON.stringify({ status: "rejected", code: error.code }));
    process.exit(1);
  }
  throw error;
}
