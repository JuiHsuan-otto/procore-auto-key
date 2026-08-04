import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PublicationImportError,
  canonicalJson,
  computeCandidateHash,
  computePackageHash,
  importPublicationPackage,
  sha256,
  verifyPublicationPackage
} from "./publication-import.mjs";

const REPOSITORY_ROOT = process.cwd();
const FIXTURE_PACKAGE = path.join(REPOSITORY_ROOT, "tests/fixtures/publication/valid-package");

async function workspace(t, label) {
  const root = await mkdtemp(path.join(tmpdir(), `carkey-${label}-`));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageDirectory = path.join(root, "package");
  const draftRoot = path.join(root, "drafts", "casepilot");
  await cp(FIXTURE_PACKAGE, packageDirectory, { recursive: true });
  return { root, packageDirectory, draftRoot };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeCanonical(filePath, value) {
  await writeFile(filePath, `${canonicalJson(value)}\n`);
}

async function refreshIntegrity(packageDirectory, { deriveCandidateId = true } = {}) {
  const candidatePath = path.join(packageDirectory, "candidate.json");
  const manifestPath = path.join(packageDirectory, "manifest.json");
  const candidate = await readJson(candidatePath);
  const originalId = candidate.candidate_id;
  candidate.candidate_hash = computeCandidateHash(candidate);
  candidate.approval_audit.candidate_hash = candidate.candidate_hash;
  candidate.candidate_id = deriveCandidateId ? `cpc_${candidate.candidate_hash.slice(0, 16)}` : originalId;
  await writeCanonical(candidatePath, candidate);
  const manifest = await readJson(manifestPath);
  manifest.candidate_id = candidate.candidate_id;
  manifest.candidate_hash = candidate.candidate_hash;
  for (const entry of manifest.files) {
    const bytes = await readFile(path.join(packageDirectory, entry.path));
    entry.byte_length = bytes.byteLength;
    entry.sha256 = sha256(bytes);
  }
  manifest.package_hash = computePackageHash(manifest);
  await writeCanonical(manifestPath, manifest);
  return { candidate, manifest };
}

async function expectCode(action, code) {
  await assert.rejects(action, (error) => error instanceof PublicationImportError && error.code === code);
}

test("imports a valid package into the deploy-excluded draft model", async (t) => {
  const { packageDirectory, draftRoot } = await workspace(t, "valid");
  const result = await importPublicationPackage({ packageDirectory, repositoryRoot: REPOSITORY_ROOT, draftRoot });
  assert.equal(result.operation, "created");
  const candidatePublic = await readJson(path.join(result.candidateDirectory, "candidate-public.json"));
  const html = await readFile(path.join(result.candidateDirectory, "draft.html"), "utf8");
  assert.equal(candidatePublic.public_brand, "極致核心 ProCore");
  assert.equal(candidatePublic.canonical_url, null);
  assert.equal(candidatePublic.sitemap_intent, "exclude_until_owner_promotion");
  assert.match(html, /noindex, nofollow, noarchive/);
  assert.doesNotMatch(html, /rel=["']canonical|CasePilot/i);
});

test("rejects a missing manifest", async (t) => {
  const { packageDirectory } = await workspace(t, "missing-manifest");
  await unlink(path.join(packageDirectory, "manifest.json"));
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "MISSING_MANIFEST");
});

test("rejects a missing candidate", async (t) => {
  const { packageDirectory } = await workspace(t, "missing-candidate");
  await unlink(path.join(packageDirectory, "candidate.json"));
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "MISSING_CANDIDATE");
});

test("rejects a missing asset", async (t) => {
  const { packageDirectory } = await workspace(t, "missing-asset");
  await unlink(path.join(packageDirectory, "assets/synthetic-toyota-vios-case.svg"));
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "MISSING_ASSET");
});

test("rejects a wrong file hash", async (t) => {
  const { packageDirectory } = await workspace(t, "wrong-file-hash");
  const manifestPath = path.join(packageDirectory, "manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.files[0].sha256 = "0".repeat(64);
  manifest.package_hash = computePackageHash(manifest);
  await writeCanonical(manifestPath, manifest);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "FILE_HASH_MISMATCH");
});

