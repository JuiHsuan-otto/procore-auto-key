# CasePilot → CarKey publication closed loop v2

This directory is the canonical, versioned boundary for publishing a reviewed
CasePilot website draft through a CarKey Draft PR and protected Preview, followed
by a **separate Owner authorization** for merge and Production verification.

The four payloads use the exact camelCase field names consumed by the CasePilot
and CarKey runtimes:

- `publication-handoff.schema.json` — CasePilot worker claim for either the
  Preview phase or the Production phase.
- `publication-preview-receipt.schema.json` — CarKey Draft PR and GitHub Preview
  deployment result, or a sanitized failed result.
- `publication-production-authorization.schema.json` — the second, explicit
  Owner approval, bound to one exact PR head and one exact Preview.
- `publication-production-receipt.schema.json` — verified Git merge, GitHub
  Production deployment, public page result and rollback readiness, or a
  sanitized failed result.

Every object schema is closed with `additionalProperties: false`. Consumers
must reject unknown fields and must perform the semantic equality checks below
in addition to JSON Schema validation.

## Authority and state machine

```text
owner_review
  -> preview_pending       first Owner approval of public copy + photo rights
  -> preview_claimed       OIDC worker claim, time limited
  -> preview_ready         Draft PR + protected Preview receipt verified
  -> production_authorized second Owner approval of that exact Preview
  -> production_claimed    OIDC worker claim, time limited
  -> published             merge + Production + public verification receipt
```

The first approval never authorizes merge, Production deployment, domain
changes, DNS changes, or publication. A Preview receipt always describes a
Draft, open PR and the exact GitHub environment `Preview – procore-auto-key`.
Only `publication-production-authorization` is the second approval. It binds the
candidate, selected assets, Preview receipt, PR number, actual base SHA, exact
head SHA, GitHub Preview deployment ID and Preview URL.

CasePilot does not query or claim the current CarKey `main` SHA when it creates a
Preview handoff. The handoff therefore contains only the repository identity and
`main` branch name. CarKey chooses and records the actual base in the Preview
receipt after its own claim/apply checks. The second authorization then binds
that observed `baseSha` and the exact `headSha`. Any base, head, checks,
deployment or rendered-result drift invalidates the authorization.

## Content-addressed revision model

The mobile runtime does not expose a monotonic numeric candidate revision in
this boundary. v2 therefore uses a content-addressed revision tuple:

- `candidateId` is the stable CasePilot draft identity.
- `candidateHash` is the exact approved website candidate revision.
- `sourceHash` detects changes to the underlying sanitized case projection.
- `bindingHash` binds `candidateHash`, `sourceHash`, and the selected media
  metadata and byte hashes.
- `previewApprovalHash` binds the reviewed candidate, selected media,
  `publicContentApproved: true`, `photoRightsApproved: true`,
  `realCaseAttested: true`, and the approval timestamp held in CasePilot.

Raw consent records, customer identity and rights documents never cross this
contract. `previewApprovalHash` is the public-safe consent/rights proof; the
underlying audit record remains private in CasePilot. A changed source, draft,
asset byte, selected media set, consent decision or rights decision must produce
a new binding/approval hash and a new Preview cycle.

Every handoff also carries the exact constant
`sourceKind: "owner_attested_real"`. CasePilot must reject the authorization
before job creation when the case, completion report, candidate, or selected
media is synthetic/test data, or when the Owner has not explicitly attested a
real case. The attestation cannot relabel a known synthetic record. CarKey must
reject a missing or different `sourceKind`, synthetic/test labels in the public
projection, and all known QA fixtures. Existing synthetic v1 fixtures remain
isolated from this v2 Production path.

## Public-safe boundary

Only the already-sanitized `taxonomy`, `website`, approved asset metadata and
short-lived relative `downloadPath` may leave CasePilot. Payloads and evidence
must not contain:

- customer or Owner names, phone numbers, email, account subject, or raw
  conversations;
- exact addresses, coordinates, GPS/EXIF, plates, VINs, or other vehicle
  identifiers;
- prices, settlement data, private partner terms, credentials, cookies,
  sessions, bearer tokens, environment values, or raw provider responses;
- raw consent/rights evidence or private media storage URLs.

`downloadPath` is a relative endpoint only. It is authorized by the active
claim plus the configured GitHub OIDC worker identity; it is not a bearer URL,
must not be published, and expires with `claimExpiresAt`. CarKey must verify the
downloaded byte length, MIME, SHA-256 and decoded dimensions, strip metadata,
and hash the sanitized public asset manifest.

Each v2 publication asset is limited to `4,000,000` bytes. This is a transport
limit with headroom below the Vercel Function payload ceiling, not a change to
CasePilot's local-first or private original-media storage limit. An approved
original above this boundary must be converted to a separately hashed,
Owner-reviewed publication derivative before a new Preview authorization; it
must not be silently resized after approval or streamed through this contract.

## Transport and branch binding

The only v2 CasePilot worker origin compiled into the CarKey runtime is:

