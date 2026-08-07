# Release evidence

## Unreleased — Repository delivery controls

Date: 2026-08-07

Delivered locally:

- GitHub Actions `verify` workflow for Node 24, dependency installation, lint, typecheck, coverage, release-boundary scan, high-severity dependency audit, production build, and evidence artifacts
- Weekly Dependabot checks for npm dependencies and GitHub Actions
- GitHub Actions checkout, Node setup, and artifact upload use the Node 24-compatible v7 actions. Release artifacts are restricted to an allowlist of build outputs, aggregate reports, synthetic screenshots, and external-review packet files; disposable browser profiles, browser databases, downloads, and encrypted test backups are excluded and statically guarded.
- Pull-request safety checklist, contribution guide, security reporting policy, repository handoff, and ignore rules for generated or sensitive local artifacts
- Deterministic release-boundary scan covering credential patterns, persisted secret-like values, transaction-related network calls, and ten remote/transaction flags that must remain explicitly false
- Local release-gate mirror passed: 244/244 Vitest tests across 42 files plus 5/5 Node verifier integrity tests; 93.16% statements, 85.80% branches, 96.19% functions, and 97.55% lines; 124 boundary-scanned files and all 10 remote/transaction rollout flags passed with zero findings; 0 vulnerabilities; production build passed with a 387.01 kB initial chunk and no chunk-size warning
- Reproducible critical-journey verifier moved into `app/scripts/critical-journey-e2e.mjs` and added to the GitHub workflow for desktop/mobile production-preview runs
- Added a shared locale-aware number field at all 94 editable numeric call sites. It inserts comma groups during typing, preserves valid decimal/negative drafts, accepts Thai digits and pasted separators, restores invalid/empty non-null values safely, exposes spinbutton semantics and arrow-step behavior, and leaves range/date/checkbox/password/file controls native.
- Replaced the static Studio projection with an accessible interactive chart. Mouse, touch, and keyboard can select the nearest year; a readable tooltip and ARIA value summary expose all four series; legend buttons toggle lines while preventing the final visible series from being hidden. Chrome desktop/mobile interaction evidence audited all 13 routes (26 checks) with no native number inputs, overflow, console/runtime errors, or external requests.
- Chrome 150 and Edge 151 passed the complete desktop 1440×1000 and mobile 390×844 journeys locally: exact plan/review recovery, encrypted backup, local delete/reset, 13-route accessibility/keyboard audit, zero missing focus indicators, zero runtime/console issues, no overflow, and localhost-only page network origins
- Release-control browser audit now requires exactly 14 capability badges (4 local on, 10 remote off), zero page/panel overflow, and a direct element screenshot; Chrome desktop/mobile visual evidence and Chrome/Edge desktop/mobile runtime assertions passed after adding the external-analytics kill switch
- Edge exposed a native date-input focus gap in Family & Legacy; the date control now has a `:focus-within` fallback and the verifier fails on any missing focus indicator
- Adversarial import hardening rejects oversized plan/backup/market-snapshot/CSV inputs before mutation, bounds identifiers and ledger values, deduplicates snapshot IDs, and blocks malformed quotes, non-finite values, impossible dates, and transaction-cap overflow
- Chrome 150 and Edge 151 desktop/mobile browser drills stage a hostile CSV as `พร้อม 0 / ผิด 1`, keep the import action disabled, and finish with zero runtime/console issues
- Exact Playwright 1.62.1 cross-browser harness covers the same plan→review→encrypted backup→delete→restore, 13-route focus/overflow, hostile CSV, console, and page-origin boundaries in isolated Firefox/WebKit contexts
- Playwright WebKit 26.5 passed desktop 1440×1000 and mobile 390×844 locally with zero failures, including navigation feedback and reduced-motion assertions. Firefox is outside the current product-priority CI matrix; Safari-browser evidence is still required.
- Added ADR-002 and executable P9 remote-security contracts for optional account recovery, owner/household/advisor authorization, client-owned key rotation, and deterministic offline reconciliation. These contracts fail closed and add no account, endpoint, remote persistence, or sharing capability; hosted implementation and independent review remain Gate G9 work.
- Added the first client implementation preflight for encrypted sync: non-extractable AES-GCM keys, bounded opaque envelopes with authenticated plan/household/device/key/revision/section/expiry metadata, and a pure offline queue that enforces current authorization/consent, device revocation, idempotency, replay-resistant receipts, capped exponential retry, and explicit conflict review. Nine adversarial tests pass; no key persistence, server transport, account, remote flag, or sharing path was enabled.
- Added a disabled IndexedDB persistence boundary for the opaque sync queue. It validates lifecycle states and bound IDs, caps storage at 25 entries, removes acknowledged items, refuses localStorage fallback, and is purged by complete local deletion. Production `cloudSync=false` remains the default, so no UI enqueue, key persistence, account, transport, or sharing path was enabled.
- Added a P9 privacy-lifecycle contract for versioned consent, revocation, owner-authorized encrypted export/deletion, and complete-scope purge evidence. The release boundary now checks a dedicated tenth remote flag, `externalAnalytics=false`; no remote lifecycle job or data transfer was enabled.
- Added ADR-003 and an executable staged-rollout policy with dated evidence validation, adjacent-only promotion, feature-conditional G7/sharing/AI review, an unwaivable no-transaction rule, and an immutable SEV-1/2 remote kill-switch plan. This does not assign operators, start a beta, or deploy a hosted control plane.
- Added exact `axe-core` 4.12.1 and a privacy-safe Chrome/WebKit WCAG 2.0/2.1/2.2 A/AA harness across all 13 routes, acknowledged Protection/Tax estimate states, and both release viewports. The corrected lazy-route-aware 60-scan matrix found and fixed ARIA, label, contrast, and scroll-region defects, then passed with zero violations, zero incomplete results, and zero runtime/console/external-origin failures. Decorative textures now sit behind solid semantic surfaces, while projection and retirement SVG axis labels render as testable HTML without removing the visual banner treatment.
- Added a repeatable responsive accessibility preflight across Chrome and WebKit: 13 routes × four profiles × two engines (104 checks) at 320 px/640 px reflow widths, mobile landscape, and forced-colors with reduced motion. It found and fixed undersized priority/disclosure targets, a subpixel Portfolio landscape overflow, and native-input high-contrast focus loss; the final matrix passed with zero failures, runtime/console issues, or external origins.
- Added a deterministic read-only Product Acceptance Snapshot in Wealth Review covering current position, goal feasibility, material risks, and reversible monthly next actions. Every answer carries source/as-of/model evidence; the printable packet keeps the Product Owner decision blank/pending and neither printing nor reviewing mutates the plan.
- Added a strict external review-response contract and verifier. Generated responses are anchored to exact manifest, evidence-artifact, and reviewed-source SHA-256 values; require distinct human roles, valid dates/expiry, evidence, resolved conditional approvals, one Product Owner identity, and G6 → G7 → G9 → Final ordering; verification cannot activate a capability or authenticate an external signature by itself.
- Added `docs/KNOWN_LIMITATIONS.md` and embedded the model/data/operations/G6/G7/G9 limitations in the acceptance UI and print packet. Desktop/mobile acceptance browser checks pass with four questions, five pending-user actions, no overflow, no plan mutation, and localhost-only requests.
- Corrected Scenario comparison and tornado-label contrast exposed by the expanded acceptance route; the complete 60-scan Chrome/WebKit axe matrix remains clean.
- Added a fail-closed external review bundle generator that computes 15 synthetic G6 tax/protection/retirement and specialist-lock fixtures, emits a blank nine-kind G7 provider reconciliation template, summarizes privacy-safe G9 browser and Product Acceptance evidence, hashes the reviewed source files, and provides a blank external sign-off form. The bundle explicitly keeps every gate pending and contains no user plan, credentials, browser storage, backup, or provider payload.
- Locked specialist estimates out of the consented Copilot context while Tax or Protection is disabled; the context now exposes only gate/status metadata and `null` values until the user explicitly opens the estimate.
- Added user-initiated LM Studio/OpenRouter developer-preview connectors with a shared typed contract, session-only credentials, explicit context acknowledgement, OpenRouter ZDR/no-tools requests, bounded response validation, typed 200-status provider errors, text-part support, reasoning-without-final-answer guidance, and no automatic retry. Local deterministic rules remain the default and the production `externalAi` rollout flag remains off.
- Hardened the chat-completion boundary so unfamiliar optional `model`, `usage`, `reasoning`, or refusal metadata no longer discards a valid final answer. The parser now accepts bounded string/text-part/nested-text variants, treats token usage as best-effort metadata, and reports separate actionable messages for empty choices, missing choices, incomplete streaming shapes, token limits, provider overload, and provider-unavailable errors without exposing reasoning traces or raw payloads.
- Added origin-aware LM Studio diagnostics: a loopback Base URL selected from an ngrok/remote page now explains that `127.0.0.1` points to the viewing device and directs desktop users to the local Flow URL; HTTPS-to-HTTP mixed-content/local-network risk is reported separately. A live WebKit check from local Flow reached the running LM Studio server, discovered eight models, and selected `prism-ml/bonsai-27b` without runtime errors.
- Added a WebKit desktop/mobile connector UI contract with intercepted responses: desktop textarea/button are exactly 76 px and edge-aligned, mobile controls are full-width stacked, Markdown renders as structured text, provider HTML cannot execute, credentials clear on provider change, and no real external request is made by the test.
- Added announced current/pressed states for app navigation and segmented choices, plus a manual accessibility protocol for keyboard, assistive technology, zoom/reflow, contrast, and privacy-safe evidence. Automated reflow/forced-colors preflight is complete, but real Safari/assistive-technology execution has not been signed off.
- Added responsive motion polish without slowing application state changes: button press feedback, a 420 ms top progress/loading pill, route enter transition, lazy-route spinner, and `prefers-reduced-motion` suppression. Chrome 150, Edge 151, and WebKit 26.5 passed desktop/mobile critical journeys after the change.

