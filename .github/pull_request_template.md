## Scope

- PLAN / task ID:
- User-visible change:
- Explicit non-goals:

## Evidence

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:coverage`
- [ ] `npm run check:boundaries`
- [ ] `npm audit --audit-level=high`
- [ ] `npm run build`
- [ ] Desktop/mobile browser evidence attached when UI changes
- [ ] Migration, restore, and rollback evidence attached when stored data or models change

## Safety boundary

- [ ] No account, cloud sync, sharing, external AI, live provider, trade, payment/transfer, or tax-filing capability was enabled without its gate evidence
- [ ] Recommendations remain reversible local actions requiring human approval
- [ ] No secrets, passphrases, real financial records, backups, coverage output, or E2E artifacts are included
- [ ] Known limitations and external/manual gates remain explicitly pending
