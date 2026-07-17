# Stage B: luxury case-template availability-claim neutralization

Status: implemented and verified locally; not committed, pushed, published, or deployed.

## Problem, priority, and value

Human input H07 still has no staffing or on-call evidence supporting public `24H`, `24小時`, `全年無休`, or `全天候` promises. This P0 batch lowers customer-expectation and brand-trust risk on four pages that share the same case layout:

- `article-benz-glc300-yuanlin-service.html`
- `article-hyundai-tucson-hemei-akl.html`
- `article-infiniti-fx35-shetou-rescue.html`
- `article-kia-picanto-shengang-akl.html`

Each page receives exactly three neutral replacements: the internal button comment loses `24H`, navigation `24H CALL` becomes `CALL`, and contact label `24H Hotline` becomes `Phone`. Phone and LINE destinations, CTA behavior, structured data, URLs, page content, and layout classes remain unchanged. Existing `priceRange` debt is intentionally out of scope.

## Controlled remainder and guards

- Original controlled baseline: 39 files / 60 occurrences.
- Prior BMW batch: removed 6 files / 9 occurrences.
- This batch: removed 4 files / 12 occurrences.
- Expected remainder: 29 files / 39 occurrences.
- `openingHours` remains null, unverified, and unpublished.

The governance validator records both stages, rejects any matching claim in the ten neutralized files, and enforces the exact remainder. With `--compare-head`, it reconstructs each of these four pages from `HEAD` using only the three registered replacements and rejects any other byte change.

## Pre-write production observation

This is a point-in-time observation, not a permanent test truth:

- Captured: `2026-07-17T00:37:37+08:00` (Asia/Taipei).
- Live remote `main`: `15301685c7d8dcb709c253b0759c770361840a54`.
- Result: 7 checked / 7 match / 0 drift.
- Every production and remote comparison returned HTTP 200.
- Common production headers: `cache-control: public, max-age=0, must-revalidate`; `server: Vercel`; all observed responses were cache hits.

| Path | Content-Type | ETag | Last-Modified | Production body SHA-256 | Result |
|---|---|---|---|---|---|
| `/` | `text/html; charset=utf-8` | `W/"7cb29ecd687800e67e61ce0da5e2d0d8"` | `Mon, 13 Jul 2026 00:46:01 GMT` | `e919ca3574e28dbc7cf4a173c392d52ca7353f5be1e5ad8ee222425b15744f81` | match |
| `/robots.txt` | `text/plain; charset=utf-8` | `"e9691db856777cb142289fba85913a2a"` | `Thu, 16 Jul 2026 09:36:02 GMT` | `bc142a6d95fed6f1aeded7e48624a0e37975ae760d3d8a6070d75a04fbcd3e45` | match |
| `/sitemap.xml` | `application/xml` | `W/"111fe7a1153ff9c94534fb35284b473c"` | `Thu, 16 Jul 2026 12:53:30 GMT` | `4c24e3c7275fa6e82b1c72aba0094342792d47d5c2c75e3539e95e530d0f2dbe` | match |
| `/car-key-lost-service` | `text/html; charset=utf-8` | `W/"e6e4da663a13d22b86f9b7acc38ac1f0"` | `Wed, 15 Jul 2026 16:58:13 GMT` | `ac90b250414c690f88e7fd453ffc03ad3402f53b61854025be2baf417c0b1769` | match |
| `/article-bmw-smart-key-owner-guide` | `text/html; charset=utf-8` | `W/"84b86e53aa6ddf9f3e58149ede58fe6a"` | `Wed, 15 Jul 2026 03:05:36 GMT` | `75547bb4c16653faa53b01cb9449a1ef2569efa2ebeb8bd719e4bee636012192` | match |
| `/article-audi-r8-neihu-all-keys-lost` | `text/html; charset=utf-8` | `W/"f566345faf5e75320a73ea2c27a566c0"` | `Wed, 15 Jul 2026 16:21:33 GMT` | `0a0d4fb062ad17ca94fd665361d22280a26be097670fd48b337e5dbe7f63e008` | match |
| `/assets/js/procore-conversion-tracking.js` | `application/javascript; charset=utf-8` | `W/"814dc9cc755fbc0b5896292d0baeb2c9"` | `Mon, 13 Jul 2026 00:08:21 GMT` | `bcd6d0758672bb924230418effec6b18424516adf826cd2a537fb5e1be559264` | match |

The complete observation also recorded response final URLs, content lengths where sent, `x-vercel-cache`, `x-vercel-id`, and identical remote-file SHA-256 values. If production changes during this batch, only drift will be reported; this observation will not be rewritten.

## Validation and rollback

Completed acceptance:

- `node scripts/validate-seo-governance.mjs --compare-head --self-test`: 29 files / 39 remaining occurrences, four negative gates passed, 0 errors.
- `npm run test:seo-foundation`: 135-page inventory, metric drift check, 49-page schema guard, and all SEO foundation checks passed.
- `npm run validate:site`: 135 HTML files, 0 warnings, 0 errors.
- `npm run audit:measurement`: 135 HTML files, 0 warnings, 0 errors; click paths do not emit `generate_lead`.
- `git diff --check`: passed.
- Browser, all four pages at 1440×900 and 390×844 viewport overrides: one H1, zero target claims, zero horizontal overflow, and zero console warnings/errors on every page.

Analytics classification is **Static verified**. This batch did not click CTAs, so browser event and network payload verification are **Not verified**.

## Final production drift observation

- Captured: `2026-07-17T00:41:58+08:00` (Asia/Taipei).
- Live remote `main`: unchanged at `15301685c7d8dcb709c253b0759c770361840a54`.
- Result: 7 checked / 7 match / 0 drift.

This second observation did not update the pre-write baseline or modify production.

Rollback is the inverse of the twelve exact text replacements plus removal of the second migration stage, validator registration, and this document. Do not roll back merely to restore an unsupported availability promise.

Suggested future commit boundary: `fix(content): neutralize unsupported 24H claims on luxury case template`.