Pending hosted evidence:

- Initial commit `c701d6219e495d7a883a21e50188a79abfbaed3e` and follow-up documentation were pushed to the now-public `origin/main`; the public GitHub API can be used to inspect hosted runs without a CLI session.
- GitHub-hosted `verify` passed for commit `3426ab7a904fc88d11f09e387b5fc1fda904df39`: https://github.com/DucklingGod/flow/actions/runs/31161122786
- Branch protection, pull-request enforcement, and security-setting evidence remain pending. Repository-setting changes still require authenticated owner access.
- G6, G7, G9, and the Final Gate remain unchanged; local or hosted automation cannot waive these external approvals.

## 1.0.0-alpha.3 — User-approved model changes and delivery governance

Date: 2026-08-07

Delivered:

- Plan schema v10 separates schema migration from calculation-model adoption using an immutable allowlisted registry and per-plan `version`, `appliedAt`, and `appliedBy` metadata
- v1–v9 plans migrate to the current data shape while remaining pinned to `wealth-model-2026.08.0`; no historical plan silently adopts the current engine
- Version-keyed projection dispatch makes every future model version require an explicit engine handler at compile time
- A responsive calculation-model notice states the old/new releases, changed behavior, affected outputs, and that results remain unchanged until the user approves
- The notice is controlled by the fourth local compile-time capability flag, so an unsafe offered model can be withdrawn without enabling any remote feature
- Approval creates a `beforeModelUpdate` restore point before pinning the new model and rerunning affected React calculations; Plan Vault labels that reason explicitly
- Formula disclosure, CSV report, and printable report now record the exact calculation-model version
- Full task register with owner, acceptance owner, dependency, estimate, test plan, demo evidence, and honest done/partial/deferred/external-gate status for every PLAN task
- Definition of Done and model-change policy covering implementation, numerical evidence, migration, browser, accessibility, security/privacy, sources, rollback, UAT, and non-waivable external gates
- Critical-journey verifier using disposable Chrome/Edge profiles that are isolated from the user's normal browser storage; connect-only mode creates and disposes a separate Chrome BrowserContext
- Automated accessibility-tree and keyboard-focus checks for all 13 application routes at desktop and mobile viewports, plus a high-contrast global focus ring and an accessible name for the Local Wealth Copilot switch

