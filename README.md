# Flow Wealth Studio

Flow Wealth Studio is a Thai-first, local-first personal wealth planning application. The 1.0 alpha adds Plan Vault with local version history, conflict-aware staged restore, password-encrypted backups, local deletion controls, opt-in local-only usability metrics, and route-level code splitting. Schema v10 also pins every plan to an auditable calculation-model version: an existing plan is never silently rerun on a newer model, and adoption requires the user to approve it after an automatic restore point is created. Accounts, cloud sync, external analytics, and sharing are deliberately still disabled. Wealth Review keeps the deterministic local Copilot as its default, provides explicit session-only developer-preview connectors for LM Studio and OpenRouter, and includes a read-only Product Acceptance Snapshot that traces four final-gate questions to source/as-of/model evidence without approving or mutating the plan. Only the aggregate context selected by the user is sent; provider credentials, prompts, and responses are not persisted in the plan, IndexedDB, audit log, or backup. SEC Thailand and Bank of Thailand live retrieval stay disabled until Gate G7 is complete, while Tax and Protection remain disabled by default pending Gate G6. No feature can trade, transfer money, submit a tax return, or give an LLM tools.

P9 includes a disabled client preflight for future encrypted sync: opaque AES-GCM envelopes and a deterministic offline queue with consent, authorization, device-revocation, idempotency, replay, retry, and conflict controls. A bounded IndexedDB adapter can retain at most 25 opaque queue items only when an explicit non-production flag is injected, removes acknowledged items, has no localStorage fallback, and is covered by complete local deletion. It has no account, persisted cloud key, backend transport, or UI entry point, and the production `cloudSync` flag remains false.

Current status: `1.0.0-alpha.3`. Product phases P0–P8 and the local Plan Vault slice are implemented. The direct LLM adapters are a user-initiated developer preview; the production `externalAi` rollout flag remains off until its privacy/security review is signed. Production remains gated by independent Thai financial/tax/legal review (G6), licensed provider reconciliation (G7), and G9 security, cross-browser, manual accessibility, recovery, and beta evidence. The GitHub CI verifies the repository's automated checks but does not waive those external gates.

## Development

```powershell
cd app
npm.cmd install
npm.cmd run dev -- --host 0.0.0.0
```

