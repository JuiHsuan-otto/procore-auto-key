# Service-area schema location rollout 2

Date: 2026-07-20
Base: `HEAD@2d60534b779d29562462130d953e619b2e82005f`
Status: local implementation prepared; not committed, pushed, merged, or deployed

## Problem and business value

The governed business source keeps `serviceArea` empty, unverified, and unpublished. Three more location pages still attached the same page-specific place list both to the shared `#business` node and to the page's own `Service` node. The page content and `Service.areaServed` remain useful page-specific semantics, but they do not independently verify a business-wide service area for the shared entity.

This is P0 schema-integrity work. It removes an unsupported shared-business claim while preserving the local landing-page meaning and every customer contact path.

## Scope

The `location-page-shared-business-batch-2` stage contains:

1. `hsinchu-city-car-key.html`
2. `hsinchu-county-car-key.html`
3. `hualien-car-key.html`

Only the first matching `areaServed` property on the typed shared node with `@id=https://www.carkey.com.tw/#business` is removed. Each HEAD file contains its exact place array twice: first on the shared LocalBusiness and then on the page-specific Service. The exact comparator requires two source occurrences, removes only the first, and proves the second Service property retains the original values.

The governance register changes the local candidate remainder from 19 files／19 nodes to 16 files／16 nodes. This deletion does not verify any business service area and does not authorize changing the remaining location pages.

## Out of scope

- No visible district, city, service-area, travel, or landing-page copy changes.
- No page-specific `Service.areaServed`, provider relationship, FAQ, Breadcrumb, WebPage, LocalBusiness contact field, URL, canonical, sitemap, robots, title, description, H1, image, navigation, CTA, CSS, price, availability, or Analytics changes.
- No new service-area evidence, location, address, opening hours, response time, or business claim.
- No commit, push, PR, merge, Vercel change, or Production deployment.

## Verification contract

- Each batch HTML file may differ from `HEAD` only by the exact first shared-business `areaServed` deletion.
- The preceding 81 local HTML deltas must retain the same exact-delta protection.
- All 134 registered schema pages must parse and retain exactly one typed shared business node.
- Each batch page must retain exactly one page-specific `Service.areaServed` array with the original place values and zero additional LocalBusiness nodes.
- Governance must report 16 files／16 typed shared-business nodes remaining and reject reintroduction on every governed page.
- SEO foundation, 135-page site validation, measurement audit, schema self-tests, diff check, and local HTTP smoke on these three pages must pass.

## Analytics verification level

- **Static verified:** the existing measurement audit passed across all 135 pages and proves CTA click paths do not emit `generate_lead`.
- **Browser verified:** none in this batch.
- **Not verified:** browser event-name, count, parameter, and network-payload behavior are not repeated because no interactive or Analytics code changes; no runtime claim is made.

## Verification results

- `npm run validate:schema-rollout -- --self-test --compare-head`: passed across 134 registered schema pages; all 84 local HTML deltas match their exact registered transformation and the comparator reported 0 errors.
- `npm run validate:governance`: passed with 16 files／16 typed shared-business nodes remaining, 2 known warnings, and 0 errors.
- `npm run test:seo-foundation`: passed, including schema self-tests, governance negative gates, deployment-boundary validation, deterministic inventory, and conversion runtime tests.
- `npm run validate:site`: passed across 135 HTML pages with 0 warnings and 0 errors.
- `npm run audit:measurement`: passed across 135 pages with 0 warnings and 0 errors; this supports only the Static verified claim above.
- `git diff --check`: passed.
- Loopback HTTP smoke: all three pages returned HTTP 200, retained exactly one H1 and one typed shared business node, had parseable JSON-LD, and contained zero shared-business `areaServed`. Each retained exactly one page-specific Service with its original area list: 5 values for Hsinchu City, 7 for Hsinchu County, and 7 for Hualien. All three retained zero additional LocalBusiness nodes. The temporary loopback server was stopped after validation.

## Point-in-time Production baseline

Captured at `2026-07-20T06:03:05+08:00` (Asia/Taipei). A live `git ls-remote` immediately beforehand confirmed `refs/heads/main` at `f616264a67a40474ed159137d1cc7c0c450a2de6`. This is an immutable observation, not a permanent test truth; later Production changes must be reported as drift rather than rewriting this record or Production.

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

Baseline summary: 7 checked, 7 match, 0 drift. The end-of-run `git ls-remote` check still returned `f616264a67a40474ed159137d1cc7c0c450a2de6`; remote `main` did not move during the batch. A separate read-only comparison captured at `2026-07-20T06:07:41+08:00` again returned 7 match／0 drift, so the observed Production bodies also remained aligned with that SHA through the end of the batch. No Production mutation, click, deployment, or rewrite of an earlier baseline occurred.

## Risk and rollback

The primary risk is accidentally deleting the page-specific Service property because its place list matches the shared LocalBusiness property. The exact two-occurrence guard, first-only removal, semantic HEAD comparator, and HTTP smoke make that failure detectable. Rollback is the exact inverse of the three shared-node deletions plus removal of this stage from the migration source, comparator, governance, and documentation. No visible content, URL, database, or Production migration is involved.

## Suggested commit boundary

`fix(seo): continue evidence-gated location page cleanup`
