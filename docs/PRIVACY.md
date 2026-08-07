# Privacy boundary

- The default product mode is local-first and does not require an account.
- Plans are stored in browser IndexedDB. If IndexedDB is unavailable, the repository falls back to localStorage.
- No bank, broker, identity, health, or tax data is transmitted in the current release.
- Tax and Protection inputs stay in the same local plan store and are disabled as results by default pending expert review.
- Family & Legacy stores checklist metadata locally. Optional document references are passphrase-encrypted; documents themselves are never uploaded or copied into the plan.
- Market observations, security identities, and provider-run metadata use a separate local IndexedDB database. Provider API keys are session-only call arguments and are never written to either database, exports, or logs.
- Manual market snapshots may contain source and instrument metadata but must not contain account credentials, personal identifiers, or brokerage statements. Import validation does not upload the file.
- Analytics, cloud sync, and sharing remain opt-in future capabilities and require separate consent.
- Local Wealth Copilot is optional and disabled by default. Each planning domain has a separate consent switch; only aggregate fields on the documented allowlist enter its local context.
- Release 0.9 sends no Copilot context or question to an external service. The audit log stores no question text, names, free-form notes, contact details, credentials, or document references.
- Plan Vault version history stays in the same browser and is capped at 50 snapshots. A downloaded backup is encrypted before it leaves the app; losing its passphrase makes it unrecoverable.
- The delete flow clears local plan/history storage and the separate market-data cache. Files already downloaded by the user are outside the browser and cannot be remotely deleted.
- CSV and print/PDF reports are generated locally and may contain readable financial data. Unlike `.flowbackup`, they are not encrypted; users must review and protect them before sharing.
- Usability metrics are optional, off by default, local-only, retained for at most 30 days, and structurally limited to route, action, timestamp, and random event ID. Revoking consent deletes all events and no external analytics service is configured.
- Conflict-aware restore shows section summaries/digests only in the local UI. Backup contents and resolution choices are not transmitted.
- Calculation-model metadata contains only the model identifier, application time, and whether it came from a new plan, migration, or explicit user adoption. It remains in the local plan/backup and local reports for auditability; offering or adopting a model emits no remote event.
- ADR-002 specifies future optional-account consent, client-owned keys, unrecoverable-data disclosure, role boundaries, and conflict handling. This is design-only: no account identifier, membership, recovery factor, key envelope, or sync journal is persisted or transmitted in the current release.
- Future remote use is now constrained by a versioned consent contract per subject/category/purpose. Revocation suspends processing but is not mislabeled as deletion; deletion is verified separately across primary data, history, queues, backups, key envelopes, grants, caches, and metrics. These lifecycle records are contract fixtures only and do not leave the browser today.
- Export, deletion, migration, and recovery flows must be tested before cloud sync can leave a feature flag.
- AI integrations must minimize and redact personal data, declare what will be sent, and remain optional.

The public development tunnel exposes the application interface, not the browser's local IndexedDB data. Users should still avoid entering real sensitive information in a shared development preview.
