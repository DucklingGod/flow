# Data sources and provenance

## Current release

The current vertical slice does not fetch live market or bank data. All balances, return assumptions, inflation, fees, dividend yield, goal amounts, and cash-flow inputs are user-controlled sample data stored locally.

Each future provider adapter must expose:

- Provider and direct source identifier
- Observation date and retrieval timestamp
- Instrument identity and currency
- Accumulating/distributing and FX-hedging status when relevant
- License/usage status
- Freshness threshold and stale-data behavior
- Validation status and last-known-good fallback

The UI must never label a value “latest” without a successful current retrieval and visible as-of date. Missing values must remain missing or be visibly identified as estimates.

## Release 0.8 provider catalogue

| Provider path | Covered data | Authentication | Current state | Official reference |
| --- | --- | --- | --- | --- |
| SEC Thailand Open Data | Thai mutual-fund NAV, dividends, factsheets, fees | User subscription key, session-only | Adapter contract ready; live response mapping and G7 reconciliation pending | https://api-portal.sec.or.th/apis |
| Bank of Thailand API | FX, reference/benchmark rates, deposit-rate datasets where subscribed | Authorization key, session-only; exchange-rate product documents 200 calls/hour | Adapter contract/rate guard ready; live mapping and G7 review pending | https://portal.api.bot.or.th/portal/catalogue-products/exchange-rates-1 |
| Thai official tax register | Versioned rule sources used by Tax Studio | None | Static snapshot available offline; Gate G6 expert review pending | https://www.rd.go.th/ |
| Verified manual snapshot | Any supported data kind | User confirms source rights | Functional JSON import with the same contract and provenance requirements | Local import |

SEC's published Fund Daily Info endpoint family includes daily mutual-fund NAV and dividend history, while Fund Factsheet includes fund attributes and fees. The new developer portal requires a subscription key. Flow stores neither SEC nor BOT keys.

Finnomena is not scraped or treated as an official provider in Release 0.8. Its public pages may be useful for discovery, but using content as application data requires a documented API/license and reconciliation. Thai fund facts and NAV should default to SEC Open Data or a user-authorized file until that boundary is resolved.

### Freshness and fallback rules

- “Current” requires a valid contract, direct source URL, observed-at, fetched-at, source-as-of, allowed licensing state, and an unexpired freshness window.
- Invalid, quarantined, restricted, stale, and missing values remain visibly distinct.
- If a newer row fails validation, the cache selects the prior valid row and marks it as last-known-good; it does not interpolate or estimate a replacement.
- Applying a value to a holding is never automatic. The user selects the holding, confirms the update, and the plan records the complete observation provenance.

## Thailand Tax Studio draft dataset

The 2025 estimate uses a static, versioned dataset (`th-pit-2025-draft-v1`) and is disabled by default pending expert review. It records the following official sources and the date they were checked:

| Scope | Official source | Effective date represented | Checked |
| --- | --- | --- | --- |
| Employment expense | https://www.rd.go.th/556.html | 2017-01-01 | 2026-08-07 |
| Allowances and investment caps | https://www.rd.go.th/557.html | 2024-01-01 | 2026-08-07 |
| Progressive PIT rates | https://www.rd.go.th/5938.html | 2017-01-01 | 2026-08-07 |
| Thai ESG conditions | https://www.sec.or.th/TH/Pages/News_Detail.aspx?SECID=11027 | 2024-08-16 | 2026-08-07 |

The 2026-08-07 public-source spot check confirms the general salary-expense rule, core allowance/cap values, progressive-rate structure plus the first-THB-150,000 exemption, donation-cap basis, and Thai ESG 30%/THB-300,000/five-year conditions. However, the Revenue Department allowance page also contains time-limited 2024 measures; it is baseline source evidence, not proof that every rule applies to tax year 2025. The dataset therefore remains `draft-expert-review` until G6 verifies year-specific law, eligibility, and omissions.

The app does not fetch tax records, pre-fill a filing form, or call an external tax service. An unsupported tax year returns no estimate rather than silently reusing another year's rules.
