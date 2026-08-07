# Calculation model and data-change policy

## Principle

Schema migration and calculation-model adoption are separate events. A stored plan may be migrated to the current data shape while remaining pinned to the calculation model that previously produced its outputs. The application must not silently rerun a historical plan with a newer model.

## Current implementation

- Plan schema v10 stores `calculationModel.version`, `appliedAt`, and `appliedBy`.
- `calculationModels.ts` is the allowlisted model registry. Every version records release date, change summary, affected outputs, and compounding/rounding conventions.
- The projection engine uses a version-keyed dispatch table. Adding a registry version without an engine is a TypeScript compile failure.
- v1–v9 plans migrate to schema v10 pinned to `wealth-model-2026.08.0` with `appliedBy=migration`.
- New plans start on `wealth-model-2026.08.1` with `appliedBy=newPlan`.
- Existing plans see a notice before adoption. The current result remains on the pinned engine until the user selects “อนุมัติและคำนวณใหม่”.
- Adoption first creates a `beforeModelUpdate` restore point, then changes the pinned version and triggers React recalculation. CSV/print reports include the model version.
- The 2026.08.1 release changes governance/audit metadata, not numerical formulas; this is stated in the notice instead of implying a performance change.

## Required workflow for a future model/data release

1. Add an immutable registry entry; never edit the meaning of an existing version.
2. Add a version-specific engine or explicit compatible alias and golden comparison tests.
3. Document formulas, data sources, effective/as-of dates, licensing, changed outputs, expected direction/range, and known uncertainty.
4. Add migration behavior that pins old plans to their prior version.
5. Preview the change in UI without mutating the plan.
6. On user acceptance, create a restore point before changing the model version.
7. Rerun only affected outputs and record the accepted version in exports/reports.
8. Run the full Definition of Done and applicable G6/G7/G9 reviews before enabling the release flag.

## Rollback

Open Plan Vault and restore the automatically created “ก่อนเปลี่ยนสูตร…” snapshot. Restore remains explicit and creates its own safety snapshot. If the new engine is unsafe, set its feature flag off, keep old version handlers available, and follow `INCIDENT_RUNBOOK.md`; do not rewrite stored financial values or delete the prior model registry entry.

## Boundaries

Model adoption is a local calculation decision only. It does not approve recommendations, change holdings automatically, call a provider, transmit personal data, or place a trade/payment/tax filing.
