# Monetization

Status: plan of record for the `1.0.0-alpha.3` commercial pivot · drafted 2026-08-07

This document specifies the freemium model, its technical enforcement, and the
obligations that taking money creates. It does **not** approve a launch. Charging
users adds `billingComplianceReview` to the rollout evidence register
(`app/src/domain/rolloutPolicy.ts`); that review is still pending.

---

## 1. Model

Freemium subscription with three tiers. The free tier is a genuinely useful
product, not a crippled trial — it must remain sufficient for a person planning
a single set of goals on one device, because that is the audience that makes the
local-first promise credible.

| | **Free** | **Plus** | **Pro** |
|---|---|---|---|
| Monthly (THB) | 0 | 149 | 349 |
| Annual (THB) | — | 1,490 | 3,490 |
| Annual saving | — | 17% | 17% |
| Studio View, Wealth Map, Life Canvas | ✅ | ✅ | ✅ |
| Plan Vault (encrypted backup, versions) | ✅ | ✅ | ✅ |
| Local deterministic Copilot | ✅ | ✅ | ✅ |
| Portfolio X-Ray | — | ✅ | ✅ |
| Scenario Studio (Monte Carlo) | — | ✅ | ✅ |
| Retirement, Legacy | — | ✅ | ✅ |
| CSV / PDF report export | — | ✅ | ✅ |
| Encrypted cloud sync | — | ✅ | ✅ |
| Thailand Tax, Protection Gap | — | — | ✅ |
| Data Studio / provider sources | — | — | ✅ |
| AI Copilot (LM Studio, OpenRouter) | — | — | ✅ |
| Product Acceptance Snapshot | — | — | ✅ |
| Goals / snapshots / devices | 3 / 3 / 1 | 25 / 50 / 3 | 200 / 200 / 10 |
| Monte Carlo paths per run | 1,000 | 10,000 | 50,000 |

The catalog is defined once in `app/src/domain/entitlements.ts` and is the single
source of truth for the pricing table, the in-app gates, and the tests. Property
tests enforce that each tier is a strict superset of the one below it and that no
quota ever decreases as price increases.

### Pricing rationale (Thai market)

฿149 deliberately matches the local anchor for a personal digital subscription
(Spotify TH ฿149, Netflix TH ฿99–419), so the price needs no justification in the
buyer's head. ฿349 for Pro sits below the psychological ฿500 line while pricing
the tier that carries real ongoing cost: tax-rule maintenance, provider data
licensing, and LLM inference.

For comparison, YNAB is ~USD 14.99/mo (≈฿520) and Monarch ~USD 14.99/mo — both
priced for US incomes and both without Thai tax logic. Undercutting them is not
the point; being priced for a Thai household budget is.

---

## 2. Why the free tier is drawn where it is

The gate falls between **"understanding my situation"** (free) and **"optimising
it"** (paid).

- Free answers *where am I, and what am I aiming at* — net worth, cash flow,
  goals, a single projection. That is the part a person needs before they can
  tell whether the paid part is worth anything.
- Plus answers *how do I get there and how wrong could I be* — portfolio
  analysis, probabilistic scenarios, retirement cash flow. These are the
  questions that recur monthly, which is what justifies a recurring charge.
- Pro answers *what does this mean under Thai tax and insurance* plus the AI and
  provider-data surfaces. These carry genuine marginal cost and genuine
  regulatory exposure, so they price highest and ship last.

Deliberately **not** gated: encrypted backup, local deletion, and export of the
user's own data. Holding a person's own financial data hostage behind a
subscription would contradict the product's central claim. Data portability
stays free at every tier, permanently.

---

## 3. Enforcement architecture

### 3.1 The layers

```
Clerk (identity + billing)
  └── plan claim  ──►  auth adapter (src/auth/ClerkGate.tsx)
                          └── resolvePlanClaim()  ──►  PlanTier
                                └── entitlements.ts  ──►  capability set
                                      ├── FeatureGate  (UI affordance)
                                      └── server check (REQUIRED, not built)
```

