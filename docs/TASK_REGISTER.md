# Delivery task register

This register turns every task in `PLAN.md` into an auditable delivery item. `PLAN.md` remains the product roadmap; this file owns execution metadata and evidence pointers.

## Ownership and estimates

- `ENG`: implementation and automated verification in this repository.
- `PRODUCT`: product owner/user acceptance; no model update, recommendation, or portfolio change is approved on the user's behalf.
- `EXPERT`: independent Thai financial/tax/legal reviewer.
- `SECURITY`: independent security/privacy reviewer.
- `PROVIDER`: licensed data-provider account owner and contract reviewer.
- Estimates are vertical-slice sizes: `S` (up to 1 focused cycle), `M` (2–3 cycles), `L` (4+ cycles or external coordination). They are planning ranges, not deadlines.
- Status: `done` means implementation plus repository evidence exists; `external-gate` and `deferred` are not release-complete.

## P0–P5 core planning slices

| ID | Status | Owner / acceptance | Dependencies | Est. | Test plan | Demo evidence |
|---|---|---|---|---|---|---|
| P0-T01 | done | ENG / PRODUCT | none | M | build, route smoke | `app/src/App.tsx`, Studio route |
| P0-T02 | done | ENG / PRODUCT | P0-T01 | L | schema parse/migrations | `app/src/domain/schema.ts`, `schema.test.ts` |
| P0-T03 | done | ENG / PRODUCT | P0-T01 | M | desktop/mobile matrix, a11y | `app/src/App.css`, 26-route verifier |
| P0-T04 | done | ENG / PRODUCT | P0-T02 | M | doc/source review | `docs/ASSUMPTIONS.md`, `DATA_SOURCES.md`, `PRIVACY.md`, `SECURITY.md` |
| P1-T01 | done | ENG / PRODUCT | G0 | L | golden/property cases | `domain/finance/projection.test.ts`, Studio assumptions |
| P1-T02 | done | ENG / PRODUCT | P1-T01 | M | reverse-solver cases | Reverse Goal card |
| P1-T03 | done | ENG / PRODUCT | P1-T01 | M | result audit tests | Goal Projection formula/audit strips |
| P1-T04 | done | ENG / PRODUCT | P1-T01–03 | M | spreadsheet golden/property suite | `domain/finance/projection.test.ts` |
| P2-T01 | done | ENG / PRODUCT | G1 | L | CRUD/reconciliation | Wealth Map account ledger |
| P2-T02 | done | ENG / PRODUCT | P2-T01 | M | cash-flow/runway/trend tests | Wealth Map cash-flow planner |
| P2-T03 | done | ENG / PRODUCT | P2-T01 | L | amortization/strategy edge cases | Debt Studio |
| P2-T04 | done | ENG / PRODUCT | P2-T01–03 | M | score driver/threshold tests | Wealth Health Score |
| P3-T01 | done | ENG / PRODUCT | G2 | M | goal CRUD/timeline browser | Life Canvas |
| P3-T02 | done | ENG / PRODUCT | P3-T01 | M | overlap/member/status cases | Life Canvas goal editor |
| P3-T03 | done | ENG / PRODUCT | P3-T02 | L | insufficient-cash/trade-off cases | Goal funding allocator |
| P3-T04 | done | ENG / PRODUCT | P3-T03 | M | probability/action tests | Life Canvas success cards |
| P4-T01 | done | ENG / PRODUCT | G3 | L | holdings/transaction reconciliation | Portfolio X-Ray ledger |
| P4-T02 | done | ENG / PRODUCT | P4-T01 | L | exposure aggregation cases | Allocation/exposure views |
| P4-T03 | done | ENG / PRODUCT | P4-T01–02 | L | overlap/risk/fee cases | Portfolio diagnostics |
| P4-T04 | done | ENG / PRODUCT | P4-T03 | M | preview-only/no-execution tests | IPS and approval status |
| P4-T05 | done | ENG / PRODUCT | P4-T01 | M | mapping/duplicate/rejection tests | Portfolio CSV import |
| P5-T01 | done | ENG / PRODUCT | G4 | M | preset/shock determinism | Scenario Studio |
| P5-T02 | done | ENG / PRODUCT | P5-T01 | L | seeded statistical sanity/performance | Monte Carlo worker |
| P5-T03 | done | ENG / PRODUCT | P5-T02 | M | sequence/pause/delay/overrun cases | Scenario stress controls |
| P5-T04 | done | ENG / PRODUCT | P5-T01–03 | M | sensitivity ranking tests | Scenario comparison/tornado |