```text
https://casepilot-automotive-git-feat-cas-f0ce72-ottoyeh-7522s-projects.vercel.app
```

The worker endpoints below are relative to that exact origin:

- `POST /api/publication/worker/claim`
- `GET /api/publication/worker/media/{mediaId}`
- `POST /api/publication/worker/receipts/preview`
- `POST /api/publication/worker/receipts/production`

Configuration may enable or disable the worker but must not substitute another
host. Any origin change is a contract and trust-policy change requiring a new
reviewed version. Every request uses the configured GitHub OIDC identity and a
short-lived claim; no endpoint accepts a public bearer URL.

CasePilot accepts only GitHub OIDC tokens with issuer
`https://token.actions.githubusercontent.com`, audience
`casepilot-publication`, repository `JuiHsuan-otto/procore-auto-key`, repository
ID `1164392808`, ref `refs/heads/main`, and workflow ref
`JuiHsuan-otto/procore-auto-key/.github/workflows/casepilot-publication.yml@refs/heads/main`.
Only `schedule` and `workflow_dispatch` events are trusted. Repository name
alone is insufficient; all claims, expiry, signature, run ID and run attempt
must verify.

Preview branches use the exact collision-resistant pattern
`publication/case-{candidate12}-job-{job12}`. A terminally failed job therefore
cannot collide with the branch of a later job for the same candidate. Automatic
rollback branches use
`rollback/case-{candidate12}-job-{job12}-from-{merge8}` and remain bound to the
exact triggering merge.

## Exact hash rules

Canonical JSON is recursively key-sorted compact JSON encoded as UTF-8, with no
insignificant whitespace. Hashes are lowercase SHA-256.

- `handoffHash`: hash the complete handoff with `handoffHash` set to `""`.
- `receiptHash`: hash the complete success/failure receipt with `receiptHash`
  set to `""`.
- `authorizationHash`: hash the complete Production authorization with
  `authorizationHash` set to `""`.
- `changedPathsHash`: hash the sorted, unique changed-path array.
- `checksDigest`: hash the normalized required-check result projection.
- `previewVerificationHash`: hash sanitized PR, checks, GitHub Preview
  deployment, rendered content, schema, sitemap, and asset verification facts.
- `productionVerificationHash`: hash sanitized merge, GitHub Production
  deployment, public GET, canonical, schema, sitemap, route registry and asset
  verification facts.

Hashes are identities, not secrets. Evidence hashes must never be replaced by
raw provider responses or private evidence in these payloads.

## Required semantic validation

JSON Schema cannot express cross-object equality or time ordering. Both runtimes
must fail closed on all of these rules:

### Handoff

1. The claim exists, belongs to the authenticated OIDC workflow/run, is for the
   requested phase, and has not expired.
2. Recompute `handoffHash`; `candidateHash`, `sourceHash`, `bindingHash`, and
   `previewApprovalHash` equal the durable CasePilot job.
3. `sourceKind` is `owner_attested_real`; the first Owner approval hash includes
   `realCaseAttested: true`, and no underlying record or selected asset is marked
   synthetic/test.
4. Every selected asset has public-use approval, a completed privacy/GPS review,
   and bytes matching `sha256`, `mime`, `byteLength`, and decoded dimensions.
5. A Preview handoff has both `previewReceipt` and
   `productionAuthorization` null.
6. A Production handoff contains both objects and their hashes equal the
   durable, previously accepted Preview and second authorization.

### Preview receipt

1. `repository.fullName`, `baseBranch`, PR URL, PR base/head, and receipt job,
   claim, handoff, candidate, source, binding, and approval hashes all match.
2. The PR is open and Draft. Required checks are successful.
3. `repository.changedPathsHash` matches the sorted unique allowlisted paths.
4. `repository.featureBranch` matches
   `publication/case-{candidate12}-job-{job12}` and is unique to that job.
5. `previewDeployment.environment` is exactly
   `Preview – procore-auto-key`, its state is `success`, and `sourceSha` equals
   the PR/repository head SHA.
6. `providerDeploymentId` is non-null only with status `verified`; it is null
   only with status `unavailable`. GitHub deployment/status IDs remain required
   and authoritative in either case.
7. The Preview URL is HTTPS and is not a `carkey.com.tw` Production URL. With
   `accessMode: anonymous_verified`, the Preview must return 200 and prove
   `noindexVerified: true`. With `accessMode: vercel_sso_protected`, a
   302/401/403 response and `noindexVerified: false` are allowed only because
   the exact local commit output, successful checks, GitHub deployment identity
   and source SHA remain verified. `publicResult` hashes still bind that output.
8. Import advances only the matching claimed job to `preview_ready`. It never
   implies merge or publication.

### Production authorization

1. It is created only from a verified `preview_ready` job after a second,
   explicit Owner action.
2. `candidateHash`, `bindingHash`, `previewReceiptHash`, `prNumber`, `headSha`,
   `baseSha`, `previewGithubDeploymentId`, and `previewUrl` exactly match the
   accepted Preview receipt.
