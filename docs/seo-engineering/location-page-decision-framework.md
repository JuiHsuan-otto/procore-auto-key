# Location page decision framework

The 22 existing county pages remain unchanged until Search Console and operational evidence are available. Similarity alone is not enough to delete, merge, or expand them.

## Required inputs

- GSC page/query data for at least the latest representative 90 days, with a longer comparison period when available.
- Impressions, clicks, CTR, average position, query overlap, canonical/index status, and device split.
- Real Case count by area and whether operations can actually serve or assess the area.
- Current internal links and conversions by landing page where measurement is reliable.

## Decision sequence

1. Group queries by intent: lost key, all keys lost, spare key, key not detected, brand/model, and navigational.
2. Build page-to-query overlap. High copy similarity is a risk signal; high query overlap plus no unique evidence is the consolidation signal.
3. Classify each page:
   - **Keep/improve:** distinct demand or real local Cases, correct serviceability, meaningful engagement.
   - **Merge candidate:** same queries as another page, no unique Cases/evidence, weak performance over a sufficient period.
   - **Noindex candidate:** useful navigation but insufficient standalone search value; requires canonical/internal-link impact review.
   - **Retire/redirect candidate:** obsolete or unsupported intent with a clear destination and no conflicting demand.
   - **Insufficient data:** do nothing except measurement and evidence collection.
4. Pilot no more than two comparable pages, record pre-change baselines, and observe indexing/query effects before rollout.

## Guardrails

- Do not create additional city/district pages from keywords alone.
- Do not claim guaranteed coverage, response time, or 24H service without operations evidence.
- Any merge/redirect requires URL mapping, internal-link update, sitemap update, canonical verification, rollback mapping, and post-change GSC monitoring.
- GSC access is read-only for analysis; this document does not authorize URL changes or deployment.
