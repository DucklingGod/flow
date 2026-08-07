# Incident and recovery runbook

Status: local alpha; no production backend exists.

## Triage without collecting financial data

1. Record app version, browser/version, route, UTC time, and the safe diagnostic ID/error class shown by the local recovery screen.
2. Do not request the user's plan JSON, backup passphrase, provider key, national ID, account statement, screenshot of balances, browser profile, or raw console stack in a public channel.
3. Reproduce with the default example plan in a clean browser profile. Confirm whether the issue affects calculation, storage, migration, rendering, export, or only the development tunnel.
4. If integrity is uncertain, tell the user to stop editing, keep the original encrypted `.flowbackup`, and create a copy before attempting restore.

## Local recovery order

1. Reload the route. If only a lazy chunk failed after a deployment, reload once to obtain the matching asset manifest.
2. Open Plan Vault and create a snapshot if the app is still usable.
3. Export an encrypted backup and verify that the file is non-empty. Keep the passphrase separately.
4. Stage the backup in a separate browser profile/device before confirming restore. Verify schema version, calculation-model version, and expected account/goal/holding counts.
5. Restore the newest known-good snapshot. The app creates a safety snapshot of the current state first.
6. Use `DELETE` only after a verified backup exists and the user explicitly intends to clear this browser.

For a calculation-model incident, disable the offered version flag, keep its prior engine handler available, and restore the automatically created `beforeModelUpdate` snapshot. Do not rewrite stored outputs or silently repin plans.

## Severity

- SEV-1: silent corruption, unauthorized disclosure, bypass of transaction boundary, or destructive cross-user action. Disable the affected release/flag immediately; preserve evidence without secrets.
- SEV-2: repeatable incorrect financial calculation, migration loss, restore failure, or encrypted-backup failure. Block release and add a golden regression.
- SEV-3: isolated rendering, accessibility, performance, or development-tunnel issue with intact local data.

## Current rollback

- Source rollback must preserve the plan migration path. Never downgrade stored schema in place.
- Deploying an older static bundle is allowed only if it can read the current schema or the user restores a compatible encrypted backup in an isolated profile.
- Remote capabilities are compile-time disabled in `src/config/releaseFlags.ts`; there is no remote service to roll back in the alpha.
- ADR-003 adds an executable SEV-1/2 rollback contract that returns every remote/transaction flag as `false`, preserves enabled local capabilities, records which capabilities were disabled, moves the next stage to `off`, and requires manual reapproval before any forward promotion.
- This contract is not a deployed control plane. A named incident owner/on-call rotation and a hosted kill-switch drill remain required before closed beta.

## Closure evidence

- Root cause and affected versions/routes.
- A test that fails before and passes after the fix.
- Migration/restore verification when storage was involved.
- Updated threat model, assumptions, privacy/security notes, and release evidence when a boundary changed.
- Confirmation that no real trade, transfer, filing, or unintended network path was introduced.