## P6–P8 governed specialist/data/Copilot slices

| ID | Status | Owner / acceptance | Dependencies | Est. | Test plan | Demo evidence |
|---|---|---|---|---|---|---|
| P6-T01 | done | ENG / PRODUCT | G5 | L | retirement cash-flow fixtures | Retirement Studio |
| P6-T02 | done | ENG / PRODUCT | P6-T01 | L | strategy/guardrail/depletion cases | Retirement strategies |
| P6-T03 | done; expert-gated | ENG / EXPERT+PRODUCT | P6-T01 | M | protection fixtures | Protection Gap, disabled by default |
| P6-T04 | done; expert-gated | ENG / EXPERT+PRODUCT | P6-T01 | L | tax-year/limit/source cases | Thailand Tax, estimate-only |
| P6-T05 | done | ENG / PRODUCT | P6-T01 | M | reference/readiness cases | Family & Legacy |
| P7-T01 | done; live off | ENG / PROVIDER+PRODUCT | G6 | L | adapter/cache/fallback contracts | Data Studio/manual snapshots |
| P7-T02 | done | ENG / PROVIDER+PRODUCT | P7-T01 | L | identity conflict/ambiguity cases | security master tests |
| P7-T03 | done | ENG / PRODUCT | P7-T01–02 | M | provenance/stale/validation cases | Data Studio provenance cards |
| P7-T04 | done; backend off | ENG / SECURITY+PRODUCT | P7-T01–03 | M | retry/rate-limit/freeze-LKG tests | provider registry tests |
| P8-T01 | done | ENG / PRODUCT | G7 local fallback | M | consent/redaction/injection tests | Wealth Review context preview |
| P8-T02 | done | ENG / PRODUCT | P8-T01 | M | deterministic output/evidence tests | Wealth Brief |
| P8-T03 | done | ENG / PRODUCT | P8-T02 | M | approve/dismiss/no-transaction tests | recommendation cards |
| P8-T04 | done | ENG / PRODUCT | P8-T02 | M | review/action/journal tests | Wealth Review rituals |
| P8-T05 | done | ENG / PRODUCT | P8-T01–04 | M | red-team evaluation set | `domain/copilot.test.ts` |
| P8-T06 | done as developer preview; external rollout review pending | ENG+SECURITY / PRODUCT | P8-T01–05 | M | provider contract, tolerant optional metadata, bounded answer extraction, actionable error mapping, session-secret and WebKit UI boundary tests | LM Studio/OpenRouter selector in Wealth Review; local rules remain default |

## P9 production/collaboration slices