test("rejects a wrong package hash", async (t) => {
  const { packageDirectory } = await workspace(t, "wrong-package-hash");
  const manifestPath = path.join(packageDirectory, "manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.package_hash = "0".repeat(64);
  await writeCanonical(manifestPath, manifest);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "PACKAGE_HASH_MISMATCH");
});

test("rejects a wrong candidate hash", async (t) => {
  const { packageDirectory } = await workspace(t, "wrong-candidate-hash");
  const candidatePath = path.join(packageDirectory, "candidate.json");
  const candidate = await readJson(candidatePath);
  candidate.candidate_hash = "0".repeat(64);
  candidate.approval_audit.candidate_hash = candidate.candidate_hash;
  await writeCanonical(candidatePath, candidate);
  const manifestPath = path.join(packageDirectory, "manifest.json");
  const manifest = await readJson(manifestPath);
  const entry = manifest.files.find((file) => file.path === "candidate.json");
  const bytes = await readFile(candidatePath);
  entry.sha256 = sha256(bytes);
  entry.byte_length = bytes.byteLength;
  manifest.candidate_hash = candidate.candidate_hash;
  manifest.package_hash = computePackageHash(manifest);
  await writeCanonical(manifestPath, manifest);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "CANDIDATE_HASH_MISMATCH");
});

test("rejects a contract version mismatch", async (t) => {
  const { packageDirectory } = await workspace(t, "contract-version");
  const manifestPath = path.join(packageDirectory, "manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.contract_version = "2.0.0";
  manifest.package_hash = computePackageHash(manifest);
  await writeCanonical(manifestPath, manifest);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "CONTRACT_VERSION_MISMATCH");
});

test("rejects the wrong target system", async (t) => {
  const { packageDirectory } = await workspace(t, "wrong-target");
  const manifestPath = path.join(packageDirectory, "manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.target_system = "not-carkey.invalid";
  manifest.package_hash = computePackageHash(manifest);
  await writeCanonical(manifestPath, manifest);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "SYSTEM_MISMATCH");
});

test("rejects a non-public content type", async (t) => {
  const { packageDirectory } = await workspace(t, "content-type");
  const manifestPath = path.join(packageDirectory, "manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.content_type = "article";
  manifest.package_hash = computePackageHash(manifest);
  await writeCanonical(manifestPath, manifest);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "CONTENT_TYPE_REJECTED");
});

test("rejects a missing synthetic flag", async (t) => {
  const { packageDirectory } = await workspace(t, "synthetic-flag");
  const manifestPath = path.join(packageDirectory, "manifest.json");
  const manifest = await readJson(manifestPath);
  delete manifest.synthetic;
  await writeCanonical(manifestPath, manifest);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "MANIFEST_SCHEMA_INVALID");
});

for (const [label, field, code] of [
  ["authorization false", "authorization_verified", "AUTHORIZATION_REQUIRED"],
  ["sanitization false", "sanitization_reviewed", "SANITIZATION_REQUIRED"],
  ["Owner approval false", "approved_for_export", "OWNER_APPROVAL_REQUIRED"]
]) {
  test(`rejects ${label}`, async (t) => {
    const { packageDirectory } = await workspace(t, field);
    const candidatePath = path.join(packageDirectory, "candidate.json");
    const candidate = await readJson(candidatePath);
    candidate.approval_audit[field] = false;
    await writeCanonical(candidatePath, candidate);
    await refreshIntegrity(packageDirectory);
    await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), code);
  });
}

test("rejects a private field nested in the candidate", async (t) => {
  const { packageDirectory } = await workspace(t, "private-field");
  const candidatePath = path.join(packageDirectory, "candidate.json");
  const candidate = await readJson(candidatePath);
  candidate.proposed_public_copy.private = { nested: { customerPhone: "SYNTHETIC" } };
  await writeCanonical(candidatePath, candidate);
  await refreshIntegrity(packageDirectory);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "PRIVATE_FIELD_REJECTED");
});

test("rejects invalid taxonomy", async (t) => {
  const { packageDirectory } = await workspace(t, "invalid-taxonomy");
  const candidatePath = path.join(packageDirectory, "candidate.json");
  const candidate = await readJson(candidatePath);
  candidate.taxonomy.generalized_city_county = "精確停車位";
  await writeCanonical(candidatePath, candidate);
  await refreshIntegrity(packageDirectory);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "INVALID_TAXONOMY");
});

