# Financial assumptions

## Current calculation convention

- The user can select a single lump-sum investment or monthly DCA. DCA can be contributed at the beginning or end of each month.
- The selected scenario shifts the user-defined gross annual return: Bear `-3.2%`, Base `0%`, Bull `+2.3%`.
- User-entered APY is converted to an effective monthly rate with `(1 + annual rate)^(1/12) - 1`.
- FX impact is approximated as `foreign allocation × annual FX change` and added to the gross annual return. A positive value means the foreign currency strengthens against THB.
- Annual fee is subtracted from gross annual return before compounding.
- Dividend yield is assumed to be included in total return. The engine separates capital return from dividends, applies the user-entered dividend tax, and either reinvests the net dividend or accumulates it as uninvested cash.
- Fixed-deposit projection uses the same initial amount, contribution schedule, timing, and horizon. Deposit interest tax reduces the annual deposit rate before compounding.
- Real value discounts the nominal result by the user-defined annual inflation rate.
- Reverse goal calculation uses binary search against the same monthly simulation to solve required initial capital or DCA, including timing, fees, dividend tax, FX, and scenario assumptions.
- Values are displayed as rounded Thai baht, while calculations retain JavaScript number precision.
- The Life Canvas caps its usable monthly goal budget at the reconciled monthly cash-flow surplus, reserves the configured extra debt payment first, then allocates the remainder by priority and nearest target date. The same baht cannot be allocated twice.
- Goal targets are interpreted in today's THB and inflated to the target month using each goal's own inflation input. Required monthly funding is the remaining inflation-adjusted gap divided by months remaining, subject to the goal minimum.
- Goal Success in Release 0.4 is a deterministic funding-readiness ratio, not a statistical forecast. Monte Carlo probability is scheduled for P5 and the UI labels this boundary explicitly.
- Portfolio transaction cost uses an average-cost convention. Buy and sell amounts are converted to THB with each transaction's captured FX rate; a split changes units without creating profit, while dividends and fees are tracked separately.
- Volatility, drawdown, correlation, factor, sector, geography, currency, duration, credit quality, and underlying holdings are user-supplied model data. Correlation without a return series is explicitly shown as a proxy, not a measured statistic.
- Rebalance amounts are differences between current asset-class weights and user-defined IPS targets. They are preview-only, require explicit local approval, and cannot create or transmit an order.
- Seed holdings and exposures are illustrative editable data, not current market facts or recommendations. Provenance and as-of dates remain visible beside holdings and every rebalance trace.
- Scenario Studio uses a seeded Mulberry32 pseudo-random generator and Box-Muller normal draws. The same complete input and seed produce the same distribution.
- Monte Carlo paths combine user-entered expected return, volatility, equity/bond correlation, inflation, FX exposure, fees, contribution timing, and selected shocks. P10/P50/P90 describe simulated terminal-value percentiles, not confidence intervals or promised outcomes.
- Named equity-crash, rates/inflation, FX, and income/health presets are transparent historical-style stress shapes, not claims that a specific historical event will repeat.
- Contribution pauses reduce scheduled DCA months; income loss reduces contributions and subtracts modeled income shortfall; healthcare cost is an annual outflow; home overrun increases the target; retirement delay extends the horizon.
- Sequence-risk cost compares deterministic modeled outcomes with and without an early drawdown and partial recovery. It is an explanatory stress metric, not a measured forecast.
- Retirement separates the accumulation phase from annual post-retirement cash-flow. Only explicitly selected wealth accounts seed retirement capital, so holdings and account balances are not counted twice.
- Recurring retirement income is annualized according to its monthly/annual frequency; one-time income is applied only at its start age. Duplicate income IDs are ignored after the first record and surfaced as a warning.
- Living expenses use general inflation while healthcare uses its own inflation rate. The engine simulates through the user-selected maximum age and reports the first unmet-expense and depleted-balance ages without allowing negative balances.
- Fixed-real withdrawal covers the modeled expense gap, percentage withdrawal caps the draw at a share of opening capital, guardrails adjust planned withdrawals when the withdrawal rate crosses user limits, and bucket mode separates a cash reserve from the growth portfolio.
- Protection Gap keeps emergency cash, life capital, annual health limit, and monthly disability income separate. Life need is debt payoff plus education and final expenses, with dependant income replacement added only when dependants are present.
- Thailand Tax `th-pit-2025-draft-v1` is a salary-first estimate: employment expense is 50% capped at THB 100,000, supported allowances are capped by the dataset, donations are modeled at one times and capped after other allowances, and progressive rates include the exempt first THB 150,000.
- Tax does not model category-specific expenses for other income, dividend tax credits, e-Donation multipliers, every pension-group interaction, special campaigns, foreign income, filing forms, penalties, or case-specific eligibility. Unsupported years are disabled.
- Family & Legacy readiness weights checklist status at 80%, emergency-contact readiness at 10%, and a beneficiary review within 12 months at 10%. It is an operational checklist, not a legal-validity opinion.
- Data Studio treats an observation as current only when its runtime contract, source URL, observed/fetched timestamps, license state, validation status, and declared freshness window all pass. A newer invalid or quarantined row never replaces the previous valid value.
- Security identity matching prioritizes ISIN, then Thai fund code plus share class, then ticker/exchange/share class. Currency, distribution-mode, share-class, and FX-hedge conflicts are rejected rather than merged silently.
- User-entered holding values remain usable but are identified as `user-input`/`userProvided`; a direct source URL and retrieval timestamp remain visibly absent instead of being fabricated.
- A validated current NAV/price, FX, percentage fee, or percentage dividend-yield snapshot can update a holding only after the user selects that holding and presses the apply button. The update copies full provenance and resets policy approval to draft.
- Release 0.9 Wealth Copilot is a deterministic local explainer, not a predictive model. It uses existing tested calculators and never invents a replacement value when a source domain is stale, disabled, or pending expert review.
- Copilot planning context contains only aggregate fields explicitly enabled by the user. Names, account identifiers, transactions, notes, contacts, credentials, and document references are never part of the context contract.
- A Copilot recommendation is a review artifact, not an instruction. Approval creates only a local checklist action; the investment policy, holdings, and transaction ledger remain unchanged until the user edits them in their dedicated screens.
- Monthly, quarterly, and annual review due dates are tracked independently. Completing one ritual does not complete or reset another ritual.

## Current limitations

- The primary goal projection remains deterministic for auditability; Scenario Studio adds a separate probabilistic view so the two conventions are not mixed silently.
- Scenario distributions are not calibrated to a verified historical dataset yet. The UI always warns about this boundary and warns again when fewer than 1,000 paths or fewer than five years are selected.
- Dividend and deposit-interest tax are configurable model inputs, not personalized tax advice. Product-level capital-gains tax, FX spread, bid/ask spread, transaction fee, withdrawal penalty, and deposit-protection limits are not applied yet.
- Scenario shifts are model assumptions, not forecasts or historical guarantees.
- Wealth Health Score is an explainable heuristic based on emergency runway, savings rate, and debt-to-assets. It is not a credit score or suitability assessment.
- Tax and Protection remain disabled by default while external Gate G6 expert review is pending. A user may open them only as labeled planning estimates.

Any change to a calculation convention must update this document, increment the relevant schema/model version, and add or revise a golden test.
