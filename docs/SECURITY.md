# Security boundary

## Current development posture

- The application has no trade execution, payment, banking, brokerage, or custody endpoint.
- Rebalancing and future AI recommendations are preview-only and require explicit human approval.
- The development server may be exposed temporarily through an ngrok HTTPS URL for review. It must not contain production secrets or real financial records.
- ngrok credentials remain in the user's existing local ngrok configuration and are not committed to the repository.
- Family & Legacy stores no uploaded document. A local reference can be encrypted with PBKDF2-SHA-256 (210,000 iterations) and AES-GCM; salt and IV are stored with the ciphertext, while the passphrase exists only in component memory for the current session.
- Losing the reference-vault passphrase makes that ciphertext unrecoverable. The UI warns users not to enter credentials, national ID numbers, private keys, or document contents.
- Market-data API keys are accepted only as runtime call arguments. They are not included in the plan schema, IndexedDB market cache, localStorage, exports, logs, or provider-run records.
- SEC/BOT adapters enforce an HTTPS origin allowlist. Scheduled ingestion is rejected unless it runs in an explicitly authorized backend context; the current browser release does not schedule retrieval.
- Applying a market observation to a holding is a local, user-triggered plan edit. It resets Investment Policy approval to draft and cannot create an order or contact a broker.
- Wealth Copilot is disabled by default and uses the deterministic local planning layer by default. Optional LM Studio/OpenRouter developer-preview connectors require an explicit provider choice, selected context, and per-session disclosure acknowledgement; neither connector has a tool execution path.
- LLM credentials remain only in React component memory and are cleared on provider change or route unmount. They are excluded from the plan schema, IndexedDB, snapshots, backup, audit log, prompt context, and provider response metadata.
- LM Studio accepts an explicit HTTP/HTTPS OpenAI-compatible base URL and requires browser CORS. Loopback use is intended for Flow opened on the same computer; ngrok/phone and HTTPS-to-HTTP contexts receive an explicit warning, and Flow does not expose an unauthenticated proxy to the local model. OpenRouter is pinned to its HTTPS API origin, requires a Bearer key, sets `provider.zdr=true`, validates the response contract, caps input/output, times out, and never retries automatically.
- An LLM response is untrusted explanatory text rendered as text only. It cannot become a recommendation/action without the existing user-controlled local workflow and cannot mutate holdings, transactions, Tax/Protection gates, or provider settings.
- These direct adapters are a developer preview, not a production rollout approval. The compile-time `externalAi` rollout flag stays false until the conditional external-AI privacy/security review, hosted kill switch, and G9 approvals are complete.
- Copilot context is an explicit allowlist of consented aggregate outputs. Account names, household/member names, goal names, free-form notes, contacts, document references, credentials, and raw transactions are excluded.
- The local question screen blocks prompt-injection patterns, transaction/order/transfer attempts, secrets, private keys, passwords, API keys, Thai identity/card-number patterns, empty input, and excessive length.
- Copilot audit events record only event type, reason, timestamp, and allowlisted field names. They do not store the user's question text or secret value.
- Approving a recommendation adds a local review action only. It cannot mutate holdings, create transactions, send an order, or contact a provider.
- Plan Vault backups are encrypted in the browser with AES-256-GCM and a key derived by PBKDF2-SHA-256 (310,000 iterations) from a passphrase of at least 12 characters. Salt and IV travel with the ciphertext; the passphrase is never written to plan, history, storage, export metadata, or logs.
- Calculation-model adoption creates a versioned `beforeModelUpdate` restore point before changing the pinned engine. Schema migration alone never opts an existing plan into a newer model.
- Backup imports are limited to 10 MB, validated against the supported envelope and plan schema, staged before confirmation, and preceded by a safety snapshot. Authentication failure does not expose partial plaintext.
- Plan and market-snapshot files are rejected above 10 MB before `File.text()` reads them. Portfolio CSV staging is limited to 2 MB, 20,000 data rows, 64 columns, and 10,000 characters per cell; malformed quoting, non-finite/out-of-range numbers, impossible dates, overlong identifiers, and transaction-cap overflow fail closed.
- Local deletion requires the exact phrase `DELETE` and clears the plan, version history, fallback keys, and separate market-data cache. The app then recreates only the non-sensitive default example plan.
- Route code is lazy-loaded from same-origin build assets; it does not introduce a remote module or plugin execution path.
- CSV exports neutralize spreadsheet formulas in cells beginning with `=`, `+`, `-`, or `@`. Printable reports HTML-escape plan content and use a CSP that denies external resources.
- Render diagnostics exclude error messages, stacks, component state, and plan values. Only a random ID, timestamp, sanitized error class, and allowlisted route are logged locally to the console.
- Restore/import never applies last-write-wins silently. The user selects current or incoming data for each of 11 sections, and confirmation is blocked when the result creates orphaned account/member/holding/transaction/legacy references.
- Local usability metrics are stored in a separate IndexedDB database only after opt-in consent. Their schema has no payload field and permits only allowlisted route/action/time/random ID; revocation clears the database immediately.
- The P9 remote-security design is executable as a deny-by-default contract: unknown roles/actions, inactive membership, cross-household access, stale sessions, missing recent MFA, disabled role flags, and cross-owner key rotation are rejected. It is not connected to UI, storage, identity, or a network endpoint.
- The offline sync contract blocks invalid heads, plan substitution, revision rollback, and silent last-write-wins. Only a one-sided change can push automatically; concurrent or ambiguous changes require the existing user-reviewed 11-section resolver. The client preflight encrypts opaque payloads with non-extractable AES-GCM keys and authenticated plan/household/device/revision metadata, while its queue requires current authorization and consent, blocks revoked devices, binds receipts to idempotency keys, rejects replay substitution, and caps retries. No key persistence or network transport is enabled.
- The P9 privacy-lifecycle contract requires an exact consent receipt and an enabled purpose flag before remote data use. Owner-authorized deletion cannot complete without unique validated evidence for all eight stores, including cloud backups and key envelopes; forged or partial manifests fail closed. This remains a local test oracle with no remote job or endpoint.
- The staged-rollout contract permits only adjacent promotions from off through Production, validates dated evidence artifacts, keeps every remote capability out of the internal stage, requires G7 whenever live retrieval is requested, and permanently blocks trade, transfer/payment, and tax-filing flags. Its SEV-1/2 rollback output disables all ten remote flags while preserving local planning and requires manual reapproval.
- External review responses are untrusted bounded JSON. The verifier binds them to exact manifest, evidence-artifact, and reviewed-source SHA-256 values; requires distinct named roles, valid dates/expiry, evidence references, resolved conditions, one stable Product Owner identity, and sequential G6/G7/G9/Final approval. It emits a readiness result only, never modifies plan/storage/flags or enables a network/transaction capability. Signature references remain external evidence and are not cryptographically authenticated by this repository.

## Required before cloud features

- Threat model household roles, sync, sharing links, exports, and recovery.
- Encrypt sensitive data in transit and at rest with documented key ownership.
- Add authorization tests for every household and advisor boundary.
- Add secret scanning, dependency audit, rate limiting, audit events, deletion verification, and incident rollback.
- Keep calculations operational without AI and prohibit AI tools from invoking financial transactions.
- Implement and independently review ADR-002 on the server and complete the client lifecycle. Local encryption/queue preflight tests are not evidence that hosted authentication, persistent key recovery, sync transport, device registry, audit logging, or backend authorization exists.