Clerk supplies a plan string and nothing else. It never decides what a plan may
do — `entitlements.ts` does, in pure, provider-agnostic, unit-tested code. That
keeps a billing-provider migration to one file and keeps the gating rules
reviewable without a running browser.

### 3.2 Client gating is not access control

`FeatureGate` and `useEntitlement` stop an honest user from wandering into a paid
surface. They do not stop a determined one: anyone can edit client memory and
unlock every panel. This is acceptable **only** because every currently gated
capability is computed locally on the user's own data, so bypassing the gate
costs Flow nothing and exposes no one else's information.

That property ends the moment a paid capability consumes a server resource.
**Before shipping any of the following, server-side entitlement checks are
mandatory:**

- cloud sync (storage and bandwidth per user)
- any hosted AI proxy (inference billed per token)
- licensed provider data retrieval (per-call licensing cost)
- advisor sharing (other people's data becomes reachable)

The rule is enforced mechanically: `release-boundary-scan.mjs` fails the build if
a provider plan check (`has({ plan: … })`) appears anywhere outside
`app/src/auth/`, so entitlement decisions cannot be re-derived ad hoc in feature
code.

### 3.3 Fail-closed resolution

Every untrusted input degrades toward *less* access, never more:

- an unrecognised plan string resolves to `free`
- an unknown slug beside a known one cannot escalate the tier
- while the provider is still loading, the session is treated as `free`, so paid
  surfaces never flash before gating applies
- a build with no publishable key runs **fully unlocked and fully local** —
  because with no billing provider there is nothing to sell and nothing to
  protect, and gating would only break the offline promise

---

## 4. Billing operations

### 4.1 Provider

Clerk Billing (Stripe underneath) — chosen because Clerk is already the identity
provider, and `<PricingTable />` plus the plan claim removes an entire
subscription state machine from our surface area.

**Pin the SDK above 5.61.5.** Versions `>=5.9.0 <=5.61.5` carry
[GHSA-w24r-5266-9c3c](https://github.com/advisories/GHSA-w24r-5266-9c3c), a
high-severity authorization bypass when combining organization, billing, and
reverification checks — precisely the code path plan gating uses. npm's `latest`
tag currently still points at the vulnerable 5.61.3, so the dependency is pinned
exactly to `5.61.9`. Re-check this on every Clerk upgrade; do not use `^`.

### 4.2 Payment methods for Thailand

Card-only checkout will suppress conversion badly here. Priority order:

1. **PromptPay** — the default expectation for Thai consumers
2. Credit/debit card (Visa, Mastercard, JCB)
3. Mobile banking / internet banking transfer
4. TrueMoney and comparable wallets

Stripe's Thailand support covers PromptPay and cards. If Clerk Billing cannot
surface PromptPay, that alone justifies moving billing to Stripe directly while
keeping Clerk for identity — evaluate before launch, not after.

### 4.3 Obligations created by charging money

These are new duties that did not exist for a local-only free tool:

- **VAT** — 7% Thai VAT; registration required above ฿1.8M annual turnover.
  Decide now whether displayed prices include VAT (the pricing page currently
  states *"ราคารวมภาษีมูลค่าเพิ่มแล้ว"* — inclusive, which is the Thai consumer
  norm and must stay true).
- **Refund and cancellation policy** — must be published before the first
  charge, not after the first complaint.
- **PDPA** — billing records are personal data under a different lawful basis
  (contract) than planning data (consent). The privacy notice must separate them.
- **Consumer protection disclosure** — auto-renewal terms, renewal price, and
  cancellation route must be disclosed at the point of purchase.
- **Receipts / e-Tax invoice** — Thai business customers will ask.

None of these are engineering tasks, and all of them block launch. They are
tracked as the `billingComplianceReview` evidence record.

---

## 5. Funnel

```
landing (/)  →  sign-up (Google or email)  →  free planner
                                                  │
                                    hits a gate ──┤
                                                  ▼
                                       /pricing  →  checkout  →  paid tier
```

Design decisions already implemented:

- **No card for free.** The sign-up CTA reads *"เริ่มใช้ฟรี ไม่ต้องใช้บัตร"*.
- **Google sign-in first.** Social buttons render above the email form
  (`socialButtonsPlacement: 'top'`), because password creation is the single
  largest drop-off in a first session.
- **Annual selected by default** on the pricing toggle, with the 17% saving
  shown — anchoring on the better-value option and improving cash flow and
  retention.
- **Gates sell in context.** `FeatureGate` names the specific tier and price at
  the moment of intent, and explicitly reassures that the user's data is
  untouched by upgrading or downgrading.
- **Downgrade is safe.** Plans live in the user's browser; reverting to Free
  locks tools but never deletes or withholds data. Said plainly in the FAQ,
  because fear of hostage data suppresses trial.

### Metrics to instrument (and the constraint)

Activation (first plan saved), gate-hit rate per entitlement, gate→pricing
click-through, trial→paid conversion, monthly churn, ARPU, LTV:CAC.

**Constraint:** the current usage-metrics store is local-only, opt-in, and
fail-closed, and `externalAnalytics` remains `false`. None of these funnel
metrics can leave the device until a privacy-approved remote metrics design
exists (`metricsPrivacyApproval` in the evidence register). Until then,
conversion measurement comes from billing-side data only — which Clerk/Stripe
already provide without any new client telemetry.

---

## 6. Unit economics (assumptions, not forecasts)

Marginal cost per user today is near zero because computation is local. The costs
that appear with the paid tiers:

| Cost | Driver | Tier |
|---|---|---|
| Payment processing | ~3.65% + ฿11 per Stripe TH transaction | all paid |
| Clerk | free to 10k MAU, then per-MAU | all |
| Sync storage/bandwidth | per synced device | Plus, Pro |
| LLM inference | per token, if a hosted proxy ships | Pro |
| Provider data licensing | per-call or flat fee | Pro |
| Tax-rule maintenance | fixed annual specialist cost | Pro |

At ฿149/mo, processing takes roughly ฿16, leaving ~฿133 gross. The Pro tier's
margin depends entirely on whether AI inference is hosted (marginal, per-token)
or user-supplied (zero — the current design, where the user brings their own
LM Studio or OpenRouter key). **Keeping AI user-supplied is what makes Pro's
margin defensible**; a hosted proxy converts Pro from a fixed-cost tier to a
variable-cost one and needs its own pricing analysis before shipping.

Break-even on the fixed costs (specialist tax review, licensing, on-call) is the
number that determines whether this is a business, and it cannot be estimated
until G6 and G7 quote real figures.

---

## 7. Sequencing

**Phase 1 — shipped in this change**
Landing page, sign-up/sign-in with Google, entitlement model, in-app gates,
pricing page, security headers, `account` and `subscriptionBilling` flags on.

**Phase 2 — before charging anyone**
Clerk Billing plans created with matching `billingPlanId` slugs; PromptPay
verified; refund/cancellation policy, VAT decision, and PDPA notice published;
`billingComplianceReview` evidence recorded.

**Phase 3 — before Plus can honestly advertise sync**
Sync transport backend, key management and recovery, device registry and
revocation, server-side entitlement checks. `cloudSync` stays `false` until all
four exist. **The pricing table currently lists sync under Plus and Pro; either
Phase 3 lands before launch or that line must be marked "เร็ว ๆ นี้" — shipping
it as an active feature while the flag is false would be a false advertisement.**

**Phase 4 — Pro's regulated surfaces**
Tax and Protection require G6 sign-off; Data Studio requires G7 licensing. Pro
cannot be sold on those features until those gates pass.

---

## 8. Open decisions

1. Is there a **trial** (e.g. 14-day Plus) or does free-forever carry the funnel?
   Free-forever is the current design; a trial would raise conversion but
   complicate the entitlement state machine with expiry.
2. **Student/founding-member pricing** for early adopters?
3. Does **Pro** ever include a hosted AI proxy, or does it stay bring-your-own-key
   permanently? This is the single largest swing factor in Pro's margin.
4. Is there a **household/family plan**, and does it wait for the deferred
   household-collaboration work?
