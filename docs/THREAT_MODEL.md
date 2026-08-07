# Threat model

Status: 1.0 alpha local-only boundary, 2026-08-07

## Assets and trust boundaries

- Sensitive assets: plan values, account/debt/cash-flow names and balances, goals, holdings, tax/protection inputs, legacy metadata, encrypted document references, Copilot consent/history, and local version history.
- Local stores: `flow-wealth-studio` IndexedDB for the current plan/snapshots, `flow-wealth-market-data` IndexedDB for observations/security metadata/provider runs, and localStorage only as a failover.
- Session-only values: provider keys, backup passphrase, legacy-reference passphrase, revealed document references, and the local question draft.
- Untrusted inputs: JSON/backup files, CSV imports, manual market snapshots, free-form names/labels, provider responses, hash routes, and future shared content.
- Current network boundary: the Vite/ngrok preview serves static application assets. It has no account, sync, sharing, analytics, AI, trade, payment, bank, tax-filing, or document-upload endpoint.

## Abuse cases and controls

| Threat | Current control | Residual risk / release gate |
|---|---|---|
| A crafted plan/backup exhausts memory or bypasses schema | 10 MB pre-read and raw-text limits, bounded identifiers/collections/numbers, versioned envelope, Zod migration, duplicate/invalid snapshot rejection, staged preview, deterministic adversarial corpus, and Chrome/Edge recovery E2E | Independent fuzzing/penetration review remains part of G9 |
| A crafted CSV exhausts memory or injects invalid ledger numbers | 2 MB, 20,000-row, 64-column, and 10,000-character cell limits; unterminated quote rejection; finite/range/date/capacity validation; import disabled when no row is safe; Chrome/Edge/WebKit hostile-input drill | Independent security review and Safari-browser evidence remain pending; Firefox is best-effort |
| Spreadsheet formula injection from names/symbols | CSV cells beginning with `=`, `+`, `-`, or `@` are prefixed with an apostrophe and every cell is quoted | Users can still remove safeguards after export |
| HTML/script injection in printable reports | All user-controlled report fields are HTML-escaped; report CSP is `default-src 'none'` | Print window must remain same-origin/local and have no remote assets |
| Backup theft | AES-256-GCM, PBKDF2-SHA-256/310k, random salt/IV, passphrase never persisted | Weak/reused passwords and copied decrypted print/CSV files remain user risks |
| Unauthorized restore or destructive deletion | Import is staged, restore/import creates a safety snapshot, deletion requires exact `DELETE` | A person with unlocked browser access can still operate the UI |
| Future broken object-level authorization | Deny unknown roles/actions, inactive membership, cross-household access, role-specific disabled flags, stale sessions, and missing recent MFA; bind key rotation to the keyring owner | Browser contract is not a backend control; hosted object-level authorization and independent review remain mandatory |
| Future sync overwrite, replay, or plan substitution | Monotonic revision/digest contract blocks rollback and plan-ID mismatch; only one-sided changes auto push/pull; concurrent changes require explicit section merge | Transport authentication, replay/idempotency controls, device revocation, and hosted offline drills remain unimplemented |
| Future account recovery exposes encrypted plans | Recovery session cannot read a plan; verified recovery factor and pre-existing client recovery envelope required; key transition cannot complete until every envelope is verified | Identity provider, recovery delivery/rate limits, real cryptography, and unrecoverable-data UX still require implementation/review |
| Future consent bypass or stale-policy processing | Exact subject/category/purpose/policy receipt plus independent purpose flag; missing, mismatched, future, revoked, or stale-policy receipt is denied | Hosted consent capture, accessibility, policy/legal review, and audit immutability remain pending |
| Future deletion reports success while backups or keys remain | Owner/household-bound request; eight unique scopes; bounded evidence digest/count/time; backup and key-envelope acknowledgement required even for zero records; completion revalidates the whole manifest | A real provider must make evidence trustworthy and prove purge across replicas, retention exceptions, and disaster-recovery media |
| Premature rollout or forged gate approval | Adjacent-only stage policy; exact evidence IDs, status, artifact, review time, and expiry validation; feature-conditional sharing/AI/G7 requirements; explicit external beta and product-owner artifacts | Real evidence signatures, repository protections, deployment identity, and independent reviewers remain external requirements |
| Incident rollback leaves a remote path active | Immutable SEV-1/2 plan forces all ten remote/transaction flags off, preserves local planner, records disabled capabilities, and requires manual reapproval | A hosted control plane, named operator/on-call, propagation timing, and rollback drill do not yet exist |
| Secret/PII leakage through Copilot | Explicit domain consent, aggregate allowlist, injection/secret/transaction screens, no external model request, audit omits question text | External AI stays disabled until separate privacy/security review |
| Market-data poisoning or identity mismatch | Contract validation, security-master priority, currency/share-class conflict rejection, last-known-good freeze, user-approved apply | Live SEC/BOT retrieval stays disabled pending G7 reconciliation/licensing |
| Diagnostic leakage | Render-boundary diagnostic records only random ID, timestamp, allowlisted route, and sanitized error class; message/stack/plan values are excluded | No remote error collector is enabled |
| Cross-user data access | Each browser origin/profile has independent IndexedDB and no backend identity | Household/advisor sharing is impossible until authorization is designed and tested |
| Transaction coercion | No broker/payment/transfer endpoint or tool exists; recommendations only create local checklist actions | Any future execution integration requires a new threat model and explicit authority |

## Required before account, sync, or sharing can be enabled

1. Select an identity provider and document session, MFA, recovery, CSRF, device, and account-takeover controls.
2. Define tenant/household ownership and advisor permissions at row and object level; deny by default and test every role pair.
3. Define encryption key ownership, rotation, recovery, revocation, and deletion verification. TLS alone is not sufficient.
4. Use opaque, random, expiring share tokens stored server-side; never put plan data or secrets in a URL.
5. Add consent receipts, access audit, export, revoke, delete, retention, backup purge, and incident notification flows.
6. Run dependency/secret scans, API authorization tests, rate/abuse limits, restore drills, privacy review, and external penetration review.
7. Keep remote flags off until Gate G9 evidence is attached to `docs/RELEASES.md`.

## Explicit non-goals in this release

- No claim of bank-grade custody, regulated investment advice, tax filing, legal document validity, deposit protection, or guaranteed return.
- No real trade, transfer, payment, broker contact, insurer contact, tax submission, cloud document storage, or background provider schedule.
