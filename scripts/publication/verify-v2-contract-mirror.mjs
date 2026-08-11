#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../contracts/publication-handoff/v2");
const sealed = [
  "README.md",
  "publication-handoff.schema.json",
  "publication-preview-receipt.schema.json",
  "publication-production-authorization.schema.json",
  "publication-production-receipt.schema.json"
];
const expectedFiles = [...sealed, "CHECKSUMS.sha256"].sort();

function fail(message) {
  process.stderr.write(`Publication v2 contract mirror invalid: ${message}\n`);
  process.exit(1);
}

const actualFiles = (await readdir(root)).sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  fail(`file set differs: ${JSON.stringify(actualFiles)}`);
}

const manifest = await readFile(path.join(root, "CHECKSUMS.sha256"), "utf8");
const lines = manifest.trimEnd().split("\n");
if (lines.length !== sealed.length) fail("checksum entry count differs");

const entries = new Map();
for (const line of lines) {
  const match = line.match(/^([a-f0-9]{64})  ([A-Za-z0-9._-]+)$/);
  if (!match || entries.has(match[2])) fail(`malformed or duplicate checksum line: ${line}`);
  entries.set(match[2], match[1]);
}
if (JSON.stringify([...entries.keys()].sort()) !== JSON.stringify([...sealed].sort())) fail("checksum file set differs");

for (const filename of sealed) {
  const bytes = await readFile(path.join(root, filename));
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== entries.get(filename)) fail(`checksum mismatch: ${filename}`);
  if (filename.endsWith(".json")) {
    try { JSON.parse(bytes.toString("utf8")); } catch { fail(`invalid JSON: ${filename}`); }
  }
}

process.stdout.write(`Publication v2 contract mirror verified: ${sealed.length} checksums\n`);