| ID | Status | Owner / acceptance | Dependencies | Est. | Test plan | Demo evidence |
|---|---|---|---|---|---|---|
| P9-T00 | done | ENG / PRODUCT | G8 | L | repository/integration/browser/security | Plan Vault local alpha |
| P9-T01 | deferred | ENG+SECURITY / PRODUCT | auth/key/role design | L | recovery, deny-by-default roles, purge | remote flags remain off |
| P9-T01a | done as design contract | ENG+SECURITY / PRODUCT | P9-T00 | M | 14 authorization/key/sync adversarial tests | ADR-002; remote implementation remains off |
| P9-T01b | done as lifecycle contract | ENG+SECURITY / PRODUCT | P9-T01a | M | 8 consent/export/delete/purge adversarial tests | complete-scope manifest; hosted purge drill pending |
| P9-T01c | done as client preflight; transport disabled | ENG+SECURITY / SECURITY+PRODUCT | P9-T01a–b | M | 9 AES-GCM envelope/authorization/consent/offline/retry/conflict/receipt adversarial tests | non-extractable client key + opaque queue contract; `cloudSync=false`, no endpoint/key persistence/share |
| P9-T01d | done as disabled local persistence preflight | ENG+SECURITY / SECURITY+PRODUCT | P9-T01c | S | IndexedDB cap/ACK/delete/malformed-state integration tests | opaque queue only, max 25, no localStorage fallback; `cloudSync=false`, no transport/key persistence/share |
| P9-T02 | partial | ENG / PRODUCT | P9-T01 for remote share | L | restore/conflict/export tests | local history/backup/report done; share off |
| P9-T02a | done | ENG / PRODUCT | P9-T00 | M | 11-section conflict/reference tests | conflict-aware restore |
| P9-T03 | partial | ENG+SECURITY / PRODUCT | approved collector/operations | L | privacy/error/rollback drills | local diagnostics/runbook done |
| P9-T03a | done | ENG / PRODUCT | P9-T00 | M | diagnostic/flag/static scans | local release controls |
| P9-T04 | partial | ENG+SECURITY / PRODUCT | cross-browser/manual reviewers | L | critical journey/a11y/visual/perf/security | Chrome/Edge/WebKit matrix + integration drill done; Safari/manual pending; Firefox best-effort |
| P9-T04a | done | ENG / PRODUCT | P9-T00–03a | M | 26 routes, Lighthouse, scans | `work/verify-routes.mjs` and release evidence |
| P9-T04b | done; Chrome + Edge | ENG / PRODUCT | P9-T04a | M | disposable-profile plan→review→backup→delete→restore plus 13-route AX/keyboard audit | `app/scripts/critical-journey-e2e.mjs`; Chrome/Edge desktop/mobile reports |
| P9-T04c | done locally | ENG+SECURITY / PRODUCT | P9-T04b | M | adversarial JSON/backup/CSV/LLM-response corpus, size/count/numeric bounds, browser fail-closed drill | 222 total tests; Chrome/Edge hostile-CSV and WebKit LLM-contract reports; local LM Studio discovery verified |
| P9-T04d | done for priority engines | ENG+SECURITY / PRODUCT | P9-T04b | M | Playwright isolated Firefox/WebKit desktop/mobile journeys | WebKit 26.5 passed; Firefox retained as non-blocking best-effort CI |
| P9-T04e | done automatically; manual pending | ENG / PRODUCT | P9-T04d | M | 60 axe WCAG route/state/viewport scans, privacy-safe reports | 0 violations and 0 incomplete; manual assistive-technology/keyboard review remains separate |
| P9-T04f | protocol + automated preflight done; manual execution pending | ENG / ACCESSIBILITY + PRODUCT | P9-T04e | S | current/pressed states plus automated reflow/forced-colors and manual keyboard, AT, zoom and contrast matrix | `MANUAL_ACCESSIBILITY_PROTOCOL.md`; Gate G9 remains open |
| P9-T04g | done locally | ENG / PRODUCT | P9-T04b, P9-T04f | S | navigation feedback, button press, lazy loading, reduced-motion browser assertions | Chrome/Edge/WebKit desktop/mobile passed; no intentional input delay |
| P9-T04h | done automatically; manual pending | ENG / ACCESSIBILITY + PRODUCT | P9-T04e, P9-T04f | M | 104 Chrome/WebKit route checks at 320/640 px, landscape and forced-colors/reduced-motion | 0 failures; 24 px targets, no page overflow, focus/state/breakpoint/runtime/network checks pass |
| P9-T04i | done locally; external sign-off pending | ENG / EXPERT+PROVIDER+SECURITY+PRODUCT | P9-T04e–h | M | generated synthetic fixtures, aggregate evidence validation, source hashes, blank sign-off | `npm run evidence:external-review`; bundle never self-approves a gate |
| P9-T05 | partial | ENG+SECURITY / PRODUCT | G9 approvals | L | consent/retention/staged-beta checks | local metrics done; beta/external analytics off |
| P9-T05a | done | ENG / PRODUCT | P9-T03a | M | opt-in/revoke/purge tests | Plan Vault metrics controls |
| P9-T05b | done as policy contract | ENG+SECURITY / PRODUCT | P9-T01b, P9-T03a | M | 11 promotion/evidence/rollback adversarial tests | ADR-003; hosted rollout and operators pending |

