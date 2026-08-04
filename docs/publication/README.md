# Verified publication draft import

CarKey is the final public-content, canonical URL, SEO, schema, sitemap, redirect, public-asset, merge, and deployment authority. Wave 1 accepts a manually moved, synthetic, hashed package and creates only a local deploy-excluded draft.

## Verify and import

```bash
npm run publication:verify-contract
node scripts/publication/import-casepilot-package.mjs --package /absolute/path/to/package
```

The output is `drafts/casepilot/<candidate-id>/`:

```text
draft.html
candidate-public.json
import-receipt.json
validation-report.json
assets/
```

`drafts/` is gitignored and excluded by `.vercelignore`; `vercel.json` also supplies a noindex header as defense in depth. The HTML itself is `noindex, nofollow, noarchive`, has no canonical or production URL, and is absent from sitemap, redirects, blog/case registries, and public root pages.

## Fail-closed verification

Before writing, the importer checks contract and package versions, strict object fields, source/target/content type, synthetic/no-network flags, file set, byte lengths, SHA-256 values, candidate and package hashes, approval binding, privacy fields and patterns, CarKey taxonomy, service-route consistency, real internal links, slug collisions, exact 1200×630 SVG bytes, MIME, metadata/active content, alt text, and synthetic public-use approval.

The CarKey adapter is based on three recent case structures:

- `article-toyota-vios-2019-changhua-akl.html`
- `article-honda-hrv-2020-all-lost-changhua.html`
- `case-hyundai-venue-smartkey-lost.html`

It preserves ProCore branding, a location/year/brand/model/scenario title, conditional language, generalized location, Article and breadcrumb draft inputs, existing `/rescue-request` CTA routing, and existing clean internal links. Legacy copy is evidence of structure, not permission to repeat unsupported time/price/towing claims.

## Idempotency and rejection

- Same candidate ID and package hash: verifies again, returns `reused`, and leaves the existing draft and receipt unchanged.
- Same candidate ID and different package hash: typed `CANDIDATE_PACKAGE_CONFLICT`; no overwrite.
- To reject a candidate, retain no generated draft and report the typed code. The importer never weakens CarKey rules.

Common codes include `MISSING_MANIFEST`, `MISSING_CANDIDATE`, `MISSING_ASSET`, `FILE_HASH_MISMATCH`, `PACKAGE_HASH_MISMATCH`, `CANDIDATE_HASH_MISMATCH`, `CONTRACT_VERSION_MISMATCH`, `AUTHORIZATION_REQUIRED`, `SANITIZATION_REQUIRED`, `OWNER_APPROVAL_REQUIRED`, `PRIVATE_FIELD_REJECTED`, `INVALID_TAXONOMY`, `UNSUPPORTED_BRAND`, `UNSUPPORTED_SCENARIO`, `SLUG_COLLISION`, `BROKEN_INTERNAL_LINK`, `ASSET_DIMENSION_MISMATCH`, `ASSET_MIME_MISMATCH`, and `ASSET_METADATA_REJECTED`.

## Human review and future publication

Review `draft.html`, `candidate-public.json`, the asset, `validation-report.json`, and `import-receipt.json`. Owner review may reject or request a new CasePilot candidate revision. A future, separately authorized CarKey promotion step would choose the final slug, public asset paths, canonical, schema graph, breadcrumb, publication date, registries, sitemap, redirects, PR, merge, and deployment. None of those mutations exists in Wave 1.
