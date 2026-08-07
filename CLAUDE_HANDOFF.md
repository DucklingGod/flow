# Claude handoff — Flow Wealth Studio

Checkpoint date: 2026-08-07

## Objective and non-negotiable boundaries

Continue `PLAN.md` toward every phase and release gate. Household/shared-data features stay deferred to P9. Preserve explicit human approval and the permanent no-real-trading boundary: no trade/order, transfer/payment, tax filing, insurance purchase, or LLM tool execution. All ten remote/transaction release flags must remain `false` until their named external gates are genuinely approved.

## Repository checkpoint

- Public repository: `https://github.com/DucklingGod/flow.git`
- Branch: `main`
- Read the exact checkpoint with `git log -1 --oneline` and verify it matches `git ls-remote origin refs/heads/main`.
- Last fully hosted-verified commit before this checkpoint: `b53f834de655b4ad0156fdfa58089b22e6c7e7fd`.
- Successful full workflow for that commit: `https://github.com/DucklingGod/flow/actions/runs/31161673481`.
- Current release label: `1.0.0-alpha.3`; this is not Production.

## Work completed in this checkpoint

The successful workflow still emitted three warnings: the v4 actions were being forced from deprecated Node 20 to Node 24, and artifact packaging reported two `ENTRYNOTSUPPORTED` warnings. Inspection found that the workflow uploaded whole browser-work directories, including disposable Chrome profiles, LevelDB/IndexedDB files, journals, executables, downloads, and encrypted synthetic test backups.

This checkpoint:

- updates `actions/checkout`, `actions/setup-node`, and `actions/upload-artifact` from v4 to the current Node 24-compatible v7 major;
- replaces broad `app/work/*/` artifact uploads with an allowlist of build outputs, aggregate JSON reports, synthetic screenshots, and external-review packet files;
- explicitly excludes browser profiles, browser databases, downloads, journals, executables, and `.flowbackup` files;
- extends `release-boundary-scan.mjs` so a future broad artifact path, profile/download path, backup/database path, or downgraded action major fails CI;
- records the new artifact privacy boundary in Security, Releases, and the release checklist.

Local checks run for this checkpoint:

- Oxlint: pass
- TypeScript typecheck: pass
- release boundary scan: 124 files, 10 remote/transaction flags, zero findings
- `git diff --check`: pass

The previous full regression remains 244/244 Vitest tests across 42 files, verifier 5/5, 0 vulnerabilities, 60 clean axe scans, 104 clean responsive checks, and passing Chrome/WebKit critical journeys. Hosted CI must still verify the checkpoint commit itself; do not infer that result from the previous commit.

## Immediate next actions

1. Confirm the checkpoint SHA is on `origin/main` and inspect its GitHub Actions run.
2. Require the hosted `verify` job to pass.
3. Inspect check-run annotations. Expected result: no Node 20 deprecation warning and no `ENTRYNOTSUPPORTED` artifact warning.
4. If artifact upload fails, keep the privacy-safe allowlist; fix only incorrect glob depth. Do not restore broad work-directory uploads.
5. Rebase/update the six open Dependabot PRs before judging them. They were created before the accessibility-harness fixes and currently show stale failures. Do not merge TypeScript 7, jsdom 30, or Node type majors without an isolated green run.
6. Configure `main` branch protection with required `verify`, pull-request review, and resolved conversations using authenticated repository-owner access.
7. Deploy through the checked-in root `vercel.json`, then perform production desktop/mobile/hash-route/network/console smoke tests and record the deployment URL and SHA.

## External work still blocking Production

- G6 Thai financial/tax/legal expert review; Tax and Protection remain disabled-by-default estimates with `expertReviewStatus=pending`.
- G7 real provider reconciliation plus licensing/legal approval; SEC/BOT live retrieval stays off and Finnomena must not be scraped.
- Independent security/threat/privacy review.
- Real Safari and manual keyboard/screen-reader evidence.
- Hosted identity, authorization, key recovery, encrypted sync/export/delete/purge, device revocation, and offline drills.
- Named incident owner/on-call, hosted kill-switch/rollback drill, privacy-approved remote metrics, external beta approval, and Product Owner Final Gate acceptance.

## P9 sync/sharing status

Only a disabled client preflight exists: authenticated AES-GCM envelopes, deterministic queue transitions, replay/idempotency/conflict/retry controls, and a test-enabled opaque IndexedDB queue capped at 25 items and covered by local deletion. There is no account, persisted cloud key, backend transport, device service, shared state, collaboration, advisor share, or public share link. Production `cloudSync=false`; do not enable it. Sharing remains deferred.

## Important files

- `PLAN.md`
- `docs/TASK_REGISTER.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/KNOWN_LIMITATIONS.md`
- `.github/workflows/ci.yml`
- `app/scripts/release-boundary-scan.mjs`
- `app/scripts/axe-accessibility.mjs`
- `app/scripts/responsive-accessibility.mjs`
- `app/src/config/releaseFlags.ts`
- `app/src/domain/syncEnvelope.ts`
- `app/src/domain/syncQueue.ts`
- `app/src/data/planRepository.ts`
- `vercel.json`

## Verification commands

From `app/` on Windows:

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:coverage
npm.cmd run test:review-verifier
npm.cmd run check:boundaries
npm.cmd audit --audit-level=high
npm.cmd run build
```

With the app available at `http://127.0.0.1:5173`:

```powershell
npm.cmd run test:a11y
npm.cmd run test:a11y:layout
npm.cmd run test:e2e:cross-browser -- webkit
npm.cmd run test:e2e:llm-connectors
npm.cmd run test:e2e:acceptance
npm.cmd run test:e2e:studio-interactions
npm.cmd run evidence:external-review
npm.cmd run verify:external-review -- --latest --expect-template
```

Never mark G6, G7, G9, or Final complete from automated evidence alone.
