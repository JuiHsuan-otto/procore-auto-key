# Stage B foundation batch

Status: implemented and verified locally on `seo/stage-b-foundation-20260716`; feature-branch commit/push, draft PR, and Preview deployment were subsequently authorized. Production promotion remains out of scope without a separate explicit instruction.

## Scope and value

This batch establishes a safe SEO engineering baseline without changing public URLs, deleting pages, inventing business facts, or publishing content. It makes production drift observable, prevents invalid sitemap dates, generates a repeatable page inventory, and keeps contact clicks separate from actual leads.

Out of scope: schema/entity rollout, counters, image remediation, content expansion, URL migration, production deployment, and Google account configuration.

## Production observation

The immutable point-in-time record is `production-baseline-20260716T005811+0800.md`. It compares seven representative production resources with live remote `main` SHA `15301685c7d8dcb709c253b0759c770361840a54`: all returned HTTP 200 and all seven body hashes matched.

At `2026-07-16T01:06:01+08:00`, live remote `main` was still the same SHA and a new read-only comparison still reported `7 match / 0 drift`. The saved 00:58:11 observation was not changed.

The checker writes JSON to stdout and never edits a stored observation or production:

```bash
npm run seo:baseline -- --remote-sha <live-remote-main-sha>
```

`--require-match` is optional for a one-time assertion. A later mismatch is drift and must not be “fixed” by changing the saved baseline.

## Sitemap evidence

`/service-areas` changed from the unsupported future date `2026-12-24` to `2026-07-07`.

Evidence order:

1. Commit `834f3581224c19f07c9dd46c4f8fae0f83ce0ae5`, authored `2026-07-07T05:24:46+08:00`, added the interactive service-area checker and its visible instructions, controls, results, privacy copy, links, and behavior. This is the latest substantive page-content change.
2. Commits `4ef4ff9`, `7a9207f`, and `49b03ec` on 2026-07-12 only removed tracking from the privacy utility and changed prefill transport from query parameters to a URL fragment. They did not replace the page's substantive service-area content and were excluded from `lastmod` selection.
3. The date is not today's date and is not an inferred business update date.

The site validator now rejects malformed sitemap wrappers/namespaces, duplicate `loc`, non-canonical hosts and paths, `.html`, query/fragment URLs, trailing slashes, missing/invalid/future `lastmod`, and sitemap URLs without an indexable matching canonical HTML page.

## Inventory

`npm run seo:inventory` produces deterministic CSV; add `-- --format=json` for JSON. The current check covers all 135 HTML pages and includes URL, file, page type, title, description, canonical, H1, robots/indexability, root schema types, unique internal in/out counts, image totals and missing attributes, and sitemap lastmod.

## Analytics verification levels

- Static verified: `npm run audit:measurement` passed for 135 HTML files. The click handler uses `pushClickEvents`; static inspection fails if its phone/LINE path references `generate_lead`, `LEAD_EVENT_NAME`, or the diagnostic lead sender.
- Browser verified — phone: one real browser click produced one first-party `procore_phone_click` object and one GA request with `en=click_to_call`; payload included `conversion_type=phone`, `lead_source=phone`, `method=phone`, and the expected `link_url`. No `generate_lead` command or request appeared.
- Browser verified — LINE: one real browser click produced one first-party `procore_line_click` object and one GA request with `en=line_click`; payload included `conversion_type=line`, `lead_source=line`, `method=line`, and the expected `link_url`. No `generate_lead` command or request appeared.
- The explicit GA diagnostic query is the only path in this script that can send `generate_lead`; ordinary CTA clicks cannot call it. A later P0 hardening batch restricted this diagnostic path to loopback hosts and removed query/fragment contents from Analytics `page_location`; see `stage-b-analytics-privacy-hardening.md`.

The browser harness prevented navigation and was deleted after the test. The loopback server was stopped. No LINE message or phone call was initiated.

Because the requirement included GA network-payload verification, the browser runs sent controlled GA4 test traffic with `page_location` on `127.0.0.1` between approximately `2026-07-16 00:59–01:04 +08:00`. Separate event-command and network-evidence passes, plus connection retries, can produce multiple localhost page-view/scroll and click test records. They are identifiable by the localhost page location and harness title and should be excluded from business reporting. None of the observed CTA requests used `generate_lead`.

## Acceptance and rollback

Acceptance commands:

```bash
npm run test:seo-foundation
npm run validate:site
npm run audit:measurement
git diff --check
```

Rollback is release-scoped: before merge, close the draft PR and remove the feature branch/Preview deployment; after merge, revert the Stage B commit. Production rollback is unnecessary unless a later, separately authorized production promotion occurs.