Alpha evidence:

- TypeScript typecheck and Oxlint: passed
- Tests: 203/203 passed across 35 files
- Coverage: 95.16% statements, 87.17% branches, 95.60% functions, 98.14% lines; projection remains 100% statements/functions/lines
- Production build: passed; initial chunk 377.76 kB, Wealth Review 48.59 kB, and Plan Vault 30.08 kB, with no chunk-size warning
- Production Lighthouse Studio: desktop performance/accessibility 100/100 (FCP 0.5 s, LCP 0.7 s, TBT 0 ms, CLS 0.003); mobile performance/accessibility 92/100 (FCP 2.0 s, LCP 3.2 s, TBT 40 ms, CLS 0.002)
- Browser matrix: all 13 routes at 1440 px and 390 px (26 checks), no runtime issue, horizontal overflow, stuck lazy fallback, or navigation breakpoint failure
- Scenario toolbar geometry is regression-checked in the disposable desktop/mobile journey: the rerun-seed button and its peer field differ by only 0.25 px at the lower edge in both viewports, with no horizontal overflow
- Portfolio X-Ray section spacing is regression-checked at desktop/mobile: Market data provenance has the same 10 px gap above and below, with no horizontal overflow
- Legacy checklist action geometry is regression-checked at desktop/mobile: delete and encrypted-reference save controls match their peer input heights exactly; desktop edges differ by 0 px and mobile touch targets are 44 px, with no horizontal overflow
- Model-update browser drill: notice, no-silent-change copy, restore-point disclosure, and enabled approval control present at 1440 px and 390 px; no overflow and zero runtime issues
- Critical-journey E2E passed at 1440×1000 and 390×844: DCA 15,000→22,000, Base→Bear, monthly review completion, snapshot, encrypted backup, local delete/reset, two-section conflict staging, and exact plan/review recovery
- Each encrypted test backup was 68,964 bytes with a recorded SHA-256; reset returned 15,000/Base and restore returned 22,000/Bear with the same ฿13,178,938 projection
- Both isolated runs observed only `http://127.0.0.1:5173`, zero runtime/console issues, zero reference issues or overflow; final accessibility trees exposed 26 named desktop buttons and 20 named mobile buttons
- Chrome and Edge route/viewport accessibility audits found zero unnamed interactive controls, zero unnamed headings, at least 8 distinct keyboard focus stops per route, and zero missing focus indicators after adding a native date-input fallback. This automated evidence does not replace the pending screen-reader/keyboard manual pass.
- Plan Vault release controls show four local capabilities on and all ten remote/transaction capabilities off
- Visual inspection: desktop notice integrates above Studio without obscuring controls; mobile notice stacks copy/safety/action above the five-tab bottom navigation
- `npm audit`: 0 vulnerabilities across 310 dependencies; credential-shaped scan found no hit; prohibited transaction scan found only the ten explicitly false capability names and no endpoint

