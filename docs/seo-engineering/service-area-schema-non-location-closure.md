# Service-area schema non-location closure

Date: 2026-07-20
Base: `HEAD@2d60534b779d29562462130d953e619b2e82005f`
Status: local implementation prepared; not committed, pushed, merged, or deployed

## Problem and business value

The governed business source keeps `serviceArea` empty, unverified, and unpublished. One remaining case detail, one Vietnamese-language service page, and the service-area hub still attach regional lists to the typed shared `#business` node. Case location, translated marketing copy, and a visible location directory do not independently provide the evidence required to publish a business-wide service area in the shared entity.

This is P0 schema-integrity work. It closes the non-location typed shared-business scope in one reversible three-page batch, reducing unsupported entity claims while preserving the service-area directory, language content, case evidence, and every customer path.

## Scope

The `non-location-page-closure` stage contains:

1. `case-hyundai-venue-smartkey-lost.html`
2. `dich-vu-lam-khoa-xe-o-to-tai-dai-loan.html`
3. `service-areas.html`

Only `areaServed` on the typed shared node with `@id=https://www.carkey.com.tw/#business` is removed. All three pages have no page-specific `Service.areaServed` and no second LocalBusiness node. The visible location directory and checker, ItemList／CollectionPage／Article／WebPage schema, translated copy, case details, contact links, and all existing URLs remain unchanged.

The governance register changes the local candidate remainder from 25 files／25 nodes to 22 files／22 nodes. Since earlier local batches remain uncommitted against the same HEAD, the current HEAD-delta comparator intentionally contains all 78 local HTML deltas. Every remaining typed shared-business `areaServed` node is on a location page; this does not verify those service areas or authorize altering their page-specific `Service.areaServed`.

## Out of scope

- No location page is authorized in this batch.
- No visible service-area copy, directory entry, checker behavior, URL, canonical, sitemap, robots, title, description, H1, breadcrumb, image, navigation, CTA, CSS, price, availability claim, or Analytics behavior changes.
- No page-specific Service or other LocalBusiness entity is removed, generalized, or promoted to business evidence.
- No service-area claim is verified by this deletion.
- No commit, push, PR, merge, Vercel change, or Production deployment.

## Verification contract

- The three HTML files may differ from `HEAD` only by their exact registered typed shared-business `areaServed` removal.
- The preceding seventy-five local HTML deltas must retain the same exact-delta protection.
- All 134 registered schema pages must parse and retain exactly one typed shared business node.
- Each batch page must retain zero page-specific `Service.areaServed` and zero additional LocalBusiness nodes.
- Governance must report 22 files／22 typed shared-business nodes remaining, all on location pages, and reject reintroduction on every governed page.
- SEO foundation, 135-page site validation, measurement audit, schema self-tests, diff check, and local HTTP smoke on these three pages must pass.

## Analytics verification level

- **Static verified:** the existing measurement audit passed across all 135 pages and proves CTA click paths do not emit `generate_lead`.
- **Browser verified:** none in this batch.
- **Not verified:** browser event-name, count, parameter, and network-payload behavior are not repeated because no interactive or Analytics code changes; no runtime claim is made.

## Verification results

- `npm run validate:schema-rollout -- --self-test --compare-head`: passed across 134 registered schema pages; all 78 local HTML deltas match their exact registered transformation and the comparator reported 0 errors.
- `npm run validate:governance`: passed with 22 files／22 typed shared-business nodes remaining, 2 known warnings, and 0 errors. All 22 remaining nodes are on location pages.
- `npm run test:seo-foundation`: passed, including schema self-tests, governance negative gates, deployment-boundary validation, deterministic inventory, and conversion runtime tests.
- `npm run validate:site`: passed across 135 HTML pages with 0 warnings and 0 errors.
- `npm run audit:measurement`: passed across 135 pages with 0 warnings and 0 errors; this supports only the Static verified claim above.
- `git diff --check`: passed.
- Loopback HTTP smoke: all three batch pages returned HTTP 200, retained exactly one H1 and one typed shared business node, had parseable JSON-LD, and contained zero shared-business `areaServed`, zero page-specific `Service.areaServed`, and zero additional LocalBusiness nodes. The temporary loopback server was stopped after validation.

## Point-in-time Production baseline

Captured at `2026-07-20T03:59:27+08:00` (Asia/Taipei). A live `git ls-remote` immediately beforehand confirmed `refs/heads/main` at `f616264a67a40474ed159137d1cc7c0c450a2de6`. This is an immutable observation, not a permanent test truth; later Production changes must be reported as drift rather than rewriting this record or Production.

All seven Production responses returned HTTP 200. Headers reported `server: Vercel`, `cache-control: public, max-age=0, must-revalidate`, `x-vercel-cache: HIT`, and `last-modified` between `Sun, 19 Jul 2026 02:33:22 GMT` and `02:33:26 GMT`. Content types were appropriate for HTML, robots, sitemap, and JavaScript. All corresponding remote-main raw files returned HTTP 200.

| Production path | HTTP | Production body SHA-256 | Remote-main result |
|---|---:|---|---|
| `/` | 200 | `480164c97664202491c9fedda58f2c503f0cc8d677cdeda6e41d04de1b98e1ee` | match |
| `/robots.txt` | 200 | `bc142a6d95fed6f1aeded7e48624a0e37975ae760d3d8a6070d75a04fbcd3e45` | match |
| `/sitemap.xml` | 200 | `7ed526b576cf1eb29b44fbfeb35c87bcef05be5a4465d4242eb11b6725dc60e5` | match |
| `/car-key-lost-service` | 200 | `759ff137c2ef24b9598dfc08a10a64200c4d02f399fe90aea7e08255ff326b51` | match |
| `/article-bmw-smart-key-owner-guide` | 200 | `cd18cd05c9d3dab113e6d912ab72f687e0d6259d2ee54b8068d605f9ec5ec401` | match |
| `/article-audi-r8-neihu-all-keys-lost` | 200 | `1a9da3d58062e66dfbc3a0fc5146efa3b3e63346ec5e2c91942ebdcaf71ea4f9` | match |
| `/assets/js/procore-conversion-tracking.js` | 200 | `10969a911352e4a62903a93d249a932a0039f02a03371a6e7150c12a2534dd7b` | match |

Summary: 7 checked, 7 match, 0 drift. The end-of-run `git ls-remote` check still returned `f616264a67a40474ed159137d1cc7c0c450a2de6`; remote `main` did not move during the batch. A separate read-only comparison captured at `2026-07-20T04:06:00+08:00` again returned 7 match／0 drift, so the observed Production bodies also remained aligned with that SHA through the end of the batch. No Production mutation, click, deployment, or rewrite of an earlier baseline occurred.

## Risk and rollback

Risk is limited to omitting one optional structured-data property from three typed shared business nodes and registering the exact local delta. The service-area hub's visible content and all page-specific location semantics remain protected by the comparator. Rollback is the exact inverse of the three JSON-LD deletions plus removal of this stage from the migration source, comparator, governance, and documentation. No URL, visible content, database, or Production data migration is involved.

## Suggested commit boundary

`fix(seo): close non-location service-area cleanup`
