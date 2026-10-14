# 2026-10-14 Commitment-copy release (P0)

Status: working tree, not committed. Evidence: business owner statement in chat, 2026-10-14 (Asia/Taipei).

## Owner statements used as publication evidence

1. Service tiers: same-day dispatch in Taichung, Changhua, Nantou, Miaoli, Hsinchu, Yunlin, Chiayi; booked visits in Taipei, New Taipei, Taoyuan, Tainan, Kaohsiung.
2. All-keys-lost work is done on-site at the vehicle for most models (saves towing cost and risk); the exact set is model-dependent, so copy says「多數車型」and never「所有車型」.
3. Spare/added keys are a core service; service content is comparable to peers.
4. Pricing stays case-by-case (brand, year, key type, vehicle location). No fixed amount, no「起」price, no priceRange schema. Relative statements only (all-keys-lost usually costs more than adding a spare).
5. All published cases are real service cases; owner holds completion photos with plates removed.

Claims deliberately NOT made: 24H / 全年無休 / 全天候 (validator pattern), guaranteed response time, warranty terms, any numeric service count, legal name, address, opening hours.

## Pages changed

| File | Change |
|---|---|
| index.html | title/meta, hero H1 + trust strip, two service cards, Why-call-first bullets, FAQ (+費用 Q), pills link to price guide; metric fallback copy via data/business-metrics.json |
| all-keys-lost-service.html | rewritten: scope/timing, 4-step flow, 費用怎麼算, compare table, 2 real photos, FAQ ×8, LINE-first CTA |
| spare-car-key-service.html | rewritten: why-now, key types, scope, 3-step flow, 費用怎麼算, FAQ ×6 |
| car-key-lost-service.html | title/H1/lead, 快速回答 branching, scope, 費用 block, FAQ ×5 |
| article-smart-key-troubleshooting.html, article-car-key-not-detected-troubleshooting.html, article-car-wont-start-troubleshooting.html | in-body bridge CTA after the symptom panels |
| car-key-price-guide.html (new) | factor-based pricing explainer per docs/seo-engineering/pricing-policy.md; WebPage + BreadcrumbList + FAQPage only |
| sitemap.xml, blog.json | new URL, lastmod refresh |
| scripts/validate-schema-image-pilot.mjs | APPROVED_CONTENT_RELEASE_SHA256 re-pinned for the 7 changed pages |

Service.areaServed on the three service pages now lists the 14 confirmed counties/cities (tier A + tier B). The shared LocalBusiness node is unchanged.

## Verification (local, 2026-10-14)

validate:site 132 files 0 errors; validate:governance 0; validate:schema-rollout (immutable baseline compare) 0; validate:seo-pilot 0; audit:measurement 0; test:seo-foundation pass; validate:deployment-boundary 0; test:intake 55/55; test:tracking-runtime pass.

## Follow-ups

- Otto: create Google Business Profile (see reports/growth-baseline/2026-10-14-traffic-recovery-plan.md §4 A); supply URL for H14/sameAs.
- Replace the two gallery photos on all-keys-lost-service with newer owner photos when supplied; keep width/height attributes accurate.
- Observe GSC query/page for the 4 money pages at 7/14/28 full days after production deploy.
