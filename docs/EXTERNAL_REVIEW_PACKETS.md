# External review packets for G6, G7, G9, and Final Gate

Status: prepared for review; **no external gate is approved by this document**.

Generate the privacy-safe evidence bundle after the local/hosted browser gates pass:

```powershell
cd app
npm.cmd run evidence:external-review
```

The generated `work/external-review/<run-id>/` directory contains synthetic G6 fixtures, an empty G7 reconciliation table, aggregate G9 browser and Product Acceptance evidence, source/evidence SHA-256 hashes, known limitations, a machine-checkable `REVIEW_RESPONSE.json`, and a blank sign-off form. The generator fails if required automated evidence is missing or no longer clean. It never treats the bundle itself as approval and does not include a user plan, browser storage, backup, credential, or real provider response.

Copy `REVIEW_RESPONSE.json` before completing it; do not edit the generated evidence files. Each gate requires the named independent roles, evidence references, non-future review dates, a decision, and a verifiable signature reference. Conditional approval is effective only when every condition is resolved, evidenced, dated, and accepted by the Product Owner. The same named Product Owner must accept G6, G7, G9, and Final, while external roles must be held by distinct people.

```powershell
cd app
npm.cmd run verify:external-review -- "work/external-review/<run-id>" "<completed-response.json>"
```

The verifier checks the exact manifest bytes, evidence artifacts, current reviewed source snapshot, response bounds/schema, role separation, expiry, conditions, and the effective order G6 → G7 → G9 → Final. A zero exit means the supplied evidence contract is internally complete; it does not cryptographically authenticate the external signature reference, waive independent judgment, or turn on sharing, providers, external AI, trading, transfers, payments, or tax filing. Any source or evidence change requires a new bundle and new review.

Reviewers should record name/role, organization (if applicable), review date, version/commit or archive reviewed, findings, required changes, residual risk, and one decision: `approved`, `approved with conditions`, or `rejected`. Product-owner acceptance is a separate decision.

## G6 — Thai financial, tax, protection, and advice-boundary review

### Review scope

- Routes: `#/retirement`, `#/protection`, `#/tax`, `#/legacy`.
- Sources and assumptions: `ASSUMPTIONS.md`, `DATA_SOURCES.md`.
- Code/fixtures: `app/src/domain/retirement.ts`, `protection.ts`, `tax.ts`, and their tests.
- Product boundary: Tax and Protection start disabled, carry `expertReviewStatus=pending`, show estimates only after the user opts in, and do not sell/recommend a product or file a return.

### Required review decisions

- Retirement cash-flow, inflation, income timing, withdrawal strategies, depletion age, legacy target, and disclaimer are suitable planning estimates for Thai users.
- Protection-gap categories and income-replacement framing are not sales advice and do not imply product suitability.
- Every supported tax year, bracket, allowance, deduction cap, holding-condition reminder, effective date, and official-source link is correct for the declared dataset version.
- Unsupported/unverified rules fail closed; wording does not imply legal/tax advice or guaranteed eligibility.
- Fixtures cover low/high income, capped deductions, spouse/children/parents, donations, withholding, unsupported years, and disabled state.

### Evidence to attach

- Reviewer-marked `g6-fixtures.json` table with 15 synthetic expected-result cases and declared tolerance.
- Corrected source/effective-date list, if any.
- Approved disclaimer/advice-boundary text.
- Signed decision and conditions. Until then G6 remains open and Tax/Protection remain disabled by default.

## G7 — Provider response, identity, licensing, and live-data review

### Review scope

- Route: `#/data`; live retrieval flag must remain off during review.
- Code/contracts: `app/src/dataPlatform/contracts.ts`, `adapters.ts`, `securityMaster.ts`, `providerRegistry.ts`, `cache.ts`, and tests.
- Providers: SEC Thailand Open Data and Bank of Thailand API only through allowlisted HTTPS origins and session-only user credentials.
- Data contract: provider/source URL, observation as-of, fetch time, stale window, licensing status/notes, confidence, validation status, checksum, last-known-good freeze, and quarantine.

### Required reconciliation drill

