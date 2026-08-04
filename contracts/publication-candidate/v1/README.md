# Publication Candidate Contract v1.0.0

This directory is the coordination copy for the no-network CasePilot → CarKey Wave 1 handoff. The same five files are mirrored byte-for-byte in both product repositories. The integration workspace is not a runtime, package registry, API, database, or Git repository.

## Authority boundary

- CasePilot owns private cases, authorization evidence, sanitization, candidate construction, and package export.
- CarKey owns taxonomy acceptance, title/description edits, draft rendering, the eventual final slug and canonical URL, schema, breadcrumb, sitemap, redirects, public assets, publication date, merge, and deployment.
- A package is safe to inspect as a whole. It must never contain customer identity/contact data, exact location, plate, VIN, raw conversation, private evidence, credentials, environment values, or operational vehicle-security instructions.
- Wave 1 is synthetic-only and produces a deploy-excluded draft. It does not publish.

## Package layout

```text
<package-root>/
  manifest.json
  candidate.json
  assets/
    <sanitized-public-assets>
```

`manifest.json` is not listed inside its own `files[]`. `files[]` contains exactly `candidate.json` plus every asset, sorted by path. Unlisted files cause consumer rejection.

## Canonical JSON and hashes

Canonical JSON is UTF-8 JSON with object keys recursively sorted, array order preserved, no insignificant whitespace, and exactly one trailing LF when written as a file.

1. `candidate_hash` is SHA-256 of canonical JSON for the complete candidate after setting root `candidate_id` and root `candidate_hash` to empty strings and setting `approval_audit.candidate_hash` to an empty string.
2. `candidate_id` is `cpc_` plus the first 16 lowercase hexadecimal characters of `candidate_hash`.
3. `approval_audit.candidate_hash` repeats the root `candidate_hash`, binding approval to the exact candidate projection.
4. Each `files[]` hash is SHA-256 over the exact file bytes. Byte length is the exact byte count.
5. `package_hash` is SHA-256 of canonical JSON for the complete manifest after setting only `package_hash` to an empty string.
6. `CHECKSUMS.sha256` covers the three schemas and this README. It does not cover itself.

Source hashes in the transferable candidate may cover only the already-sanitized projection or approved public assets. A private identifier, contact value, document, raw evidence, or other low-entropy private value must never be exposed even as an unsalted digest.

## Assets

Wave 1 accepts only a deterministic synthetic `image/svg+xml` asset at exactly 1200×630. The producer and consumer both reject scripts, external references, metadata elements, EXIF/GPS terms, dimension mismatches, MIME mismatches, unsanitized status, or missing synthetic public-use approval. This bounded type can be expanded only in a later contract version after an independently reviewed image pipeline exists.

## Import behavior

- The importer validates paths, schemas/invariants, every byte hash and length, candidate and package hashes, approvals, public-field privacy, taxonomy, real internal links, slug collisions, asset safety, and deployment exclusion before writing.
- The first accepted import creates `drafts/casepilot/<candidate-id>/` atomically.
- Reimporting the same candidate ID and package hash returns `reused` to the caller and does not rewrite the saved receipt or draft bytes.
- The same candidate ID with a different package hash raises the typed conflict `CANDIDATE_PACKAGE_CONFLICT` and writes nothing.
- Unknown contract versions, targets, content types, private fields, unsafe prose, unlisted files, and all mismatches fail closed.

## Human gates

CasePilot export requires an authorization attestation, sanitization review, and Owner-role approval bound to the candidate hash. CarKey import only creates a local, noindex, deploy-excluded draft. Owner review, promotion, registry/sitemap changes, merge, and deployment are later explicit actions and are not implemented by this contract.
