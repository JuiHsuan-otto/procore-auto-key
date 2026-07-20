# Service-area schema BMW case rollout 2

Date: 2026-07-19
Base: `HEAD@2d60534b779d29562462130d953e619b2e82005f`
Status: local implementation prepared; not committed, pushed, merged, or deployed

## Problem and business value

The governed business source keeps `serviceArea` empty, unverified, and unpublished. Five more BMW case pages still attach regional coverage to the shared `#business` node, although individual case locations do not establish business-wide service coverage. Omitting this optional property reduces unsupported entity claims and keeps the migration evidence-gated.

This is P0 schema integrity work. It reduces compliance and search-engine consistency risk without changing customer-facing content or the enquiry journey.

## Scope

Only the shared typed business node loses `areaServed` on:

1. `article-bmw-528-2015-yunlin-akl.html`
2. `article-bmw-730d-kaohsiung-auction-akl.html`
3. `article-bmw-740-yuanli-akl.html`
4. `article-bmw-gseries-keyless-rescue.html`
5. `article-bmw-gt535i-renwu-akl.html`

Each page has one typed shared business node and no page-specific `Service.areaServed`. The governance register adds BMW case batch 2 and changes the local candidate remainder from 92 files／92 nodes to 87 files／87 nodes. Because the preceding three-page pilot and five-page BMW batch 1 remain uncommitted against the same HEAD, the current HEAD-delta comparator intentionally contains all 13 local HTML deltas.

## Out of scope

- No other BMW, case, location, language, hub, or utility page is authorized.
- No visible copy, URL, canonical, sitemap, robots, title, description, H1, breadcrumb, FAQ, image, navigation, CTA, CSS, price, availability claim, or Analytics behavior changes.
- No service-area claim is verified by this deletion.
- No commit, push, PR, merge, Vercel change, or Production deployment.

## Verification contract

- The five HTML files may differ from `HEAD` only by their exact registered shared-business `areaServed` removal.
- The preceding eight local case deltas must retain the same exact-delta protection.
- All 134 registered schema pages must parse and retain exactly one typed shared business node.
- Governance must report 87 files／87 shared-business nodes remaining and reject reintroduction on all governed pages.
- SEO foundation, 135-page site validation, measurement audit, schema self-tests, diff check, and local HTTP smoke on these five pages must pass.

## Analytics verification level

- **Static verified:** required before handoff through the existing measurement audit.
- **Browser verified:** none in this batch.
- **Not verified:** browser event-name, count, parameter, and network-payload behavior are not repeated because no interactive or Analytics code changes; no runtime claim is made.

## Verification results

- `npm run validate:schema-rollout -- --self-test --compare-head` passed: 134 schema pages, 0 errors; all 13 local case-page deltas are exact removals from the shared HEAD.
- `npm run validate:governance` passed: 87 files／87 shared-business nodes remaining, 2 known warnings, 0 errors.
- `npm run test:seo-foundation` passed, including conversion runtime tests, inventory drift checks, governance negative gates, public deployment boundary checks, and schema self-tests.
- `npm run validate:site` passed: 135 HTML files, 0 warnings, 0 errors.
- `npm run audit:measurement` passed: 135 pages, 0 warnings, 0 errors; Static CTA taxonomy verified.
- Local HTTP smoke passed on all five pages: HTTP 200, one H1, parseable JSON-LD, one typed shared business node, and zero shared-business `areaServed` properties per page. One page contains three JSON-LD blocks and four pages contain two, matching their existing templates.
- The temporary preview was bound only to `127.0.0.1` and stopped after validation.

## Point-in-time Production baseline

Captured at `2026-07-19T13:46:20+08:00` (Asia/Taipei). A live `git ls-remote` immediately beforehand confirmed `refs/heads/main` at `f616264a67a40474ed159137d1cc7c0c450a2de6`. This is an immutable observation, not a permanent test truth; later Production changes must be reported as drift rather than rewriting this record or Production.

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

Summary: 7 checked, 7 match, 0 drift. No Production mutation, click, deployment, or rewrite of an earlier baseline occurred.

## Risk and rollback

Risk is limited to omitting one optional structured-data property from five shared business nodes and registering the exact local delta. Regression gates still cover every previously governed file. Rollback is the exact inverse of the five JSON-LD deletions plus removal of this stage from the migration source, comparator, governance, and documentation. No URL, visible content, database, or Production data migration is involved.

## Suggested commit boundary

`fix(seo): continue evidence-gated service areas on BMW cases`