Still gated:

- The user must choose whether to adopt the offered model; browser verification intentionally did not click approval on the user's behalf.
- G6 external financial/tax review, G7 provider reconciliation/licensing, and G9 external security/privacy/manual cross-browser/beta approval remain open.
- Chrome, Edge, and Playwright WebKit-engine critical journeys are verified at desktop/mobile viewports, including current motion behavior; Safari-browser evidence remains unverified and this evidence does not satisfy the cross-browser G9 item by itself. Firefox is best-effort and not a release blocker.
- Account, cloud sync, household/advisor roles, expiring share links, external analytics, live providers, trade, transfer/payment, and tax filing remain disabled. This is local-only alpha, not Production.

## 1.0.0-alpha.2 — Conflict-safe recovery and consented local metrics

Date: 2026-08-07

Delivered:

- Restore/import comparison across 11 plan sections: identity, projection, wealth, life goals, portfolio, scenario, retirement, protection, tax, legacy, and reviews/Copilot
- Explicit current-versus-file choice for every section; no implicit array merge or last-write-wins behavior
- Cross-reference validation that blocks mixed restores with orphaned goal funding accounts, household members, retirement accounts, portfolio accounts, holdings, transactions, or legacy owners
- Safety snapshot before every confirmed restore/import remains mandatory
- Separate `flow-wealth-telemetry` IndexedDB store with consent disabled by default, 30-day retention, and an allowlist limited to route, action, timestamp, and random event ID
- Revoking metric consent immediately deletes all local metric events; the application has no analytics request or remote collector
- Release-control register sourced from compile-time flags: three local capabilities on and nine remote/transaction capabilities off
- Disposable IndexedDB integration drill covering persist, snapshot, export/stage, restore, history import, snapshot deletion, plan deletion, metric consent, metric persistence, and revoke purge

Alpha evidence:

- TypeScript typecheck and Oxlint: passed
- Tests: 148/148 passed across 28 files
- Coverage (domain + data platform): 96.45% statements, 86.53% branches, 94.98% functions, 98.64% lines
- Production build: passed; initial chunk 369.83 kB and Plan Vault 30.33 kB, with no chunk-size warning
- Browser matrix: all 13 routes at 1440 px and 390 px (26 checks), no runtime issue, horizontal overflow, stuck lazy fallback, or navigation breakpoint failure
- Plan Vault browser check: metrics switch is off by default; all nine remote flags are off; all three local flags are on; guarded export/delete controls remain disabled until their prerequisites are met
- Production Lighthouse report: performance 100, accessibility 100, FCP 0.4 s, LCP 0.6 s, TBT 0 ms, CLS 0.049
- `npm audit`: 0 vulnerabilities across 307 dependencies; static credential-shaped scan: 0 hits; broker/trade/order/payment/transfer/tax-filing endpoint scan: 0 hits

Still gated:

- P6/G6 external financial/tax review, P7/G7 live-provider response reconciliation/licensing, and P9/G9 external threat/privacy/beta approvals are not complete.
- Account recovery, encrypted cloud sync, household/advisor authorization, remote conflict reconciliation, expiring share links, and external analytics remain disabled.
- This release stays labeled local-only alpha and cannot trade, transfer, pay, file tax, contact a broker, or mutate a portfolio without the user's explicit local action.

## 1.0.0-alpha.1 — Local Plan Vault foundation

Date: 2026-08-07

Delivered:

- Plan Vault route for guest/local-only version history, encrypted backup/restore, and deletion controls
- Up to 50 plan snapshots in IndexedDB with manual labels and reason metadata; restoring or importing first captures the current plan as a safety snapshot
- Restore staging that validates schema/migrations and shows the candidate plan/history count before the user confirms a write
- Password-encrypted `.flowbackup` export using AES-256-GCM with PBKDF2-SHA-256 at 310,000 iterations, a random 16-byte salt, and random 12-byte IV; passphrases are component-memory only
- A 10 MB import limit, envelope/version checks, invalid-snapshot quarantine, and explicit refusal on wrong passwords or damaged ciphertext
- Local deletion of the plan, version history, fallback storage, and market-data cache behind an exact `DELETE` confirmation phrase
- Local UTF-8 CSV report with spreadsheet-formula neutralization and a print/Save-as-PDF report whose user fields are HTML-escaped under a deny-all external-resource CSP
- Compile-time release flags that keep account, sync, collaboration, advisor sharing, external AI, live retrieval, trade, transfer/payment, and tax filing disabled
- Render error boundary with a session-only diagnostic containing only random ID, timestamp, sanitized error class, and allowlisted route; error message/stack/plan values are excluded
- Explicit in-product boundary explaining why each browser remains separate and why accounts/sync/household/advisor sharing are still disabled
- Route-level lazy loading for all major studios; the initial production chunk fell from 636.15 kB to 368.61 kB and the previous large-chunk warning is gone

Alpha evidence:

- TypeScript typecheck and Oxlint: passed
- Tests: 139/139 passed across 25 files
- Coverage (domain + data platform): 96.41% statements, 86.26% branches, 94.75% functions, 98.58% lines
- Production build: passed with Plan Vault/reporting in a separate 20.07 kB chunk and no chunk-size warning
- Desktop browser at 1440 px: all Plan Vault sections render, guarded buttons start disabled, no runtime issue, and no horizontal overflow
- Mobile browser at 390 px: Plan Vault cards and five-tab bottom navigation render, guarded buttons start disabled, no runtime issue, and no horizontal overflow
- Cross-view browser matrix: all 13 routes passed at 1440 px and 390 px (26 checks), with lazy loading settled, correct title/heading, correct bottom-nav breakpoint, no runtime exception, and no horizontal overflow
- Clean production Lighthouse Plan Vault: performance 99, accessibility 100, FCP 0.4 s, LCP 0.6 s, TBT 0 ms, CLS 0.061

Not production-ready / still pending Gate G9:

- No account, backend, cloud synchronization, collaborator role, advisor link, share token, analytics, or remote deletion endpoint exists.
- Sync conflict resolution, end-to-end restore/delete drills in disposable profiles, non-Chromium cross-browser matrix, load budget beyond the current local Lighthouse check, external threat-model review, and staged beta remain open.

## 0.9.0-rc.1 — Local Wealth Copilot and Review Rituals

Date: 2026-08-07

Delivered:

- Plan schema v9 with backward-compatible v8 migration for explicit Copilot consent, recommendation/audit contracts, review actions, and decision journal entries
- Monthly Money Review, Quarterly Portfolio Review, and Annual Life Review with independent due/completion state
- Optional local Wealth Copilot, disabled by default, that builds a whitelisted context from user-consented aggregates only
- Deterministic Wealth Briefs derived from the existing Wealth Map, goals, portfolio, retirement, protection, and tax calculation outputs; no external model or network call is enabled
- Recommendation contract with rationale, trade-offs, assumptions, confidence, evidence/source/as-of, impact, reversibility, and approve/dismiss status
- Human approval that can add a local checklist action only; holdings and transactions remain unchanged
- Local question screening for prompt injection, transaction attempts, secrets, credentials, identity/card data, empty input, and excessive length
- Action checklist, decision journal with review dates, milestone count, context preview, and audit log that never stores question text

Gate G8 evidence:

- TypeScript typecheck: passed
- Oxlint: passed
- Tests: 128/128 passed across 21 files, including consent/no-PII context, injection and transaction refusal, sensitive-data refusal, no-consent behavior, stale data, conflicting goals, pending expert-review boundaries, approval without portfolio mutation, dismiss/audit, and review rituals
- Coverage (domain + data platform): 96.64% statements, 86.57% branches, 94.68% functions, 98.50% lines
- Production build: passed; the 636.15 kB main bundle warning is tracked for route code-splitting before Gate G9
- Desktop browser at 1440 px: Wealth Review hero, three ritual cards, Copilot control/brief, actions, journal, and audit register render with no runtime issue or horizontal overflow
- Mobile browser at 390 px: five-tab bottom navigation remains visible, all required review modules render, and there is no runtime issue or horizontal overflow
- Copilot starts locked/off and brief generation remains disabled until the user enables it; all calculations remain available while it is off
- Static boundary: no external AI request, broker, trade, payment, bank-transfer, tax-filing, cloud-sharing, or question-text logging path

## 0.8.0-rc.1 — Auditable Data Platform

Date: 2026-08-07

Delivered:

- Plan schema v8 with backward-compatible v7 migration and full holding provenance: provider, direct URL, source as-of, fetched-at, freshness window, licensing, confidence, and validation status
- Separate `flow-wealth-market-data` IndexedDB cache for security identities, observations, and provider runs; the financial plan remains independently available when a provider fails
- Security-master resolution in priority order: ISIN, Thai fund code/share class, then ticker/exchange/share class; conflicts and duplicate identities are rejected
- Observation contract for NAV, price, FX, dividend, benchmark, factsheet, fee, deposit rate, and tax rules with required dates, checksum, source, license, confidence, and validation state
- Last-known-good selection that freezes the prior valid observation when a newer row is invalid or quarantined; missing/stale/restricted data is never replaced by a hidden estimate
- Provider registry with session-key authorization, retry/backoff, local rate-limit guard, origin allowlist, contract checks, and backend-only scheduled-ingestion boundary
- SEC Thailand and Bank of Thailand adapter contracts plus functional official-tax and user-authorized manual-snapshot adapters
- Data Studio provider catalogue, static-tax bootstrap, JSON import/template, provenance register, stale-data drill, and responsive desktop/mobile layouts
- Explicit human-approved snapshot application to a selected holding; stale/currency-incompatible observations are rejected and successful application resets policy approval to draft

Release-candidate evidence:

- TypeScript typecheck: passed
- Oxlint: passed
- Tests: 118/118 passed, including provider contracts, security resolution, schema v7→v8 migration, stale/fallback behavior, cache, adapter authorization, and plan integration
- Coverage (domain + data platform): 96.99% statements, 88.32% branches, 94.85% functions, 98.96% lines
- Production build: passed
- Desktop browser at 1440 px: four provider cards, four official observations, seven source links, no runtime issue, and document width equals viewport width
- Mobile browser at 390 px: Data Studio hero/catalogue/register render, five-tab bottom navigation remains visible, no runtime issue, and no horizontal overflow
- Static boundary: no broker, trade, payment, bank-transfer, custody, tax-filing, cloud-sharing, or persistent credential path

Pending Gate G7:

- Live SEC/BOT retrieval remains disabled until a user has valid provider entitlements, exact response mappers pass reconciliation against provider samples, and legal/licensing use is reviewed.
- The UI deliberately says “requires authorization” and “dated snapshot”; it does not label provider data “latest”.
- Scheduled ingestion has a tested backend-only guard but no scheduler is enabled because this release has no trusted backend.
- Finnomena scraping is not selected as a data source; official SEC Open Data is preferred for Thai fund facts/NAV until a licensed Finnomena integration is documented.

## 0.7.0-rc.1 — Lifetime Planning Suite

Date: 2026-08-07

Delivered:

- Schema v7 with backward-compatible v6 migration for retirement, protection, tax, and legacy configuration
- Retirement cash-flow from current age through age 100/110 with separately modeled accumulation and withdrawal phases, general/healthcare inflation, recurring and one-time income, selected funding accounts, and duplicate-income protection
- Fixed-real, percentage, guardrails, and cash-bucket withdrawal policies plus glide path, first-year shock, legacy target, and first unmet/depletion age
- Protection Gap for emergency reserve, debt payoff, dependant income replacement, education/final expenses, health annual limit, and disability monthly income without product recommendations
- Thailand PIT 2025 draft dataset with progressive brackets, supported deductions, cap inventory, withholding comparison, official-source register, effective dates, and unsupported-year shutdown
- Family & Legacy readiness, ownership/status CRUD, beneficiary review, emergency contact, and PBKDF2-SHA-256/AES-GCM encrypted local document references; no document upload
- Separate hash-routed Retirement, Protection, Tax, and Legacy windows with a suite switcher, desktop sidebar compatibility, and mobile More navigation
- Persistent `expertReviewStatus=pending`; Tax and Protection are disabled by default and can only be opened as user-acknowledged estimates

Release-candidate evidence:

- TypeScript typecheck: passed
- Oxlint: passed
- Tests: 73/73 passed
- Coverage: 97.73% statements, 85.27% branches, 98.93% functions, 100% lines
- Production build: passed
- Retirement/Protection/Tax/Legacy desktop route sweep: zero runtime issues and zero body-level horizontal overflow at 1440 px
- Mobile browser checks at 390 px: all four planning views render, suite navigation and five-tab bottom navigation remain usable, and document width equals viewport width
- Tax browser gate: estimate locked by default, dataset/version visible, four official-source links rendered
- Protection browser gate: estimate locked by default with `expertReviewStatus=pending`
- Static boundary: no trade, bank, payment, broker, custody, tax-filing, document-upload, or cloud-sharing endpoint

Pending Gate G6:

- A qualified financial/tax expert has not yet signed off on calculation fixtures, disclaimers, and advice boundaries. This is therefore an RC, not a completed P6 release.
- Tax covers a salary-first planning subset. Other income categories, special deductions, filing forms, and case-specific eligibility remain out of scope and visibly warned.
- Protection needs are planning estimates and do not model policy exclusions, waiting periods, co-pay, renewability, underwriting, or claims.
- Sharing and cloud collaboration remain deferred to P9.

## 0.6.0 — Scenario Studio and Workspace Navigation

Date: 2026-08-06

Delivered:

- Seeded Monte Carlo engine in a dedicated Web Worker with configurable return, volatility, equity/bond correlation, inflation, FX, fee, and contribution timing
- P10/P50/P90, inflation-adjusted median, target probability, scenario comparison, and the top three sensitivity drivers
- Transparent equity-crash, rates/inflation, FX, income-loss, and healthcare stress presets plus fully editable custom shocks
- Sequence-of-returns stress, contribution pause, retirement delay, home-price overrun, early drawdown, and partial recovery
- Version 5 to version 6 local-plan migration with reproducible simulation defaults and persisted stress configuration
- Hash-routed workspace views so Studio, Wealth Map, Life Canvas, Portfolio X-Ray, Scenario Studio, Retirement, and Wealth Review no longer render as one continuous page
- Desktop sidebar with active-view state, browser Back support, mobile five-tab bottom navigation with More hub, and a floating back-to-top control
- Desktop typography floor increased by about 20%, with responsive mobile type tokens and expanded portfolio columns
- Self-hosted Noto Sans Thai and optimized banner/logo assets while preserving the original image files

Gate G5 evidence:

- TypeScript typecheck: passed
- Oxlint: passed
- Tests: 52/52 passed, including seeded reproducibility, ordered percentiles, directional sanity, stress impacts, and 5,000-path performance
- Coverage: 98.12% statements, 85.94% branches, 98.59% functions, 100% lines
- Worker runtime observed in Chrome: 5,000 paths in 31–95 ms without blocking navigation
- Chrome interaction: named preset changed exposed shock values, seed rerun matched exactly, and selection persisted after reload
- Desktop/mobile workspace audit: only the active module renders, hash/history navigation works, and every tested view has zero body-level horizontal overflow
- Back-to-top control appeared after 420 px, returned to y=0, and stayed above the mobile bottom navigation
- Production Lighthouse: performance 94, accessibility 100, FCP 1.7 s, LCP 3.0 s, TBT 30 ms, CLS 0.002

Known boundary:

- Monte Carlo inputs are user-defined and are not yet calibrated to a verified historical dataset; the UI labels them as a model rather than a forecast.
- Stress shapes are planning scenarios, not predictions, personalized suitability advice, or guaranteed loss limits.
- Retirement cash-flow withdrawal modeling remains P6. No trade, transfer, custody, or automatic rebalance endpoint exists.
- Sharing and cloud collaboration remain deferred to P9.

## 0.5.0 — Portfolio X-Ray and Investment Policy Studio

Date: 2026-08-06

Delivered:

- Portfolio account, holding, and transaction CRUD with local persistence
- THB market value, average cost, realized/unrealized return, captured dividends/fees, FX conversion, and editable benchmark comparison
- Asset-class, geography, sector, currency, factor/theme, hedged/unhedged FX, duration, and credit-quality lenses
- Fund look-through overlap, concentration HHI, volatility/drawdown proxies, correlation proxy, fee drag, income yield, and risk contribution
- Investment Policy targets, max-holding rule, rebalance bands, preview amounts, and explicit approval state without execution
- Recommendation trace from every out-of-band asset class back to holding, source, and as-of date
- CSV column mapping, quoted-field parsing, validation report, duplicate separation, editable staging, and valid-row-only import
- Version 4 to version 5 local migration with hot-reload guard

Gate G4 evidence:

- TypeScript typecheck: passed
- Oxlint: passed
- Tests: 45/45 passed
- Coverage: 99.04% statements, 86.17% branches, 99.16% functions, 100% lines
- Production build: passed
- Reconciliation tests passed for seed totals, duplicate rows, FX, buy/sell, dividend, fee, split, invalid split, and sell-over-balance
- Chrome CRUD persistence: holdings persisted 5→6 and 6→5 after reload
- Chrome approval persistence: preview approval remained after reload and continued to state that no order exists
- CSV browser validation: valid/duplicate/invalid counts rendered from staging without silent correction
- Desktop/mobile runtime: zero console/runtime issues and zero horizontal overflow
- Lighthouse accessibility: 100/100 with zero failed binary accessibility audits
- Static source audit: no trade, broker, or order-execution endpoint found

Known boundary:

- Illustrative holdings and exposures are editable seed data, not live prices or verified current fund holdings.
- Correlation, volatility, and drawdown remain input/proxy-based until P5 adds scenario simulation and time-series evidence.
- Approval records a human decision on a local preview only; it never executes a trade.
- Sharing and cloud sync remain deferred to P9.