1. Use an authorized non-production/test credential supplied by the provider account owner; never place it in source, screenshots, logs, or review artifacts.
2. Capture redacted response shapes for each enabled kind: NAV/price, FX, dividend, benchmark, factsheet, fee, deposit rate, and official rule source where entitlement permits.
3. Reconcile at least three identifiers/values/dates per kind against the provider portal or official publication.
4. Exercise 200, malformed payload, ambiguous identity, 401/403, 429, timeout, stale response, invalid checksum/contract, and provider outage.
5. Confirm currency, share class, distribution mode, hedging, ISIN/Thai fund code/ticker mapping, timezone/date semantics, rate limit, caching rights, display rights, retention, redistribution, and required attribution.
6. Confirm that invalid/quarantined data cannot replace last-known-good and that user edits reset provenance to user input.

### Evidence to attach

- Completed `g7-reconciliation-template.csv` with redacted request/response mapping and no key or personal data.
- Provider contract/entitlement/licensing decision and attribution wording.
- Reconciliation results and unresolved differences.
- Signed PROVIDER + SECURITY + PRODUCT decision. Until then live retrieval and “latest” wording remain disabled.

## G9 — Production security, privacy, recovery, accessibility, and beta review

### Review scope

- `THREAT_MODEL.md`, `SECURITY.md`, `PRIVACY.md`, `INCIDENT_RUNBOOK.md`, `RELEASE_CHECKLIST.md`, `DEFINITION_OF_DONE.md`, and current release evidence.
- Local alpha already has encrypted backups, restore points, staged conflict resolution, local deletion, opt-in local metrics, error containment, feature gates, automated accessibility-tree/keyboard route checks, 60 Chrome/WebKit axe WCAG scans with zero violations/incomplete results, a 104-check Chrome/WebKit reflow/landscape/forced-colors matrix with zero failures, and disposable-profile Chrome/Edge/WebKit-engine critical journeys at desktop/mobile. Safari browser, manual keyboard, and screen-reader evidence remain pending. Firefox is best-effort rather than a release blocker.
- Accounts, cloud sync, household/advisor roles, expiring share links, external analytics, and beta are intentionally deferred. Therefore Production G9 cannot pass yet.

### Required future controls and drills

- Authentication, account recovery, session/device revocation, abuse controls, and explicit key ownership/rotation/recovery design.
- Deny-by-default household/advisor authorization matrix with object-level tests and audit/revocation behavior.
- End-to-end encryption and sync conflict/offline reconciliation with deletion/tombstone/backup purge semantics.
- Expiring share-token threat analysis with secrets absent from URLs/logs/referrers and server-side revoke.
- Disposable-profile critical journey: onboarding → import → plan → scenario → review → encrypted export → restore → revoke/delete, including interrupted/failure paths.
- Current Chrome, Edge, and available Safari/WebKit coverage at defined desktop/mobile viewports; best-effort Firefox signal; keyboard and screen-reader manual pass.
- Independent threat-model/privacy review, incident owner/on-call, staged rollout/kill switch, rollback, consented metrics review, and external beta acceptance.

### Evidence to attach

- Architecture/data-flow/authorization diagrams and test reports.
- Cross-browser, keyboard, screen-reader, backup/restore/delete, load/performance, and security drill results.
- Privacy impact assessment, retention/deletion schedule, incident ownership, beta cohort/rollback plan, and signed SECURITY + PRODUCT decision.

## Final Gate — Product-owner four-question acceptance

The automated preflight is available in Wealth Review and through `npm run test:e2e:acceptance`. It verifies exactly four traceable answers, pending-user reversible actions, a script-free printable packet, no plan mutation, no overflow, and localhost-only page requests at desktop/mobile sizes. This is preparation evidence only: it deliberately records the Product Owner decision as `pending` and cannot sign or approve the gate.

Using a disposable or backed-up local plan, the product owner must be able to answer and trace:

1. **ตอนนี้อยู่ตรงไหน** — net worth, cash flow, debt, portfolio, goals, retirement/protection/tax status with source/as-of/model version.
2. **จะถึงเป้าหมายหรือไม่** — nominal/real result, probability/scenario range, target date, funding gap, and deposit comparison.
3. **ความเสี่ยงคืออะไร** — data freshness/licensing/uncertainty, concentration/fees/FX/sequence risk, protection gap, and model limitations.
4. **เดือนนี้ควรทำอะไรต่อ** — reversible prioritized actions with rationale/evidence and explicit approve/dismiss; no real transaction.

Attach the plan/model version, screenshots or demo recording, `KNOWN_LIMITATIONS.md`, rollback path, and the product owner's dated decision. Final Gate remains pending until G6, G7, G9, and this acceptance are all approved.
