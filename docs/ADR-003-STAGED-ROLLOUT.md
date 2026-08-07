# ADR-003: Evidence-gated rollout and emergency rollback

- Status: Accepted as an executable policy contract; no hosted rollout is active
- Date: 2026-08-07
- Scope: P9-T05b

## Decision

Flow Wealth Studio uses a one-step promotion sequence:

`off → internal → closedBeta → canary → production`

The policy is evaluated from explicit, traceable evidence records. A green test does not manufacture an external approval, and the evaluator does not persist or apply a stage by itself. Promotion remains a human-owned release action.

## Stage rules

### Internal

- Requires the local release mirror.
- Every remote and transaction capability must remain off.
- The local planner, encrypted local backup, reports, and deterministic local Copilot remain usable.

### Closed beta

- Requires hosted CI and branch protection.
- Requires threat/privacy review; authentication, authorization, cloud-key recovery, sync-conflict, and complete-scope deletion drills; priority-browser coverage including Safari plus manual accessibility evidence; named incident/on-call coverage; rollback drill; and metrics privacy approval. Firefox coverage is best-effort rather than a promotion blocker.
- Household/advisor capabilities add a sharing-security review requirement.
- External AI adds a separate AI review requirement.
- Live market retrieval adds G7 provider reconciliation/legal review even before Production.

### Canary

- Requires every closed-beta item plus external beta acceptance.
- Promotion cannot skip closed beta.

### Production

- Requires every canary item plus G6 expert review, G7 provider/legal review, and an explicit product-owner approval artifact.
- Missing, pending, rejected, mismatched, future-dated, expired, or untraceable evidence is invalid.

### Permanent transaction boundary

`tradeExecution`, `paymentOrTransfer`, and `taxFiling` block every promotion stage. No evidence record can waive this rule. Recommendations remain proposals requiring user approval and cannot create or submit a real transaction.

## Emergency rollback

- A valid SEV-1 or SEV-2 incident can generate an immutable rollback plan.
- The plan sets all ten remote/transaction flags to `false`, moves the next stage to `off`, and preserves enabled local capabilities.
- The output lists which remote capabilities were disabled and always sets `requiresManualReapproval=true`.
- Recovery never re-enables a capability automatically. A new forward promotion must satisfy current evidence again.

The reference implementation and adversarial tests are in `app/src/domain/rolloutPolicy.ts` and `app/src/domain/rolloutPolicy.test.ts`.

## Remaining operational work

- Name an incident owner and on-call rotation.
- Approve the privacy posture of any hosted metrics collector; the current metrics store remains local-only.
- Deploy and drill a real server-side kill switch and rollback path in a disposable environment.
- Complete hosted CI, cross-browser/manual accessibility, G6, G7, external beta, and product-owner evidence.
- Keep sharing and all other remote flags disabled until their implementation and conditional reviews pass.