## 0.4.0 — Life Canvas and Multi-goal Funding Engine

Date: 2026-08-06

Delivered:

- Drag-enabled 0–40 year timelines for home, education, wedding, family care, business, career break, retirement, emergency, and custom goals
- Goal CRUD with priority, status, target month/amount, goal-specific inflation, funded amount, minimum monthly funding, account, and household owner
- Household member CRUD with safe orphan detection instead of silently reassigning goals
- One-budget allocator across extra debt payment and all active goals, ordered by priority and nearest deadline without double-counting
- Deterministic Goal Success/readiness, inflation-adjusted funding gap, required monthly amount, allocated amount, and collision reason
- In-memory v3 to v4 migration guard for uninterrupted Vite hot reload

Gate G3 evidence:

- TypeScript typecheck: passed
- Oxlint: passed
- Tests: 38/38 passed
- Coverage: 100% statements, 94.33% branches, 100% functions, 100% lines
- Golden cases passed for overlapping goals, insufficient/negative cash flow, paused contribution, completed/cancelled goals, missing accounts, and household-member removal
- Chrome interaction: timeline dragged 1→10 years and target month updated
- Chrome CRUD persistence: goal count persisted 3→4 after reload and 4→3 after delete/reload
- Desktop/mobile runtime: zero console/runtime issues and zero horizontal overflow
- Lighthouse accessibility: 100/100 with zero failed binary accessibility audits

Known boundary:

- Goal Success is deterministic readiness, not Monte Carlo probability; probability distributions remain P5.
- Allocation suggestions do not transfer money, trade, or change an external account.
- Sharing and household collaboration remain deferred to P9; household members currently organize one local plan only.

## 0.3.0 — Wealth Map, Cash Flow and Debt Studio

Date: 2026-08-06

Delivered:

- Reconciled account ledger for cash, investments, property, insurance surrender value, and non-market/other assets
- Recurring monthly/annual income and expense CRUD with categories and monthly snapshots
- Emergency-fund runway, savings rate, debt-to-assets, and explainable 100-point Wealth Health drivers
- Net Worth history snapshots without overwriting earlier records
- Debt amortization with avalanche/snowball order, debt-free date, total interest, and extra-payment control
- Refinance net-saving comparison after fees and debt-vs-invest trade-off with explicit risk language
- JSON backup/restore with schema validation and version 1/2 to version 3 migration
- IndexedDB/localStorage local-first autosave; collaboration and cloud sync remain deferred to P9

Gate G2 evidence:

- TypeScript typecheck: passed
- Oxlint: passed
- Tests: 32/32 passed
- Coverage: 100% statements, 93.04% branches, 100% functions, 100% lines
- Production build: passed
- Lighthouse accessibility: 100/100 with zero failed binary accessibility audits
- Chrome desktop/mobile runtime: zero console/runtime issues and zero horizontal overflow
- Clean-profile DOM reconciliation: 3 asset accounts, 2 cash-flow entries, and 1 debt matched the computed totals
- Public ngrok endpoint: HTTP 200 with Vite hot-reload client present

Known boundary:

- Debt-vs-invest return is a modeled, uncertain comparison; interest saved from debt repayment is structurally different from market return.
- No bank connection, payment, trading, automated refinance, or external transaction endpoint exists.
- Sharing, household collaboration, and cloud sync remain deferred to P9.

## 0.2.0 — Financial Calculation Engine

Date: 2026-08-06

Delivered:

- DCA and lump-sum modes
- Beginning/end-of-month contribution timing
- Irregular contributions by month
- Bear/Base/Bull deterministic scenarios
- Dividend cash or reinvestment with configurable dividend tax
- Annual fee, inflation, foreign allocation, and FX assumption
- Fixed-deposit gross/net comparison with interest tax
- Reverse calculation for required initial capital and monthly contribution
- Target-reached estimate, funding gap, nominal/real, and before/after fee-tax breakdown
- Version 1 to version 2 local-plan migration

Gate G1 evidence:

- TypeScript typecheck: passed
- Oxlint: passed
- Tests: 19/19 passed
- Coverage: 99.23% statements, 87.71% branches, 100% functions, 100% lines
- Production build: passed
- Lighthouse accessibility: 100/100 with zero failed binary accessibility audits
- Desktop and mobile headless-browser screenshots reviewed
- Public ngrok endpoint: HTTP 200 with Vite hot-reload client present

Known boundary:

- Results are deterministic planning estimates, not forecasts or guarantees.
- No real trading, bank transfer, custody, or automated rebalance endpoint exists.
- Product-level tax and transaction details remain explicit future work.
- Collaborative sharing remains deferred to P9.