3. `authorizedAt` and `expiresAt` are canonical timestamps; expiration is after
   authorization and in the future when claimed; `revoked` is false.
4. Recompute `authorizationHash`. A changed PR, base, head, checks, Preview
   deployment, URL, candidate, source, asset, consent or rights decision requires
   a new Preview and a new authorization.

### Production receipt

1. The receipt is accepted only from the exact, active Production claim and the
   exact non-expired, non-revoked second authorization.
2. `mainBeforeSha` equals the authorized `baseSha` and current `main` before
   merge; `authorizedHeadSha` equals the authorized PR head; the PR number/URL
   match; `mainAfterSha` equals `mergeSha` after merge.
3. The GitHub deployment environment is exactly
   `Production – procore-auto-key`, state is `success`, and `sourceSha` equals
   both `mergeSha` and `mainAfterSha`.
4. The deployment-specific `environmentUrl` is HTTPS and is bound to the
   verified merge SHA. It may be anonymously verified or Vercel-SSO protected,
   as recorded by `accessMode`. Separately, `publicationPath` and `canonicalUrl`
   resolve to the exact approved `https://www.carkey.com.tw/` route. The official
   public URL must always return 200 with exact canonical, no noindex, and valid
   Article/BreadcrumbList/FAQPage schemas; SSO on the deployment URL never
   relaxes official-domain verification.
5. Sitemap and route registry contain the canonical route exactly once. Public
   content and every served asset byte reproduce `contentSha256` and
   `assetManifestHash` from the approved Preview.
6. Rollback mode is `revert_pr`; the prior GitHub Production deployment identity
   is recorded when available. A success receipt must not claim that automatic
   rollback occurred.
7. CasePilot marks the job and draft `published` only after all checks and
   `productionVerificationHash` pass. A merge or deployment alone is not enough.

A Preview failed receipt contains only a typed code, retryability flag and
sanitized detail digest. A Production failed receipt additionally records
`failure.stage` and a closed rollback projection:

- `pre_merge`: no merge occurred; rollback is `not_required`, was not attempted,
  and every rollback identity is null.
- `post_merge` + `restored`: the exact triggering merge was reverted through a
  deterministic revert branch and PR, required checks passed, the authorized
  revert head was merged without an admin bypass, the exact rollback Production
  deployment succeeded, the new route returned 404, and the sitemap no longer
  contained it. The receipt carries the trigger merge SHA, revert PR number/URL,
  revert head SHA, rollback merge SHA, GitHub Production deployment ID, and
  verification timestamp, route HTTP status 404, sitemap occurrence count 0,
  and `rollbackVerificationHash`. The rollback hash is SHA-256 of canonical
  rollback JSON with its own hash field set to `""`, binding all rollback
  identities and route/sitemap proof. It remains a failed publication, never
  `published`.
- `post_merge` + `manual_required`: safe automatic restore was impossible (for
  example, `main` drifted away from the exact triggering merge). The failure
  code is exactly `ROLLBACK_REQUIRED`, `retryable` is false, and
  `triggerMergeSha` is mandatory. No normal retry or second merge is allowed;
  Owner-visible manual recovery is required.

The second Production authorization includes authority to revert only the exact
merge it authorized when post-merge verification fails. It does not authorize
rewriting history, force push, unrelated rollback, DNS changes, or deployment
promotion. Failed receipts never advance state to Preview ready or published.
Base/head drift, authorization expiry/revocation, deployment-source mismatch,
public verification failure, or rollback failure must return a failed receipt
and stop.

## Idempotency and conflicts

- Exact `handoffHash`, `receiptHash`, and `authorizationHash` replays are reused
  without a second PR, deployment, merge, publication event, or audit event.
- Reusing one idempotency key with different authorization bytes is a conflict.
- A job/phase that already has a different receipt hash is a conflict.
- A Preview receipt cannot be attached to a different job, claim, candidate,
  binding, PR or deployment. A Production authorization/receipt cannot be
  attached to a different Preview, PR head, base, deployment or public result.
- Claims are leases, not authorization. Retrying an expired claim requires a new
  claim ID; it does not create a new publication identity.

## Compatibility

All existing `publication-candidate/v1`, `publication-action/v1`, and
`publication-pr-receipt/v1` files remain byte-for-byte immutable and retain
their synthetic-only semantics. There is no implicit v1 → v2 conversion. v2 is
camelCase because it mirrors the live CasePilot worker API and CarKey receipt
API. Consumers must dispatch by `schemaVersion` and reject unknown versions.

Any breaking field, hash, privacy, authority, or state-transition change
requires a new versioned directory. Adding a provider-specific deployment ID is
not required for success when the GitHub deployment/status evidence is exact and
the provider ID is explicitly `unavailable`.

## Verification

Run from the integration directory:

```bash
node scripts/test-publication-closed-loop-v2.mjs
```

The script checks JSON parsing, exact root shapes, closed-object schemas,
version/environment constants, critical two-step bindings, forbidden private
field names, cross-file references, and `CHECKSUMS.sha256`.
