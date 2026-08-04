#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const contractRoot = path.resolve("contracts/publication-candidate/v1");
const checksumFile = await readFile(path.join(contractRoot, "CHECKSUMS.sha256"), "utf8");
const expected = new Map(checksumFile.trim().split(/\r?\n/).map((line) => {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  if (!match) throw new Error("Malformed CHECKSUMS.sha256");
  return [match[2], match[1]];
}));

for (const [name, digest] of expected) {
  const bytes = await readFile(path.join(contractRoot, name));
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== digest) throw new Error(`Contract checksum mismatch: ${name}`);
}

const index = process.argv.indexOf("--reference");
if (index !== -1) {
  const reference = path.resolve(process.argv[index + 1]);
  const names = (await readdir(contractRoot)).sort();
  const referenceNames = (await readdir(reference)).sort();
  if (JSON.stringify(names) !== JSON.stringify(referenceNames)) throw new Error("Contract mirror file set drift");
  for (const name of names) {
    const local = await readFile(path.join(contractRoot, name));
    const remote = await readFile(path.join(reference, name));
    if (!local.equals(remote)) throw new Error(`Contract mirror byte drift: ${name}`);
  }
}

console.log(`Publication contract mirror verified: ${expected.size} checksums${index === -1 ? "" : " + byte-identical reference"}`);
