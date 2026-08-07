# Repository handoff

## Current state

- Local branch: `main`
- Git remote: `origin` points to `https://github.com/DucklingGod/flow.git`
- Public remote state verified on 2026-08-07: `origin/main` is readable through the GitHub API and contains the published alpha history.
- Local state: `main` tracks `origin/main`; use `git rev-parse HEAD` and `git ls-remote origin refs/heads/main` to verify the exact current SHA after each push.
- Hosted GitHub Actions evidence can be inspected through the public API without an authenticated GitHub CLI session. The exact successful workflow URL and SHA still must be recorded before hosted CI is treated as release evidence.

The local release-gate mirror currently passes lint, typecheck, automated tests and coverage thresholds, the release-boundary scan across all reviewed source files and 10 disabled remote/transaction rollout flags, dependency audit, and the production build. The desktop/mobile Product Acceptance Snapshot contract also passes with four traceable questions, five pending-user actions, no plan mutation, and localhost-only requests. The generated review-response template is hash-bound and fail-closed; completed external signatures and Product Owner acceptance remain pending. This evidence proves the working tree passed locally; it does not prove that GitHub-hosted CI has run or that the Final Gate was approved.

The workflow also installs Playwright WebKit, runs isolated desktop/mobile critical journeys, runs the pinned axe WCAG gate, and executes the 104-check responsive accessibility matrix in Chrome/WebKit. WebKit passes locally, including navigation-feedback and reduced-motion assertions; the 60-scan axe matrix has zero violations/incomplete results, while the 320/640 px reflow, landscape and forced-colors matrix has zero failures. Safari-browser and manual assistive-technology evidence remain required external Gate G9 work.

## Initial publication checklist

Run these steps only after reviewing the complete initial snapshot. Do not include real financial records, exported backups, passphrases, provider credentials, `.env` files, ngrok configuration, or test artifacts.

```powershell
git status --short
git diff --check
git add .
git diff --cached --stat
git diff --cached --check
git commit -m "chore: publish Flow Wealth Studio alpha"
git push -u origin main
```

After the push:

1. Confirm the `verify` workflow completes successfully on GitHub.
2. Protect `main` and require the `verify` status check before merging.
3. Require pull-request review and resolved review conversations.
4. Enable Dependabot alerts and private vulnerability reporting where available.
5. Record the workflow URL and commit SHA in `docs/RELEASES.md` before treating hosted CI as release evidence.

## Safety boundary

Repository automation must not enable accounts, cloud sync, collaboration, advisor sharing, external AI, live-provider retrieval, trading, transfers/payments, or tax filing. These capabilities remain deny-by-default until their named external gates are complete. No automated workflow may submit or execute a financial action on behalf of a user.

## Rollback

- Before the first push: remove or correct the staged file, then rerun the local gate mirror.
- After the first push: use a normal reviewable follow-up commit or `git revert`; do not rewrite shared history.
- If CI exposes a secret: rotate/revoke it first, then remove it from history using a dedicated incident procedure. Deleting the current file alone is not sufficient.
