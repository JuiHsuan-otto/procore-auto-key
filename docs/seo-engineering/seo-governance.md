# CarKey SEO governance

Status: source-only engineering standard. This document does not authorize publishing, schema rollout, URL changes, or production deployment.

## Source of truth

- Public HTML remains the runtime output of the current static architecture.
- `data/business-entity.json` is the only future source for business identity fields. A field is schema-eligible only when `status=verified`, `publish=true`, and source/reviewer/date evidence exist.
- `data/business-metrics.json` is the only future source for public counters. A numeric metric is ineligible until its value, calculation, evidence, reviewer, verification date, and update date are complete.
- `data/third-party-scripts.json` is the allowlist and decision register for governed third-party scripts. Pending scripts may not expand to new pages.
- Sitemap and inventory remain generated/validated repository artifacts; production observations are timestamped evidence, not mutable golden files.

## New Case requirements

Every Case must have, before publication:

- Brand, model, year or defensible year range, area, service, problem/symptom, author, date published, and date modified.
- A short visible case summary that describes the customer-facing situation and outcome without sensitive bypass instructions.
- Visible evidence and documented image-use permission; every image needs contextual alt text.
- Links to the related service, brand, model when one exists, and area page.
- One canonical, one H1, BreadcrumbList, Article schema, shared business `@id` reference, sitemap entry, and review date.
- No plate, VIN, customer identity, precise address, credentials, or unverified price/time/success claims.

## New Guide or Article requirements

Every Guide must have:

- Primary search intent and one related service; brand/model references only when substantively relevant.
- Author, source/review notes, quick answer, last-reviewed date, and contextual internal links.
- Article schema and sitemap entry.
- FAQ schema only when the identical questions and answers are visible on the page.
- A review trigger when instructions, contact details, policies, or underlying evidence change.

## Brand, Model, Service, and Area requirements

- One unique user intent and a written non-overlap statement against adjacent pages.
- Real related cases; no page may be generated solely from a keyword combination.
- At least one valid contact path and a reference to the governed business entity.
- Brand/model pages need verified naming and at least one genuinely relevant service/case relationship.
- Area pages need real local evidence or GSC-supported demand and must not promise serviceability beyond verified operations.
- Programmatic publication is prohibited when cases, service evidence, or meaningful unique content are absent.

## Schema rules

- Business identity is one node: `https://www.carkey.com.tw/#business` with compatible Organization and LocalBusiness types. Pages reference that `@id` rather than inventing a second business.
- Null, unverified, or unpublished business fields are omitted, never replaced with placeholders.
- CarKey uses case-by-case quotations. `priceRange` therefore defaults to schema output `omit`; neither `$$`, a guessed range, nor JSON `null` may be emitted. Reconsideration requires a future fixed, consistently applicable, documented, and owner-approved pricing policy.
- Opening hours, address, legal name, tax ID, reviews, ratings, warranty, technicians, and credentials require human evidence before use.
- `priceRange` removals are limited to the explicit stages registered in `data/business-entity.json`: the three-page pilot, eight remaining service pages, and three brand/model pages. The remaining 120 files require separately approved page-type batches.
- Schema migration proceeds pilot → representative sample → explicit rollout. No task may silently rewrite 100+ HTML files.
- AggregateRating is not used for self-serving reviews. Product/SearchAction/Speakable are added only when the visible page and feature qualify.

## Metrics and analytics rules

- Click is an intent signal, not a lead, qualified lead, sale, or revenue event.
- Public counters require the metric evidence gate. View-source must contain the verified value or a non-numeric fallback; JavaScript animation may only enhance the authored value.
- Human-reviewed lead/outcome systems own qualification and revenue facts.
- Analytics parameters stay low-cardinality and exclude free text, precise addresses, identifiers, and URL query contents.

## Third-party scripts

- A new external script requires owner, purpose, data inventory, destination, retention, contract/terms, privacy disclosure, version/integrity strategy, CSP scope, and rollback.
- A pending script cannot be copied to additional pages.
- Removing an existing script or CSP host is a separate change after owner/privacy decision and representative-page verification.

## Definition of Done

- Required entity relationships and human evidence are recorded.
- Title, description, canonical, H1, schema JSON, internal links, images, and sitemap pass repository validators.
- `npm run validate:governance`, `npm run validate:site`, `npm run audit:measurement`, and `git diff --check` pass.
- A local preview verifies the changed page type; analytics changes additionally require browser/network evidence.
- Diff contains no unrelated formatting, mass whitespace churn, URL migration, invented business facts, or deployment action.
- Risk, rollback, and any Not verified items are stated explicitly.

## Suggested change-batch checklist

- [ ] Branch base and live remote main SHA recorded; dirty state understood.
- [ ] One explicit purpose and dependency boundary.
- [ ] Human inputs classified as coding-blocking vs publishing-blocking.
- [ ] Changed files and out-of-scope files listed before editing.
- [ ] No more than a small representative HTML pilot unless rollout is separately approved.
- [ ] Schema/data changes validated against null/unverified fields.
- [ ] Sitemap lastmod supported by substantive Git/content evidence.
- [ ] No phone/LINE click becomes `generate_lead`.
- [ ] Tests, local preview, diff summary, risk, and rollback attached.
- [ ] No commit, push, PR creation, or deployment unless separately authorized.

Default review size is under roughly 300 changed lines for a single purpose. Larger generators or validators are acceptable only with an explanation; whole-site formatting and unrelated whitespace remain prohibited.
