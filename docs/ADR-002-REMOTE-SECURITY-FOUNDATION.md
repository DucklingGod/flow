# ADR-002: Remote account, authorization, key, and sync foundation

- Status: Accepted as a design and executable contract; remote implementation remains disabled
- Date: 2026-08-07
- Scope: P9-T01a only

## Context

Flow Wealth Studio is guest-first and local-first. P9 may later add an optional account, encrypted cloud sync, household collaboration, and advisor read-only access. Those capabilities create authorization, recovery, encryption-key, conflict, deletion, and incident risks that must be specified before a backend or remote UI is enabled.

The current release flags for `account`, `cloudSync`, `householdCollaboration`, and `advisorSharing` remain `false`. This ADR does not authorize a provider, create an endpoint, transmit a plan, or enable sharing.

## Decisions

### Account and recovery

- Guest/local mode remains fully usable and must not be converted into an account implicitly.
- Account enrollment, migration of a local plan, and every remote data category require separate, explicit consent.
- A normal session and a recovery session are separate capabilities. A recovery session can request account recovery only; it cannot view, edit, export, or delete a plan.
- Recovery requires a verified, user-held recovery factor. Support staff and a password reset alone cannot decrypt a plan.
- If the user loses every client-held unlock and recovery factor, encrypted cloud content is unrecoverable. The product must state this before enrollment rather than promise an administrative bypass.
- Sensitive actions require recent MFA and reauthentication. The executable contract currently uses a maximum ten-minute age for export, deletion, member management, key rotation, and advisor-share changes.

### Authorization

Authorization must be enforced at the backend resource boundary when a backend exists. The browser contract is defense in depth and a test oracle, never the sole access control.

| Role | View | Edit | Export | Delete cloud data | Manage members/keys/shares |
| --- | --- | --- | --- | --- | --- |
| Owner | Yes | Yes | Recent MFA | Recent MFA | Recent MFA |
| Household editor | Yes | Yes | No | No | No |
| Household viewer | Yes | No | No | No | No |
| Advisor read-only | Yes | No | No | No | No |

- Unknown roles and actions are denied.
- Invited or revoked memberships are denied.
- A subject cannot cross a household resource boundary.
- Household and advisor roles require their specific feature flag as well as cloud sync.
- Export is owner-only because it is a data-exfiltration boundary, not merely a read action.

The reference implementation and adversarial matrix live in `app/src/domain/remoteSecurity.ts` and `app/src/domain/remoteSecurity.test.ts`.

### Client-owned cloud keys

- The client generates plan data-encryption keys. A provider may store ciphertext, key identifiers, envelopes, and lifecycle metadata but never plaintext key material.
- A key identifier is opaque metadata and is not a key or credential.
- Scheduled rotation requires an authenticated owner with recent MFA. Recovery rotation requires a verified recovery session and a pre-existing recovery envelope.
- Rotation is staged: generate a new client key, rewrap every plan key, verify every new envelope, then retire the previous key. Partial completion cannot activate the new key or retire the previous one.
- Authorization is bound to the keyring owner subject, preventing a valid owner session for one account from rotating another account's keyring.
- Actual cryptography, credential enrollment, server storage, rate limiting, and recovery delivery remain unimplemented and must undergo an independent review.

### Offline sync and conflicts

- Each sync head has a plan ID, monotonic revision, and digest. Invalid heads, plan substitution, and revision rollback are blocked.
- A push or pull is automatic only when exactly one side changed from the common base.
- Equal content is a no-op even if revision counters differ.
- Concurrent or ambiguous changes always become `mergeRequired`; the existing 11-section conflict resolver must collect an explicit user choice and validate references. There is no silent last-write-wins path.
- Offline mutation journals accept only explicit plan-section IDs, unique section entries, a valid base revision, and bounded identifiers.

The deterministic protocol and tests live in `app/src/domain/syncProtocol.ts` and `app/src/domain/syncProtocol.test.ts`.

The client preflight now also includes `syncEnvelope.ts`, `syncQueue.ts`, and a disabled persistence boundary in `planRepository.ts`. It can create a bounded opaque AES-GCM envelope using a non-extractable client key, authenticates the plan/household/device/key/revision/section/expiry metadata, and models an offline queue with authorization, consent, idempotency, revoked-device blocking, bounded retry, receipt binding, replay refusal, and explicit conflict handling. When an explicit test-only cloud-sync flag is supplied, valid non-terminal opaque items can be stored in IndexedDB up to 25 entries; acknowledged items are removed, malformed lifecycle states are refused, no localStorage fallback exists, and complete local deletion purges the queue. This is not a deployed sync path: no key is persisted, no account or transport exists, the browser does not enqueue it from the UI, and production `cloudSync=false` blocks the default code path.

### Consent and remote data lifecycle

- Every remote data category and purpose requires an exact, versioned consent receipt. A receipt is bound to one subject, category, purpose, and privacy-policy version; missing, malformed, future-dated, stale-policy, mismatched, or revoked consent is denied.
- Consent does not override a release flag. Cloud sync, household collaboration, advisor sharing, and external analytics each have an independent compile-time kill switch and remain disabled.
- Revocation immediately plans processing suspension, purpose-token revocation, and pending-upload deletion. Revocation is not falsely presented as proof that remote copies were deleted; the user must separately choose export, retention where legally required, or deletion.
- Remote export requires a recently authenticated owner and produces an encrypted, user-keyed export manifest only.
- Remote deletion requires a recently authenticated owner bound to the same subject and household. Completion requires unique, validated evidence for primary ciphertext, version history, sync queues, cloud backups, key envelopes, advisor grants, provider caches, and remote metrics. A zero-record store still requires a verified acknowledgement.
- Completion revalidates every evidence record rather than trusting a caller-constructed manifest. Missing backup/key-envelope evidence, malformed digests, time inconsistencies, duplicate scopes, or conflicting acknowledgements fail closed.

The executable lifecycle contract and tests live in `app/src/domain/privacyLifecycle.ts` and `app/src/domain/privacyLifecycle.test.ts`. No receipt, account identifier, export job, deletion job, or purge evidence is persisted or transmitted in the current release.

## Required before any remote flag changes

1. Select and legally approve an identity/cloud provider and deployment region.
2. Implement backend authorization independently from the browser contract, including object-level deny tests and rate limits.
3. Complete cryptographic design review, key-generation/envelope implementation, rotation/recovery drills, ciphertext backup purge, and evidence-integrity review.
4. Implement authenticated server transport, persistent client-key recovery, device registry/revocation, and audit events around the existing idempotency/replay/offline-queue/forced-conflict client preflight.
5. Verify consent, revocation, migration preview/rollback, encrypted export, deletion across every manifest scope, account recovery, and incident response in disposable hosted environments.
6. Complete external privacy/threat review, cross-browser/manual accessibility evidence, staged beta approval, and the remaining Gate G9 checklist.

Sharing remains deferred within P9 and cannot be enabled merely because this contract exists.