## P10 delivery governance slices

| ID | Status | Owner / acceptance | Dependencies | Est. | Test plan | Demo evidence |
|---|---|---|---|---|---|---|
| P10-T01 | done | ENG / PRODUCT | PLAN.md | M | register completeness review | this task register |
| P10-T02 | done; UAT repeats per slice | ENG / PRODUCT | P10-T01 | S/phase | build→unit→integration→browser→security→UAT | `docs/RELEASES.md`, checklist |
| P10-T03 | done | ENG / PRODUCT | schema v10 | M | v9 migration, explicit adoption, model dispatch | model-update notice + restore point |
| P10-T04 | done; applied per release | ENG+reviewer / PRODUCT | P10-T02 | S/phase | DoD evidence audit | `docs/DEFINITION_OF_DONE.md` |
| P10-T05 | done | ENG / PRODUCT | release flags | S | false-by-default/static endpoint scans | Plan Vault release controls |
| P10-T06 | done locally; hosted CI pending | ENG / PRODUCT | P10-T02, P10-T05 | S | local CI mirror, boundary scan, workflow review | `.github/workflows/ci.yml`, `docs/REPOSITORY_HANDOFF.md` |
| P10-T07 | done locally; PRODUCT acceptance pending | ENG / PRODUCT | P0–P8, G6/G7/G9 evidence | M | deterministic 4-question domain tests, print safety, desktop/mobile no-mutation/no-external-origin browser contract | Wealth Review Product Acceptance Snapshot + printable pending-decision packet |
| P10-T08 | done locally; signed responses pending | ENG+SECURITY / EXPERT+PROVIDER+SECURITY+PRODUCT | P9-T04i, P10-T07 | M | response schema, bundle/source/evidence hash binding, roles/dates/conditions/dependency adversarial tests, fail-closed CLI template check | `REVIEW_RESPONSE.json`; `npm run verify:external-review`; no capability activation |
| P10-T09 | done locally; UAT repeats per release | ENG / PRODUCT | P0-T03, P10-T02 | M | formatter unit/inventory tests; chart keyboard/pointer/legend tests; Chrome desktop/mobile 13-route interaction contract | grouped numeric fields at 94 call sites; interactive Studio projection; `work/studio-interactions/` |

## Open release gates

| Gate | Status | Owner | Required evidence |
|---|---|---|---|
| G6 | external-gate | EXPERT + PRODUCT | signed fixture/disclaimer/scope review using `EXTERNAL_REVIEW_PACKETS.md` |
| G7 | external-gate | PROVIDER + SECURITY + PRODUCT | real-account response reconciliation plus legal/licensing approval using the G7 packet |
| G9 | external/deferred | SECURITY + PRODUCT | auth/sync/role/key design, cross-browser/manual a11y, external privacy/threat review, disposable-profile drill, beta approval using the G9 packet |
| Final Gate | pending | PRODUCT | G6/G7/G9 plus the packet's four-question product acceptance with current evidence |

No open gate may be replaced by a narrower automated check. Until the listed owner supplies the evidence, the affected capability stays disabled and the release stays local-only alpha.
