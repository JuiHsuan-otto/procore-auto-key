# Content and entity data model

Status: design contract only. It does not create public pages or assert missing business facts.

## Core relationship

```text
Case
├─ Brand ─ Model
├─ Service
├─ Problem / Symptom
├─ Area
├─ Author / Technician
└─ Business

Guide / Article
├─ primary intent
├─ Service
├─ optional Brand / Model
├─ Author
└─ Business
```

Cases are the evidence-bearing center. Brand, model, service, and area pages may aggregate real Cases; they must not manufacture Cases or publish solely because a relationship can be represented in data.

## Entity contracts

| Entity | Stable key | Minimum coding fields | Publishing gate |
|---|---|---|---|
| Business | `business_id` | shared schema ID, field-level verification | public brand choice plus each published field's evidence |
| Brand | `brand_id` | canonical label, aliases, status | verified public naming and relevant service/case evidence |
| Vehicle Model | `model_id` | brand ID, canonical label, aliases | verified brand relationship and real relevant case/service |
| Service | `service_id` | label, intent, public URL, status | actual offered service and non-overlap statement |
| Problem/Symptom | `problem_id` | customer-language label, aliases | safe wording and related service |
| Area | `area_id` | administrative label, parent, public URL/status | verified serviceability or explicit assessment wording |
| Case | `case_id` | brand/model/year/area/service/problem/author/dates/summary/evidence | visible evidence, permission, privacy review, required links |
| Guide/Article | `content_id` | intent/service/author/sources/review date | reviewed advice, visible quick answer, schema parity |
| Author/Technician | `author_id` | display decision and status | identity/role/credential permission; no invented Person data |
| Metric | `metric_id` | label/unit/evidence fields/display status | complete calculation and human verification |
| Warranty | `warranty_id` | scope/terms/effective date/status | approved written policy before page or schema use |
| Pricing Policy | `pricing_policy_id` | quotation model/factors/required intake/schema output/status | owner-approved operating model; fixed ranges require separate evidence |

## Relationship rules

- `Case.brand_id` is required; `Case.model_id` must belong to that Brand.
- `Case.service_ids`, `problem_ids`, and `area_id` drive related links and future aggregations.
- `Guide.service_ids` is required; Brand/Model links are optional and must be substantively discussed.
- Brand/Model/Service/Area aggregations use only published Cases with matching IDs.
- Business, Author, Metric, Warranty, and Pricing Policy records use verification/publication states; null or unpublished fields do not enter schema. CarKey's current case-by-case policy always omits `priceRange`.
- Dates are evidence-bearing content dates, not build dates.

## Lifecycle

All future records use: `draft` → `verified` → `approved_for_publish` → `published` → `review_due` → `retired`.

AI may draft relationships or summaries but cannot advance business facts, author credentials, metrics, serviceability, price, warranty, or publication status without human evidence.

## Proposed future storage

```text
data/
  business-entity.json
  business-metrics.json
  brands.json
  models.json
  services.json
  problems.json
  areas.json
  cases.json
  guides.json
  authors.json
  warranties.json
  prices.json
```

Only the first two sources are implemented in this batch. The remaining files must be introduced with a schema pilot and migration from current content; they are not invitations to bulk-generate pages.