test("rejects an unsupported brand", async (t) => {
  const { packageDirectory } = await workspace(t, "unsupported-brand");
  const candidatePath = path.join(packageDirectory, "candidate.json");
  const candidate = await readJson(candidatePath);
  candidate.taxonomy.vehicle_brand = "Unsupported Motors";
  await writeCanonical(candidatePath, candidate);
  await refreshIntegrity(packageDirectory);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "UNSUPPORTED_BRAND");
});

test("rejects an unsupported scenario", async (t) => {
  const { packageDirectory } = await workspace(t, "unsupported-scenario");
  const candidatePath = path.join(packageDirectory, "candidate.json");
  const candidate = await readJson(candidatePath);
  candidate.taxonomy.service_scenario = "generic_maintenance";
  await writeCanonical(candidatePath, candidate);
  await refreshIntegrity(packageDirectory);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "UNSUPPORTED_SCENARIO");
});

test("rejects a slug collision", async (t) => {
  const { packageDirectory, draftRoot } = await workspace(t, "slug-collision");
  const candidatePath = path.join(packageDirectory, "candidate.json");
  const candidate = await readJson(candidatePath);
  candidate.proposed_public_copy.proposed_slug = "article-toyota-vios-2019-changhua-akl";
  await writeCanonical(candidatePath, candidate);
  await refreshIntegrity(packageDirectory);
  await expectCode(() => importPublicationPackage({ packageDirectory, repositoryRoot: REPOSITORY_ROOT, draftRoot }), "SLUG_COLLISION");
});

test("rejects a broken internal link", async (t) => {
  const { packageDirectory } = await workspace(t, "broken-link");
  const candidatePath = path.join(packageDirectory, "candidate.json");
  const candidate = await readJson(candidatePath);
  candidate.taxonomy.suggested_existing_internal_links[2] = "/missing-wave1-route";
  await writeCanonical(candidatePath, candidate);
  await refreshIntegrity(packageDirectory);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "BROKEN_INTERNAL_LINK");
});

test("rejects an image dimension mismatch", async (t) => {
  const { packageDirectory } = await workspace(t, "dimension-mismatch");
  const candidatePath = path.join(packageDirectory, "candidate.json");
  const candidate = await readJson(candidatePath);
  candidate.assets[0].width = 1199;
  await writeCanonical(candidatePath, candidate);
  await refreshIntegrity(packageDirectory);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "ASSET_DIMENSION_MISMATCH");
});

test("rejects an image MIME mismatch", async (t) => {
  const { packageDirectory } = await workspace(t, "mime-mismatch");
  const candidatePath = path.join(packageDirectory, "candidate.json");
  const candidate = await readJson(candidatePath);
  candidate.assets[0].mime = "image/png";
  await writeCanonical(candidatePath, candidate);
  await refreshIntegrity(packageDirectory);
  const manifestPath = path.join(packageDirectory, "manifest.json");
  const manifest = await readJson(manifestPath);
  manifest.files.find((entry) => entry.path.startsWith("assets/")).mime = "image/png";
  manifest.package_hash = computePackageHash(manifest);
  await writeCanonical(manifestPath, manifest);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "ASSET_MIME_MISMATCH");
});

test("rejects EXIF or GPS metadata indicators", async (t) => {
  const { packageDirectory } = await workspace(t, "metadata");
  const assetPath = path.join(packageDirectory, "assets/synthetic-toyota-vios-case.svg");
  const assetSource = await readFile(assetPath, "utf8");
  await writeFile(assetPath, assetSource.replace("</svg>", "<metadata>GPS synthetic marker</metadata></svg>"));
  const candidatePath = path.join(packageDirectory, "candidate.json");
  const candidate = await readJson(candidatePath);
  candidate.assets[0].sha256 = sha256(await readFile(assetPath));
  await writeCanonical(candidatePath, candidate);
  await refreshIntegrity(packageDirectory);
  await expectCode(() => verifyPublicationPackage(packageDirectory, REPOSITORY_ROOT), "ASSET_METADATA_REJECTED");
});

