# Definition of Done

A Flow Wealth Studio slice is done only when every applicable item below has evidence. Rendering a polished UI, writing code without a runtime drill, or passing a narrow unit test is not sufficient.

## Required evidence per slice

1. **Scope and owner** — task ID, implementation owner, acceptance owner, dependencies, estimate, financial/privacy boundary, and explicit non-goals are recorded in `TASK_REGISTER.md`.
2. **Implementation** — production code is integrated into a user-usable vertical slice; no hidden mock replaces persistence, validation, or calculation behavior promised by the task.
3. **Unit/domain tests** — normal, boundary, invalid, and numerical-regression cases pass. Financial outputs identify assumptions and model/data version.
4. **Integration/migration tests** — persistence, import/export, references, prior schema versions, failure fallback, and rollback path are exercised where applicable.
5. **Browser verification** — intended desktop/mobile route loads, interaction is reachable, no horizontal overflow or stuck loading state occurs, and console/runtime issues are zero. Mutating acceptance actions remain for the user.
6. **Accessibility and performance** — semantic names/focus/contrast/responsive behavior are checked; production performance remains inside the release budget.
7. **Security and privacy review** — data minimization, secret handling, input/output escaping, remote endpoints, transaction capabilities, consent, retention, and deletion impact are reviewed. Remote and real-money capabilities fail closed.
8. **Sources and assumptions** — sources, as-of/effective dates, licensing status, uncertainty, formulas, and estimate status are documented. “Latest”, expert-approved, or production claims require their own gate evidence.
9. **Migration and rollback** — affected plans are not silently recalculated. A restore point exists before an accepted model change, and rollback instructions are current.
10. **Release and UAT evidence** — changelog, known limitations, test outputs, demo route/screenshots, and product-owner acceptance are attached or explicitly pending.

## Gate rules

- Tax/Protection cannot become enabled by default until G6 is approved.
- Live providers and the word “latest” cannot be enabled until G7 is approved.
- Account, cloud sync, collaboration, advisor sharing, expiring share links, external analytics, beta, trade, transfer/payment, and tax-filing capabilities cannot be enabled until their G9 controls and reviewers approve them.
- A recommendation approval may only create a reversible local action. It cannot execute, submit, or schedule a real transaction.
- Missing external or manual evidence is `pending`, never inferred from green automated tests.
- Rollout promotion must be one stage at a time through ADR-003. Evidence records remain inputs to a human-owned release decision; transaction capabilities cannot be promoted at any stage and emergency rollback never auto-restores them.

## Release evidence template

```text
Task/release:
Owner / acceptance owner:
Dependencies and flags:
User-visible demo:
Unit/domain evidence:
Integration/migration evidence:
Browser/a11y/performance evidence:
Security/privacy evidence:
Sources/assumptions/model version:
Rollback path:
Known limitations:
Product-owner acceptance: pending | accepted (date/evidence)
External gate evidence: not applicable | pending | approved (reviewer/date/artifact)
```

The release checklist is the operational view of this policy. `PLAN.md` gates remain authoritative and cannot be waived by editing this document.
