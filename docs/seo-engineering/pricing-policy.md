# CarKey Pricing and Quotation Policy

Status: business model confirmed; public pricing explainer not yet implemented.
Confirmed: 2026-07-16 (Asia/Taipei)

## Confirmed operating model

CarKey provides on-site and case-specific automotive key technical services. It does not have one fixed price tier that applies consistently across vehicles and situations. Quotations are assessed case by case.

Price may be affected by:

- vehicle brand, model, and year;
- key and security-system type, including chip, remote, smart-key, and keyless configurations;
- whether the need is duplication, all-keys-lost, failure diagnosis, or remote/key-shell work;
- whether on-site assistance is required and the travel/service area involved;
- service timing, including daytime, night, holiday, or other scheduling constraints;
- additional diagnostic, access, programming, disassembly, or specialist work required;
- parts availability and material cost at the time of service.

These factors explain why a single public amount or broad `$$` tier could mislead customers and create quotation disputes.

## Structured-data policy

- `priceRange` output is `omit` by default.
- Do not emit `priceRange: "$$"`, a guessed currency range, a starting price, or JSON `null`.
- Do not create `Offer`, `AggregateOffer`, or `Product` solely to expose a price signal.
- Reconsider price schema only if a future policy is fixed, consistently applicable to the stated scope, documented, dated, and explicitly approved by the business owner.
- A factor-based pricing explainer may use `WebPage` and `BreadcrumbList`. FAQ schema is allowed only when the same questions and answers are visible; rich-result display is never promised.

## Future public pricing explainer brief

Purpose: answer “汽車鑰匙價格怎麼計算？” without creating a price-table promise.

Recommended visible structure:

1. A direct explanation that CarKey uses case-by-case quotations.
2. A scannable table of factors that may affect the quotation.
3. A “what to provide” checklist: vehicle brand/model/year, current key situation, instrument message or relevant photos, general location, and preferred service timing.
4. A clear distinction between preliminary assessment and the final quotation after scope confirmation.
5. Existing phone and LINE contact paths, using the governed click-event taxonomy.

Do not publish:

- a fixed or “starting from” amount without a separately approved pricing scope;
- a guaranteed quotation or response time;
- “1–3 minutes” or similar timing until H20 has timestamped operational evidence and an approved coverage definition;
- technical bypass instructions, sensitive anti-theft procedures, or claims that every vehicle/situation can be served;
- a new URL, sitemap entry, or navigation item until title, canonical brand name, copy, privacy implications, and internal-link placement are reviewed.

## Publication definition of done

- Business owner approves the final visible wording and required intake fields.
- H02 public brand decision is resolved for title/footer/entity consistency.
- H20 remains omitted unless response-time evidence is approved.
- Page has a unique intent and does not duplicate service pages.
- No fixed amount, `priceRange`, Product, or Offer schema is introduced.
- Static-site, schema, accessibility, mobile, CTA-measurement, sitemap, canonical, and internal-link checks pass.
- Preview is reviewed before any separately authorized production promotion.
