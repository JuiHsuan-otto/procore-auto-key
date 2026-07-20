# Service-area schema hub／utility rollout 1

Date: 2026-07-20
Base: `HEAD@2d60534b779d29562462130d953e619b2e82005f`
Status: local implementation prepared; not committed, pushed, merged, or deployed

## Problem and business value

The governed business source keeps `serviceArea` empty, unverified, and unpublished. The blog hub, case hub, and electronic business-card utility page still attach the same regional list to the typed shared `#business` node. A collection page or contact utility page does not prove business-wide service coverage. Omitting the optional shared property reduces unsupported entity claims while preserving every customer path and all visible content.

This is P0 schema-integrity work. It starts the remaining non-location hub／utility scope in one reversible three-page batch and keeps every accumulated local page delta protected by an exact HEAD comparator.

## Scope

The `hub-utility-page-batch-1` stage contains:

1. `blog.html`
2. `cases.html`
3. `vcard.html`

Only `areaServed` on the typed shared node with `@id=https://www.carkey.com.tw/#business` is removed. All three pages have no page-specific `Service.areaServed` and no second LocalBusiness node. CollectionPage／WebPage schema, electronic-card identity details, contact links, and visible content remain unchanged.

The governance register changes the local candidate remainder from 28 files／28 nodes to 25 files／25 nodes. Since earlier local batches remain uncommitted against the same HEAD, the current HEAD-delta comparator intentionally contains all 75 local HTML deltas. This batch does not close or verify the broader hub／utility or service-area scope.

## Out of scope

- No article, case detail, language, service-area hub, or location page is authorized.
- No visible copy, URL, canonical, sitemap, robots, title, description, H1, breadcrumb, image, navigation, CTA, CSS, price, availability claim, or Analytics behavior changes.
- No page-specific Service or other LocalBusiness entity is removed, generalized, or promoted to business evidence.
- No service-area claim is verified by this deletion.
- No commit, push, PR, merge, Vercel change, or Production deployment.

## Verification contract

- The three HTML files may differ from `HEAD` only by their exact registered typed shared-business `areaServed` removal.
- The preceding seventy-two local HTML deltas must retain the same exact-delta protection.
- All 134 registered schema pages must parse and retain exactly one typed shared business node.
- Each batch page must retain zero page-specific `Service.areaServed` and zero additional LocalBusiness nodes.
- Governance must report 25 files／25 typed shared-business nodes remaining and reject reintroduction on every governed page.
- SEO foundation, 135-page site validation, measurement audit, schema self-tests, diff check, and local HTTP smoke on these three pages must pass.

## Analytics verification level

- **Static verified:** the existing measurement audit proves CTA click paths do not emit `generate_lead`.
- **Browser verified:** none in this batch.
- **Not verified:** browser event-name, count, parameter, and network-payload behavior are not repeated because no interactive or Analytics code changes; no runtime claim is made.

## Verification results

- `npm run validate:schema-rollout -- --self-test --compare-head` passed: 134 schema pages, 0 errors; all 75 local HTML deltas are exact registered typed shared-business removals from the same HEAD.
- `npm run validate:governance` passed: 25 files／25 typed shared-business nodes remaining, 2 known warnings, 0 errors.
- `npm run test:seo-foundation` passed, including conversion runtime tests, inventory drift checks, governance negative gates, public deployment boundary checks, and schema self-tests.
- `npm run validate:site` passed: 135 HTML files, 0 warnings, 0 errors.
- `npm run audit:measurement` passed: 135 pages, 0 warnings, 0 errors; Static CTA taxonomy verified.
- Local HTTP smoke passed on all three `.html` files: HTTP 200, one H1, parseable JSON-LD, one typed shared business node, zero typed shared-business `areaServed`, zero page-specific `Service.areaServed`, and zero additional LocalBusiness nodes.
- `git diff --check` passed. The temporary preview was bound only to `127.0.0.1` and stopped after validation.

## Point-in-time Production baseline

Captured at `2026-07-20T02:58:40+08:00` (Asia/Taipei). A live `git ls-remote` immediately beforehand confirmed `refs/heads/main` at `f616264a67a40474ed159137d1cc7c0c450a2de6`. This is an immutable observation, not a permanent test truth; later Production changes must be reported as drift rather than rewriting this record or Production.

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

Summary: 7 checked, 7 match, 0 drift. An end-of-run read-only query again returned remote `main@f616264a67a40474ed159137d1cc7c0c450a2de6`, so no upstream SHA drift was observed after capture. No Production mutation, click, deployment, or rewrite of an earlier baseline occurred.

## Risk and rollback

Risk is limited to omitting one optional structured-data property from three typed shared business nodes and registering the exact local delta. Regression gates still cover every previously governed file. Rollback is the exact inverse of the three JSON-LD deletions plus removal of this stage from the migration source, comparator, governance, and documentation. No URL, visible content, database, or Production data migration is involved.

## Suggested commit boundary

`fix(seo): start hub and utility service-area cleanup`
