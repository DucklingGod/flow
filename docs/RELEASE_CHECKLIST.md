# Release checklist

## Automated gates

- [x] TypeScript typecheck and Oxlint
- [x] 242-test Vitest regression suite across 42 files plus 5 Node verifier integrity tests
- [x] Domain/data-platform coverage remains above configured thresholds
- [x] Production build has no chunk-size warning
- [x] Route-level code splitting verified on desktop/mobile
- [x] Plan Vault desktop/mobile has no runtime error or horizontal overflow
- [x] Plan Vault release-control panel shows 4 local-on and 10 remote-off badges with element-level desktop/mobile screenshots and no panel overflow
- [x] All 13 routes at desktop/mobile (26 checks) load without runtime error, overflow, stuck lazy fallback, or navigation breakpoint failure
- [x] All 94 editable numeric fields use the grouped formatter; desktop/mobile browser evidence confirms `1234567` → `1,234,567`, keyboard commit, zero native `type=number` controls, and zero route overflow
- [x] Studio projection chart supports pointer, touch, Arrow/Home/End/Page keys, an accessible four-series value summary, and legend show/hide controls without mutating the plan
- [x] axe-core 4.12.1 scans all 13 routes plus acknowledged Protection/Tax estimate states at desktop/mobile in Chrome and WebKit (60 scans): 0 WCAG A/AA violations and 0 incomplete results; reports omit text, selectors, form values, and plan values
- [x] Responsive accessibility preflight passes 104 Chrome/WebKit route/profile checks: 320 px and 640 px reflow, mobile landscape, forced-colors, reduced-motion, 24 px target minimum, focus indicators, state semantics, breakpoint correctness, no page overflow, clean console/runtime, and localhost-only requests
- [x] External review bundle generator validates current automated evidence and emits 15 synthetic G6 fixtures, a blank G7 reconciliation table, aggregate G9/LLM-connector and four-question Product Acceptance results, source hashes, and a non-approving sign-off form without user plan data, prompts, responses, or credentials
- [x] Product Acceptance Snapshot answers exactly four final-gate questions on desktop/mobile, shows pending-user reversible actions and known limitations, keeps the decision pending, prints a script-free packet, makes no plan mutation, and sends no external request
- [x] External review-response verifier is fail-closed: exact manifest/source/evidence hashes, bounded strict schema, distinct required roles, review dates/expiry, resolved conditional approvals, stable Product Owner identity, and G6 → G7 → G9 → Final ordering; template stays pending and no capability is enabled
- [x] Navigation micro-interactions pass in Chrome, Edge, and WebKit at desktop/mobile: button press feedback, 420 ms progress/loading pill, route enter animation, lazy-route spinner, and `prefers-reduced-motion` suppression without intentional input delay
- [x] LM Studio/OpenRouter developer-preview adapters use a typed OpenAI-compatible boundary with tolerant optional metadata and fail-closed answer extraction, validated bounded responses, actionable empty/error/streaming diagnostics, session-only credentials, no tools or automatic retry, explicit context acknowledgement, OpenRouter ZDR routing, and deterministic local fallback
- [x] LM Studio loopback diagnostics distinguish local desktop use from ngrok/phone and HTTPS mixed-content/local-network access; local browser-to-server verification discovered the loaded model without exposing a remote proxy
- [x] Gradient/texture/SVG contrast ambiguity removed from the automated matrix with semantic solid surfaces and HTML chart labels; current Chrome/WebKit reports contain 0 incomplete results
- [x] Manual accessibility protocol prepared with privacy-safe evidence fields and repeatable responsive preflight; real assistive-technology execution and sign-off remain unchecked below
- [x] Production Lighthouse Plan Vault: performance 99, accessibility 100, FCP 0.4 s, LCP 0.6 s, TBT 0 ms
- [x] Production Lighthouse Studio alpha.3: desktop performance/accessibility 100/100 (FCP 0.5 s, LCP 0.7 s, TBT 0 ms, CLS 0.003); mobile performance/accessibility 92/100 (FCP 2.0 s, LCP 3.2 s, TBT 40 ms, CLS 0.002)
- [x] Calculation-model update notice renders at 1440 px and 390 px with explicit approval, no silent-change copy, restore-point disclosure, no overflow, and zero runtime issues
- [x] Local GitHub CI mirror passes lint, typecheck, coverage, boundary scan, dependency audit, and production build
- [x] Repository ignores build, coverage, browser-work, environment, log, and encrypted-backup artifacts
- [x] Initial commit `c701d6219e495d7a883a21e50188a79abfbaed3e` pushed to `origin/main` and remote SHA verified
- [ ] GitHub-hosted `verify` workflow conclusion and URL recorded for the pushed SHA
- [ ] `main` branch protection requires the hosted `verify` check and pull-request review

