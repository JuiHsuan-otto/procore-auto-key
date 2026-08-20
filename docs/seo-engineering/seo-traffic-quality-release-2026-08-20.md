# SEO traffic quality release candidate — 2026-08-20

Status: release candidate for the Owner-authorized Draft PR and Preview phase. Merge, Production deployment, Google Analytics account changes, and Search Console submissions remain outside this phase.

## Business objective

- Consolidate overlapping Keyless troubleshooting intent into the strongest canonical page.
- Improve low-CTR, high-impression pages without inventing service claims.
- Recover known legacy URLs with exact permanent redirects.
- Connect article CTA starts to a structured website inquiry and CasePilot outcome report.

## Implemented scope

- Redirect `/article-keyless-troubleshooting` to `/article-smart-key-troubleshooting`; remove the retired URL from public registries and sitemap.
- Keep `/article-keyless-troubleshooting-guide` as an automotive battery/low-power intent page and explicitly exclude motorcycle intent.
- Expand car-won't-start and VW ignition pages around key-won't-turn and steering-lock queries.
- Separate `car-key-duplication-service` (can a chip key be duplicated?) from `spare-car-key-service` (only one key / used-car backup decision).
- Add exact redirects for known retired paths with verified replacement pages.
- Replace timestamped `blog.json?t=...` fetches with a stable URL plus `cache: no-store`.
- Add static guards against the historical `${item.img}` and doubly quoted link failures.
- Add structured inquiry fields, privacy guards, anonymous request reference, validated source page, and `rescue_request_start` tracking.
- Route the primary CTA on the homepage and highest-traffic troubleshooting/service pages through the structured inquiry while retaining direct phone and LINE choices elsewhere.

## Measurement semantics

- `click_to_call`: phone CTA click; not a qualified lead.
- `line_click`: direct LINE CTA click; not a qualified lead.
- `rescue_request_start`: click from a content/service page into the structured inquiry composer; not a qualified lead.
- `generate_lead`: remains disabled for production click paths. A qualified lead or completed Case must come from downstream evidence, not a click.

CasePilot reads only `來源頁：/<slug>` and `詢問識別碼：CKW-YYYYMMDD-XXXXXX` from the private inquiry message. Its Owner report groups attributed Cases by source page and shows completed count plus recorded completed charge.

## Verification completed

- Static site validation: 135 HTML files, 0 warnings, 0 errors.
- Measurement audit: 135/135 pages have phone plus LINE or structured inquiry coverage; 0 warnings, 0 errors.
- Structured intake regression gates: 40/40.
- SEO foundation, tracking runtime, schema/image pilot, deployment boundary, publication contracts and publication suites: passed.
- Browser smoke: revised car-won't-start content rendered with one H1; structured inquiry submitted successfully and produced the expected source path and anonymous reference.
- Production dependency audit: 0 vulnerabilities (`npm audit --omit=dev`).

## Governed release sequence

1. Commit and push the scoped feature branch, create a Draft PR, and verify Preview under the current Owner authorization.
2. Approve merge/deployment separately under the existing production SOP.
3. After Production is verified, mark `click_to_call`, `line_click`, and `rescue_request_start` as GA4 key events only as CTA engagement; do not rename them as qualified leads.
4. Submit the updated sitemap in Search Console and request recrawl for the three improved canonical pages plus the consolidated Keyless canonical.
5. Compare 28-day CTR/clicks and CasePilot attributed completion by landing page; do not judge the change from impressions alone.

## Rollback

Revert the eventual release commit through the normal PR workflow. Restore the retired Keyless registry/sitemap entry only if the redirect is also removed; never leave both an indexable retired page and a redirect target active.
