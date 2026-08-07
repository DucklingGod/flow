# ADR-001: Local-first modular web application

- Status: Accepted for P0
- Date: 2026-08-06

## Decision

Use React, TypeScript, and Vite for the application shell; Zod for versioned domain validation; Dexie/IndexedDB for primary persistence; pure TypeScript modules for financial calculations; and SVG-based responsive visualization. Cloud sync and provider APIs will be introduced through adapters rather than imported into domain calculations.

## Consequences

- The planner remains usable without an account or network connection after initial asset loading.
- Financial functions can be tested independently of React and data providers.
- Schema migration and reconciliation become release-gate requirements.
- Live data, collaboration, and AI require explicit boundaries instead of becoming implicit dependencies.
