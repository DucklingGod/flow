# Contributing to Flow Wealth Studio

Flow Wealth Studio is currently a local-only alpha. Changes must preserve explicit human approval and the absence of real trading, transfer, payment, tax-filing, cloud-sharing, and external-AI execution paths.

## Local validation

Use Node.js 24 and the locked npm dependencies:

```powershell
cd app
npm.cmd ci
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:coverage
npm.cmd run check:boundaries
npm.cmd audit --audit-level=high
npm.cmd run build
```

UI changes also require disposable-context desktop/mobile browser evidence. Calculation, schema, storage, backup, or model changes require regression fixtures plus migration and rollback evidence. Product-owner approval and external gates must never be inferred from automated checks.

Do not commit `.flowbackup` files, E2E screenshots, coverage output, credentials, passphrases, provider keys, real account statements, national IDs, or real household financial data. Use only the default example plan or synthetic fixtures in issues and pull requests.

See `PLAN.md`, `docs/TASK_REGISTER.md`, `docs/DEFINITION_OF_DONE.md`, and `docs/SECURITY.md` before opening a pull request.
