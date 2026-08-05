#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const contractRoot = path.resolve("contracts/publication-pr-receipt/v1");
const checksumFile = await readFile(path.join(contractRoot, "CHECKSUMS.sha256"), "utf8");
const expected = new Map(checksumFile.trim().split(/\r?\n/).map((line) => {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  if (!match) throw new Error("Malformed publication-pr-receipt CHECKSUMS.sha256");
  return [match[2], match[1]];
}));

for (const [name, digest] of expected) {
  const bytes = await readFile(path.join(contractRoot, name));
  if (createHash("sha256").update(bytes).digest("hex") !== digest) throw new Error(`Publication PR receipt checksum mismatch: ${name}`);
  if (name.endsWith(".json")) JSON.parse(bytes.toString("utf8"));
}

const referenceIndex = process.argv.indexOf("--reference");
if (referenceIndex !== -1) {
  const reference = path.resolve(process.argv[referenceIndex + 1]);
  const localNames = (await readdir(contractRoot)).sort();
  const referenceNames = (await readdir(reference)).sort();
  if (JSON.stringify(localNames) !== JSON.stringify(referenceNames)) throw new Error("Publication PR receipt mirror file set drift");
  for (const name of localNames) {
    const [local, remote] = await Promise.all([readFile(path.join(contractRoot, name)), readFile(path.join(reference, name))]);
    if (!local.equals(remote)) throw new Error(`Publication PR receipt mirror byte drift: ${name}`);
  }
}

console.log(`Publication PR receipt contract verified: ${expected.size} checksums${referenceIndex === -1 ? "" : " + byte-identical reference"}`);