test("reuses the same package without rewriting bytes", async (t) => {
  const { packageDirectory, draftRoot } = await workspace(t, "idempotent");
  const first = await importPublicationPackage({ packageDirectory, repositoryRoot: REPOSITORY_ROOT, draftRoot });
  const before = await readFile(path.join(first.candidateDirectory, "import-receipt.json"));
  const second = await importPublicationPackage({ packageDirectory, repositoryRoot: REPOSITORY_ROOT, draftRoot });
  const after = await readFile(path.join(second.candidateDirectory, "import-receipt.json"));
  assert.equal(second.operation, "reused");
  assert.deepEqual(after, before);
});

test("rejects a tampered existing receipt during reuse", async (t) => {
  const { packageDirectory, draftRoot } = await workspace(t, "receipt-tamper");
  const first = await importPublicationPackage({ packageDirectory, repositoryRoot: REPOSITORY_ROOT, draftRoot });
  const receiptPath = path.join(first.candidateDirectory, "import-receipt.json");
  const receipt = await readJson(receiptPath);
  receipt.unexpected_private_state = true;
  await writeCanonical(receiptPath, receipt);
  await expectCode(() => importPublicationPackage({ packageDirectory, repositoryRoot: REPOSITORY_ROOT, draftRoot }), "IMPORT_RECEIPT_INVALID");
});

test("raises a typed conflict for the same candidate ID with a different package hash", async (t) => {
  const { root, packageDirectory, draftRoot } = await workspace(t, "conflict");
  const first = await importPublicationPackage({ packageDirectory, repositoryRoot: REPOSITORY_ROOT, draftRoot });
  const conflicting = path.join(root, "conflicting-package");
  await cp(packageDirectory, conflicting, { recursive: true });
  const candidatePath = path.join(conflicting, "candidate.json");
  const candidate = await readJson(candidatePath);
  const originalId = candidate.candidate_id;
  candidate.proposed_public_copy.sanitized_summary += " 另一個已雜湊版本";
  await writeCanonical(candidatePath, candidate);
  const refreshed = await refreshIntegrity(conflicting, { deriveCandidateId: false });
  assert.equal(refreshed.candidate.candidate_id, originalId);
  assert.notEqual(refreshed.manifest.package_hash, first.receipt.package_hash);
  await expectCode(() => importPublicationPackage({ packageDirectory: conflicting, repositoryRoot: REPOSITORY_ROOT, draftRoot }), "CANDIDATE_PACKAGE_CONFLICT");
});

test("keeps output deploy-excluded and leaves sitemap and public root HTML unchanged", async (t) => {
  const { packageDirectory, draftRoot } = await workspace(t, "deployment-boundary");
  const protectedPaths = ["sitemap.xml", "index.html", "cases.html", "article-toyota-vios-2019-changhua-akl.html"];
  const before = Object.fromEntries(await Promise.all(protectedPaths.map(async (name) => [name, sha256(await readFile(path.join(REPOSITORY_ROOT, name)))])));
  const result = await importPublicationPackage({ packageDirectory, repositoryRoot: REPOSITORY_ROOT, draftRoot });
  const after = Object.fromEntries(await Promise.all(protectedPaths.map(async (name) => [name, sha256(await readFile(path.join(REPOSITORY_ROOT, name)))])));
  assert.deepEqual(after, before);
  assert.equal(result.receipt.sitemap_modified, false);
  assert.equal(result.receipt.public_root_modified, false);
  const vercelIgnore = await readFile(path.join(REPOSITORY_ROOT, ".vercelignore"), "utf8");
  assert.match(vercelIgnore, /^drafts\/$/m);
});

test("performs no network call", async (t) => {
  const { packageDirectory, draftRoot } = await workspace(t, "no-network");
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("network denied");
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const result = await importPublicationPackage({ packageDirectory, repositoryRoot: REPOSITORY_ROOT, draftRoot });
  assert.equal(result.receipt.network_used, false);
  assert.equal(fetchCalls, 0);
  const source = await readFile(path.join(REPOSITORY_ROOT, "scripts/publication/publication-import.mjs"), "utf8");
  assert.doesNotMatch(source, /from ["']node:(?:https?|net|tls)["']|\bglobalThis\.fetch\s*\(|\bawait\s+fetch\s*\(/);
});
