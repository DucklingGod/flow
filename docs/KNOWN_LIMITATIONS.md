# Known limitations

Status: `1.0.0-alpha.3` · local-only alpha · updated 2026-08-07

This list is part of release evidence. It documents current constraints; it does not approve G6, G7, G9, beta, or the Final Gate.

## Financial and model limits

- Projection, Monte Carlo, retirement, dividend, fee, tax, and deposit outputs are planning estimates built from user-entered assumptions. They are not forecasts, guarantees, or individualized investment, tax, legal, or insurance advice.
- Monte Carlo probability is seed/configuration dependent. The Product Acceptance Snapshot caps its reproducible review run at 5,000 paths and records the exact seed/path count.
- Goal readiness is a deterministic funding ratio, not a statistical probability. The UI and acceptance packet distinguish it from Scenario Studio probability.
- Tax and Protection remain specialist-locked and disabled by default until independent G6 review is signed. No estimate may be treated as expert-approved while that gate is pending.
- Calculation model adoption is explicit and creates a restore point, but a model cannot represent every market event, life change, tax-law change, liquidity constraint, or behavioral decision.

## Data limits

- Market observations are not labeled “latest.” Price, NAV, FX, dividend, factsheet, fee, deposit-rate, and tax-rule provenance must be checked from the displayed source/as-of/licensing fields.
- SEC Thailand and Bank of Thailand live adapters remain off until real-account response reconciliation and licensing review pass G7.
- User-entered or curated values may be stale, incomplete, estimated, or licensed only for the user. Stale, invalid, quarantined, restricted, and unknown states must be resolved before relying on a portfolio recommendation.
- Provider credentials, prompts, and responses are not persisted. LM Studio/OpenRouter connectors are user-initiated developer previews; the production `externalAi` flag remains off.

## Product and operations limits

- Accounts, hosted identity, cloud persistence, household/advisor collaboration, sharing links, and external analytics are disabled. A local encrypted-envelope/offline-queue preflight exists and includes bounded opaque IndexedDB persistence for test-enabled drills, but it has no persisted key, account, device registry, server transport, or UI path and production `cloudSync` remains false. Sharing remains deferred to P9.
- Local Plan Vault supports version history, encrypted backup, restore, conflict staging, export, and deletion in the current browser profile; loss of both the browser profile and backup is not recoverable.
- There is no real trading, transfer/payment, direct debit, insurance purchase, tax filing, or transaction scheduling endpoint. Approve creates only a reversible local action.
- The ngrok link is for UI inspection. A `127.0.0.1` LM Studio endpoint refers to the device opening the page and works only when Flow is opened on the same computer; no unauthenticated public model proxy is provided.
- Chrome, Edge, and Playwright WebKit automated evidence passes. Real Safari, keyboard/screen-reader manual execution, named incident owner/on-call, hosted rollback/kill-switch drills, and independent privacy/threat review remain pending G9 evidence.
- External beta approval has not been granted. The application must remain labeled alpha/local-only until all required reviewers sign.
- The review-response verifier validates hashes, structure, roles, dates, conditions, and gate ordering, but it cannot prove that a named person owns an external signature/reference. The release owner must authenticate those references through the issuing organization or approved signing system.

## Product Acceptance Snapshot limits

- The four-question snapshot is deterministic, read-only, and printable. It does not mutate the plan, approve actions, or approve a release gate.
- Monthly actions in the snapshot remain `pending-user`; approve/dismiss decisions occur in the Recommendation Inbox and still cannot execute a real transaction.
- Product Owner acceptance remains pending until the dated packet, screenshots/demo evidence, unresolved limitations, rollback path, and G6/G7/G9 approvals are reviewed together.

Rollback: use a Plan Vault restore point or encrypted local backup. Keep the current application build and evidence bundle alongside any signed review artifact.
