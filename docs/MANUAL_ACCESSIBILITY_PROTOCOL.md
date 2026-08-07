# Manual accessibility protocol

Status: prepared with an automated responsive preflight; real assistive-technology execution is not yet signed off. This document is a test procedure, not evidence that the manual accessibility gate has passed.

Repository preflight: `npm.cmd run test:a11y:layout` checks all 13 routes in Chrome/WebKit at 320 px, 640 px, mobile landscape, and forced-colors with reduced motion. It verifies page reflow, target size, keyboard focus visibility, navigation/state semantics, console/runtime cleanliness, and localhost-only requests. Passing this preflight narrows manual work but does not replace any environment below.

## Scope and environments

Test all 13 routes at desktop and mobile layouts without entering real financial, identity, account, tax, or family data.

Minimum release evidence:

- Windows: current stable Chrome or Edge with NVDA or Narrator
- macOS: current stable Safari with VoiceOver
- Mobile: current iOS Safari with VoiceOver and Android Chrome with TalkBack when a production mobile experience is claimed
- Keyboard-only pass at 100%, 200%, and 400% zoom
- Contrast measurement on the worst point of every user-visible gradient or textured surface, even when axe can resolve the semantic fallback surface

Record the browser, operating system, assistive technology and version. A browser engine emulation does not count as Safari, VoiceOver, TalkBack, or a real mobile-browser pass.

## Critical journeys

1. Navigate through desktop sidebar, planning-suite navigation, mobile bottom navigation, and More; confirm the current page is announced.
2. Change Bear/Base/Bull scenario, DCA/lump-sum mode, contribution timing, dividend mode, goal priority, debt strategy, and retirement withdrawal strategy; confirm the selected or pressed state is announced.
3. Reach every form field, range control, disclosure, dialog, error, and destructive confirmation using the keyboard only; confirm focus is visible and never trapped.
4. Change a projection input and confirm the updated result, chart name, assumptions, fees, tax drag, dividend result, and disclaimer remain understandable without relying on color.
5. Complete Wealth Map, Life Canvas, Portfolio X-Ray, Scenario Studio, Retirement, Protection, Tax, Legacy, Data Studio, Wealth Review, and Plan Vault tasks.
6. Confirm Tax and Protection clearly announce the locked/pending expert-review status before the user explicitly opens estimate mode.
7. Import invalid CSV and invalid backup data; confirm errors are announced, identify the affected input, and preserve the original data.
8. Approve and dismiss a local Copilot recommendation; confirm approval creates only a review action and never mutates the portfolio or executes a transaction.
9. Create a snapshot, export an encrypted backup, stage a restore conflict, choose each section, cancel, confirm restore, and run local delete/reset; verify each irreversible action has a clear confirmation and outcome.
10. Inspect reduced-motion behavior, high-contrast/forced-colors behavior, orientation change, text reflow, and touch targets without horizontal page scrolling at 320 CSS px width.

## Contrast review

Measure foreground text, icons, focus indicators, input borders, chart lines, status chips, and controls against the least favorable point of the actual gradient or texture.

- Normal text: at least 4.5:1
- Large text: at least 3:1
- User-interface components and meaningful graphics: at least 3:1 against adjacent colors
- If a future axe run reports `incomplete`, do not mark it passed from visual judgment alone; save the measured colors, ratio, route, viewport, and screenshot reference

## Evidence record

Create one row per route and environment.

| Date | Reviewer | OS/browser | AT/version | Route/viewport | Journey | Result | Issue IDs | Artifact reference |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | name | version | version | route + size | step IDs | pass/fail/blocked | IDs or none | privacy-safe path |

Artifacts must not contain real plan values, names, account identifiers, notes, documents, keys, backup passwords, local-storage contents, cookies, or authentication material.

## Exit criteria

The manual accessibility item in `RELEASE_CHECKLIST.md` may be checked only when:

- every required route/environment row has evidence;
- all critical and serious issues are fixed and re-tested;
- remaining minor issues have an owner, rationale, and target date;
- gradient/texture contrast measurements pass;
- the product owner accepts the documented limitations.

Until then, the product remains alpha/local-only and automated axe or accessibility-tree results must not be described as a complete accessibility certification.
