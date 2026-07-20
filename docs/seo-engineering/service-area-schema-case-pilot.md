# Service-area schema case-page pilot

Date: 2026-07-19
Base: `HEAD@2d60534b779d29562462130d953e619b2e82005f`
Status: local implementation prepared; not committed, pushed, merged, or deployed

## Problem and business value

The governed business source keeps `serviceArea` empty, unverified, and unpublished, while three previously validated case templates still publish regional coverage on the shared `#business` node. Omitting that optional property reduces the risk of representing unsupported business-wide coverage to search engines without changing the case narrative or customer journey.

The clean-tree `--compare-head` gate also produced 33 false failures after the preceding rollout was committed. It reapplied historical removals to a HEAD where those fields were already absent. This pilot separates the full governed regression allowlist from the current HEAD-delta allowlist so later controlled commits remain independently verifiable.

Priority is P0 for comparator reliability and P1 for the three-page schema correction. The change reduces compliance risk and improves the efficiency of future evidence-gated batches.

## Scope

Only the shared typed business node loses `areaServed` on:

1. `article-audi-r8-neihu-all-keys-lost.html`
2. `article-bmw-elv-red-lock-fix.html`
3. `case-shetou-mazda-cx30-rescue.html`

All three pages have one typed shared business definition and no page-specific `Service.areaServed`. The governance register records a three-page case pilot and changes the explicit remainder from 100 files／100 nodes to 97 files／97 nodes.

The schema comparator continues to reject `areaServed` on every governed page, but only transforms the three current case files when constructing the expected HTML and JSON-LD from `HEAD`. Historical rollout pages must match their already-compliant HEAD bytes unchanged.

## Out of scope

- No remaining BMW, article/case, location, language, hub, or utility page is authorized by this pilot.
- No visible case copy, URL, canonical, sitemap, robots, title, description, H1, breadcrumb, FAQ, image, navigation, CTA, CSS, or Analytics behavior changes.
- No service-area claim is verified by this deletion.
- No commit, push, PR, merge, Vercel configuration change, or Production deployment.

## Verification contract

- The three HTML files may differ from `HEAD` only by the exact registered shared-business `areaServed` removal.
- Clean historical rollout files must no longer produce false `HEAD business areaServed baseline count drifted` failures.
- All 134 registered schema pages must parse and retain exactly one typed shared business node.
- Governance must report 97 files／97 shared-business nodes remaining and reject reintroduction on all governed pages.
- SEO foundation, 135-page site validation, measurement audit, schema self-tests, diff check, and representative local HTTP checks must pass.

## Verification results

- Clean-tree pre-write `npm run validate:schema-rollout -- --self-test --compare-head` reproduced 33 false `HEAD business areaServed baseline count drifted` failures on historical rollout pages.
- After separating the full regression allowlist from the three-file current HEAD-delta allowlist, the same command passed with 134 schema pages and 0 errors.
- `npm run test:seo-foundation` passed, including conversion runtime tests, inventory drift checks, governance negative gates, public deployment boundary checks, and schema self-tests.
- `npm run validate:site` passed: 135 HTML files, 0 warnings, 0 errors.
- `npm run audit:measurement` passed: 135 pages, 0 warnings, 0 errors; Static CTA taxonomy verified.
- Governance passed with an explicit 97-file／97-node remainder, 2 known warnings, and 0 errors.
- `git diff --check` passed.
- Local HTTP smoke passed on all three pages: HTTP 200, one H1, two valid JSON-LD blocks, one typed shared business node, and zero shared-business `areaServed` properties per page.

## Analytics verification level

- **Static verified:** the existing measurement audit must continue to prove click paths do not emit `generate_lead`.
- **Browser verified:** none in this batch.
- **Not verified:** browser event-name, count, parameter, and network-payload behavior were not repeated because no interactive or Analytics code changed; no runtime claim is made.

## Point-in-time Production baseline

Captured at `2026-07-19T11:47:10+08:00` (Asia/Taipei). A live `git ls-remote` immediately beforehand confirmed `refs/heads/main` at `f616264a67a40474ed159137d1cc7c0c450a2de6`. This is an immutable observation, not a permanent test truth; later Production changes must be reported as drift rather than rewriting this record or Production.

All seven Production responses returned HTTP 200. Headers reported `server: Vercel`, `cache-control: public, max-age=0, must-revalidate`, `x-vercel-cache: HIT`, and `last-modified` between `Sun, 19 Jul 2026 02:33:22 GMT` and `02:33:26 GMT`. Content types were `text/html; charset=utf-8` for HTML, `text/plain; charset=utf-8` for robots, `application/xml` for sitemap, and `application/javascript; charset=utf-8` for the tracking asset. All corresponding remote-main raw files returned HTTP 200.

| Production path | HTTP | Production body SHA-256 | Remote-main result |
|---|---:|---|---|
| `/` | 200 | `480164c97664202491c9fedda58f2c503f0cc8d677cdeda6e41d04de1b98e1ee` | match |
| `/robots.txt` | 200 | `bc142a6d95fed6f1aeded7e48624a0e37975ae760d3d8a6070d75a04fbcd3e45` | match |
| `/sitemap.xml` | 200 | `7ed526b576cf1eb29b44fbfeb35c87bcef05be5a4465d4242eb11b6725dc60e5` | match |
| `/car-key-lost-service` | 200 | `759ff137c2ef24b9598dfc08a10a64200c4d02f399fe90aea7e08255ff326b51` | match |
| `/article-bmw-smart-key-owner-guide` | 200 | `cd18cd05c9d3dab113e6d912ab72f687e0d6259d2ee54b8068d605f9ec5ec401` | match |
| `/article-audi-r8-neihu-all-keys-lost` | 200 | `1a9da3d58062e66dfbc3a0fc5146efa3b3e63346ec5e2c91942ebdcaf71ea4f9` | match |
| `/assets/js/procore-conversion-tracking.js` | 200 | `10969a911352e4a62903a93d249a932a0039f02a03371a6e7150c12a2534dd7b` | match |

Summary: 7 checked, 7 match, 0 drift. No Production mutation, click, deployment, or baseline refresh occurred.

## Risk and rollback

Risk is limited to omitting one optional structured-data property from three shared business nodes and narrowing the comparator's HEAD transformation to the current stage. Regression gates still cover all governed files. Rollback is the exact inverse of the three JSON-LD deletions plus removal of the case-pilot migration, comparator, governance, and documentation entries. No URL, visible content, database, or Production data migration is involved.

## Suggested commit boundary

`fix(seo): pilot evidence-gated service areas on case pages`
