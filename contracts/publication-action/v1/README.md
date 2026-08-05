# Publication Action Contract v1

`publication-action/v1` is the offline, human-controlled Wave 2 lifecycle contract layered on the unchanged Publication Candidate Contract v1. It supports `publish`, `correct`, and `withdraw` without granting CasePilot authority over CarKey's final public result.

## Contract files

- `publication-action.schema.json` — exact action identity, authorization, consent, hash, repository, candidate, public-state, lifecycle, and prior-receipt binding.
- `publication-action-package.schema.json` — deterministic hashed directory containing `action.json` and the public-safe candidate package snapshot.
- `promotion-plan.schema.json` — CarKey-owned files/registry/canonical/asset/validation/risk/review/rollback plan with a deterministic `plan_hash`.
- `publication-action-receipt.schema.json` — local apply, correction, withdrawal, PR, deployment, rollback, and rejection evidence.
- `CHECKSUMS.sha256` — byte-level seal for this README and the four schemas.

## State machine

- `unpublished -> publish` is allowed.
- `published -> correct` and `published -> withdraw` are allowed only from the exact latest receipt, action ID, action revision, candidate revision, current public-content hash, canonical URL, and repository baseline.
- `published -> publish`, `unpublished -> correct`, `unpublished -> withdraw`, `withdrawn -> correct`, and a new `withdrawn -> withdraw` action are rejected. Exact replay of an already accepted action is the only idempotent reuse path.
- Republish after withdrawal is deliberately absent from v1.

## Human and privacy boundary

The action requires authorization verified, publication consent verified, Owner approved, reviewer role, approval timestamp, and an opaque evidence reference. Consent and approval carry only purpose-limited opaque references and high-entropy hashes. Person names, contact values, exact addresses, plates, VINs, raw evidence, credentials, tokens, and security procedures are forbidden.

Owner approval binds the exact source action request and draft hash. The final action hash blanks `action_id`, `action_hash`, and `approval.action_hash`, hashes canonical JSON, and derives `action_id` from the first 16 hash characters.

## CarKey authority

CarKey validates the action package, current Git baseline, current public page hash, prior receipt, candidate, draft, assets, canonical continuity, sitemap, redirects, internal links, and current lifecycle state. CarKey alone creates the final page, canonical URL, resulting content hash, worktree change set, resulting commit, PR URL, deployment ID, production URL, and receipt.

Plan, validate, apply, and verify are separate operations. Apply is permitted only in a fresh disposable Git worktree; canonical checkout apply, baseline drift, dirty worktrees, stale actions, tampering, slug/canonical conflicts, and unexpected changed paths fail closed.

## Withdrawal policy

Wave 2 uses a conservative, reversible policy: retain a minimal noindex/nofollow/noarchive tombstone at the canonical URL, remove Article structured data and sitemap/registry/internal-link entries, move public assets into deploy-excluded recovery storage, preserve source-only publication history, and require Owner/PR review. Replacement redirects remain contract-representable but must point to an existing CarKey target and are not automatically deployed.

No contract or tool in this directory merges, deploys, changes Production, calls a publication API, uses a shared database, or performs a network request.