Validation:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run test:coverage
npm.cmd run check:boundaries
npm.cmd audit --audit-level=high
npm.cmd run build
```

The reproducible critical-journey verifier accepts a Chromium-family browser path, isolated run label, debug port, optional profile path, width, and height. A launched browser uses a new disposable profile; connect-only mode creates and disposes a browser context. Evidence is written under ignored `app/work/e2e/`:

```powershell
npm.cmd run test:e2e:critical -- "C:\Program Files\Google\Chrome\Application\chrome.exe" chrome-local 9331 none 1440 1000
```

WebKit uses the exact Playwright dependency and isolated contexts. Install it once; an optional viewport can narrow the run. WebKit remains the Safari-engine proxy in the priority release matrix, while Chrome and Edge are the primary local browser targets:

```powershell
npx.cmd playwright install webkit
npm.cmd run test:e2e:cross-browser -- webkit
npm.cmd run test:e2e:cross-browser -- webkit mobile
npm.cmd run test:e2e:llm-connectors
npm.cmd run test:e2e:acceptance
npm.cmd run test:e2e:studio-interactions
```

Studio View has an accessible interactive projection chart: pointer/touch chooses the nearest year, arrow/Home/End/Page keys explore the series, and each legend button can hide or restore a line. All 94 editable numeric fields use the shared grouped-number control, so `1234567` becomes `1,234,567` while typing; decimals, negative values where allowed, pasted separators, and Thai digits remain supported. The Studio interaction contract checks both desktop and mobile, audits all 13 routes for leftover native number inputs and horizontal overflow, and writes privacy-safe evidence under `app/work/studio-interactions/`.

The accessibility gate injects the pinned local `axe-core` engine into isolated Chrome/WebKit contexts and runs 60 route/state/viewport scans, including acknowledged Protection and Tax estimate states. Reports contain rule IDs, safe node signatures, and contrast metrics only—not text, selectors, form values, or plan values. The current matrix reports zero violations and zero `incomplete` results after semantic surfaces and chart labels were made directly testable; manual keyboard and screen-reader review is still required. Navigation also includes button-press feedback, a 420 ms loading indicator, route transitions, a lazy-route spinner, and automatic `prefers-reduced-motion` suppression without delaying state changes:

```powershell
npm.cmd run test:a11y
npm.cmd run test:a11y -- chrome
npm.cmd run test:a11y:layout
npm.cmd run test:a11y:layout -- chrome forced-colors-mobile
```

The responsive accessibility preflight adds 104 Chrome/WebKit route checks across 320 px and 640 px reflow widths, mobile landscape, and forced-colors with reduced motion. It enforces no page-level horizontal overflow, at least 24 CSS px for tested control targets, visible keyboard focus, correct navigation breakpoints/state semantics, clean runtime/console output, and localhost-only page requests. This repeatable preflight does not count as Safari, VoiceOver, NVDA, Narrator, or TalkBack evidence.

After the automated browser evidence is current, build the synthetic/privacy-safe packet used by external G6/G7/G9 and Product Acceptance reviewers:

```powershell
npm.cmd run evidence:external-review
npm.cmd run verify:external-review -- --latest --expect-template
```

The packet contains computed specialist fixtures, an empty provider reconciliation template, aggregate browser and four-question acceptance results, source/evidence SHA-256 hashes, known limitations, a machine-checkable `REVIEW_RESPONSE.json`, and a blank sign-off form. It contains no user plan or credentials and cannot approve a gate by itself. After independent reviewers complete a copied response, verify it with `npm.cmd run verify:external-review -- "<bundle-directory>" "<completed-response.json>"`; the command exits successfully only when hashes, required roles, dates, evidence, resolved conditions, sequential gate dependencies, and the final Product Owner decision all pass. Verification never enables a capability.

## Optional LLM connectors

Wealth Review starts in `Local rules` mode and remains fully usable offline. For LM Studio, start its local server, enable CORS, load a model, and open Flow on the same computer at `http://127.0.0.1:5173/#/reviews`. Then select `LM Studio`, test the default `http://127.0.0.1:1234/v1` endpoint, choose the discovered model, review the context, and confirm the session disclosure. If LM Studio authentication is enabled, enter its token in the session-only credential field. Flow shows an origin-aware warning when a loopback endpoint is selected from an ngrok/remote page.

For OpenRouter, select `OpenRouter`, enter a session-only API key, keep or replace the default `openrouter/free` model, review the context, and confirm before asking. Each request enforces Zero Data Retention routing and does not retry automatically. The response boundary accepts known bounded text variants while ignoring unfamiliar optional metadata; empty, incomplete, token-limited, and provider-error responses receive distinct user-facing diagnostics. OpenRouter still forwards the consented prompt to the selected model provider; review that provider's policy before using real personal data. A production deployment should place OpenRouter behind an approved server-side secret proxy instead of distributing shared credentials to browsers.

When the app is opened on a phone, `127.0.0.1` refers to the phone, not the development computer. LM Studio must be exposed on a reachable authenticated LAN/HTTPS endpoint, and browser mixed-content/CORS rules still apply. Never bind LM Studio to a public interface without authentication.

The implementation roadmap is in [PLAN.md](PLAN.md). Financial outputs are planning estimates, not guaranteed returns or individualized investment, tax, or legal advice.

Repository publication and branch-protection steps are documented in [docs/REPOSITORY_HANDOFF.md](docs/REPOSITORY_HANDOFF.md). The public `origin/main` contains the alpha history; local and hosted CI passed for `3426ab7`. Branch-protection and pull-request enforcement evidence still need owner configuration.

## Deploy to Vercel

Import the GitHub repository into Vercel and keep the repository root as the project root. The checked-in `vercel.json` installs and builds the Vite application from `app/` and publishes `app/dist`; no environment variable is required for the local-only planner. LM Studio loopback works only from the same device and OpenRouter remains a session-key developer preview, so neither connector should be treated as a production server integration.
