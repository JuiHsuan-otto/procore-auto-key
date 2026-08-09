# Publication PR Receipt Contract v1

This contract carries a CarKey-created Draft PR result back to CasePilot without treating the PR or Preview as a publication.

## Authority boundary

- Source system: `carkey`; target system: `casepilot`.
- The receipt status is exactly `pr_created`.
- `merged_sha`, `production_deployment_id`, `published_url`, and `published_at` are required to be `null`.
- `human_review_required` is always `true`.
- CasePilot may advance only `promotion_applied -> pr_created`; it cannot infer approval, merge, deployment, or publication.

## Integrity

All JSON uses recursively key-sorted compact serialization with one trailing newline on disk. The receipt hash is SHA-256 of the canonical receipt with `receipt_hash` and `package_hash` cleared. The package hash is SHA-256 of canonical `{receipt_hash, files}`. `files` lists every evidence file other than `publication-pr-receipt.json`; package verification rejects unlisted files, missing files, symlinks, size drift, or hash drift.

`changed_path_digest` is SHA-256 of canonical sorted changed paths. PR title and body are stored only as SHA-256 digests. Tokens, cookies, environment values, Owner identity, raw API responses, and private customer data are forbidden.

## Expected package

```text
publication-pr-receipt.json
evidence/action.json
evidence/promotion-plan.json
evidence/apply-receipt.json
evidence/commit-evidence.json
evidence/pr-evidence.json
evidence/preview-evidence.json
```

Generation is offline after sanitized GitHub/Vercel evidence has been captured. The external PR creation and verification steps are separate from receipt generation.