## Security and privacy gates

- [x] Remote/transaction capability flags are all false
- [x] Backup encryption, wrong-password refusal, report HTML escaping, CSV formula neutralization, and safe diagnostics have tests
- [x] Local delete covers plan, snapshots, fallback keys, and market cache
- [x] Disposable IndexedDB integration drill covers snapshot/export/stage/restore/history import/delete and metric consent/revoke
- [x] Schema v1–v9 migration pins prior plans to the legacy calculation model; model adoption, engine dispatch, before-update snapshot, and report provenance have regression tests
- [x] `npm audit` reports 0 vulnerabilities; credential-shaped and prohibited transaction-endpoint scans report 0 hits
- [ ] External threat-model/security review
- [ ] Thailand financial/tax/legal expert Gate G6
- [ ] Provider reconciliation and legal/licensing Gate G7
- [x] Backup/restore/delete E2E drill in disposable Chrome and Edge profiles at 1440×1000 and 390×844; each profile is isolated from the user's normal browser data, encrypted file hash/size is recorded, and only localhost page network is observed
- [x] Dependency vulnerability and secret scan with disposition notes
- [x] Automated accessibility-tree and keyboard-focus audit across all 13 routes in Chrome and Edge at desktop/mobile viewports: zero unnamed interactive controls or headings, at least 8 distinct focus stops per route, and zero missing focus indicators; manual screen-reader review remains separate
- [x] Scenario toolbar desktop/mobile geometry check keeps the rerun-seed button aligned to its peer input within 1 px and rejects horizontal overflow
- [x] Portfolio X-Ray desktop/mobile geometry check keeps Market data provenance spacing symmetric at 10 px and rejects horizontal overflow
- [x] Legacy checklist desktop/mobile geometry check keeps delete/save action heights equal to peer inputs, aligns desktop edges within 1 px, and rejects horizontal overflow
- [x] Adversarial import corpus covers oversized JSON/CSV, UTF-8 byte limits, schema/identifier/collection bounds, duplicate snapshots, prototype-shaped keys, malformed quotes, NaN/Infinity, impossible dates, ledger capacity, and browser fail-closed staging

## Production Gate G9

- [x] Authentication/account-recovery design contract (ADR-002; implementation remains disabled)
- [x] Household/advisor authorization matrix and deny-by-default contract tests
- [x] Client-owned cloud-key lifecycle and recovery transition contract
- [x] Deterministic sync-head/offline-journal conflict contract with no silent last-write-wins
- [x] Client preflight encrypts opaque sync envelopes with non-extractable AES-GCM keys and authenticated resource/revision metadata; queue decisions require authorization and consent, block revoked devices, bind idempotent receipts, reject replay substitution, bound retries, and force concurrent changes to merge review while the real cloud-sync flag remains off
- [ ] Hosted identity/backend authorization, cryptography, recovery, consent, encrypted export, complete-scope purge, and offline-sync implementation drills
- [x] Consent/revoke/export/delete and backup/key-envelope purge executable contract verification
- [ ] Priority cross-browser critical-journey matrix (Chrome, Edge, and Playwright WebKit 26.5 desktop/mobile passed; Safari-browser evidence still pending; Firefox is retained as best-effort and is not a release blocker)
- [ ] Screen-reader/keyboard manual pass across all studios
- [x] Evidence-gated staged rollout, no-skip promotion, permanent no-transaction rule, and immutable emergency rollback contract
- [ ] Named incident owner/on-call, hosted kill-switch/rollback drill, and privacy-approved remote metrics
- [x] Known limitations documented in `docs/KNOWN_LIMITATIONS.md` and embedded in the read-only Product Acceptance Snapshot/print packet
- [ ] External beta approval

The product must remain labeled alpha/local-only until every required Gate G9 item is checked with evidence.
