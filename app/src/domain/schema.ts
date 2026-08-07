import './zodRuntime'
import { z } from 'zod'
import { MAX_PORTFOLIO_TRANSACTIONS, TRANSACTION_LIMITS } from './importLimits'
import { CALCULATION_MODEL_VERSIONS, CURRENT_CALCULATION_MODEL_VERSION, LEGACY_CALCULATION_MODEL_VERSION } from './calculationModels'

export const ScenarioSchema = z.enum(['bear', 'base', 'bull'])
export const InvestmentModeSchema = z.enum(['dca', 'lumpSum'])
export const ContributionTimingSchema = z.enum(['beginning', 'end'])
export const DividendModeSchema = z.enum(['reinvest', 'cash'])
export const AccountTypeSchema = z.enum(['cash', 'investment', 'property', 'insurance', 'other'])
export const CashFlowTypeSchema = z.enum(['income', 'expense'])
export const CashFlowFrequencySchema = z.enum(['monthly', 'annual'])
export const GoalTypeSchema = z.enum(['home', 'education', 'wedding', 'family', 'business', 'break', 'retirement', 'emergency', 'custom'])
export const GoalStatusSchema = z.enum(['active', 'paused', 'completed', 'cancelled'])
export const PortfolioAccountTypeSchema = z.enum(['brokerage', 'fundPlatform', 'retirement', 'cash'])
export const AssetClassSchema = z.enum(['thaiEquity', 'globalEquity', 'bond', 'cash', 'property', 'commodity', 'other'])
export const TransactionTypeSchema = z.enum(['buy', 'sell', 'dividend', 'split', 'fee'])
export const StressPresetSchema = z.enum(['none', 'equityCrash', 'ratesInflation', 'fxShock', 'incomeHealth', 'custom'])
export const WithdrawalStrategySchema = z.enum(['fixedReal', 'percentage', 'guardrails', 'bucket'])
export const RetirementIncomeTypeSchema = z.enum(['pension', 'socialSecurity', 'providentFund', 'rent', 'dividend', 'annuity', 'other'])
export const RetirementIncomeFrequencySchema = z.enum(['monthly', 'annual', 'oneTime'])
export const LegacyStatusSchema = z.enum(['missing', 'inProgress', 'complete'])
export const ExpertReviewStatusSchema = z.enum(['pending', 'approved'])
export const DataLicensingStatusSchema = z.enum(['open', 'userAuthorized', 'restricted', 'unknown'])
export const DataConfidenceSchema = z.enum(['official', 'verified', 'userProvided', 'estimate'])
export const DataValidationStatusSchema = z.enum(['valid', 'invalid', 'quarantined'])
const IdentifierSchema = z.string().min(1).max(128)

const IrregularCashFlowSchema = z.object({
  id: IdentifierSchema,
  month: z.number().int().min(1).max(720),
  amount: z.number().min(0).max(100_000_000),
})

const NetWorthSchema = z.object({
  cash: z.number().min(0),
  investments: z.number().min(0),
  property: z.number().min(0),
  debt: z.number().min(0),
  monthlyIncome: z.number().min(0),
  monthlyExpense: z.number().min(0),
})

export const AccountSchema = z.object({
  id: IdentifierSchema,
  name: z.string().min(1).max(80),
  type: AccountTypeSchema,
  balance: z.number().min(0).max(10_000_000_000),
  currency: z.string().min(3).max(3).default('THB'),
})

export const CashFlowEntrySchema = z.object({
  id: IdentifierSchema,
  name: z.string().min(1).max(80),
  type: CashFlowTypeSchema,
  amount: z.number().min(0).max(100_000_000),
  frequency: CashFlowFrequencySchema,
  category: z.string().min(1).max(40).default('ทั่วไป'),
})

export const CashFlowSnapshotSchema = z.object({
  id: IdentifierSchema,
  month: z.string().regex(/^\d{4}-\d{2}$/),
  category: z.string().min(1).max(40),
  type: CashFlowTypeSchema,
  amount: z.number().min(0).max(100_000_000),
})

export const DebtSchema = z.object({
  id: IdentifierSchema,
  name: z.string().min(1).max(80),
  balance: z.number().min(0).max(10_000_000_000),
  annualRate: z.number().min(0).max(100),
  minimumPayment: z.number().min(0).max(100_000_000),
})

export const NetWorthSnapshotSchema = z.object({
  id: IdentifierSchema,
  date: z.string().min(10),
  assets: z.number().min(0),
  debt: z.number().min(0),
})

export const HouseholdMemberSchema = z.object({
  id: IdentifierSchema,
  name: z.string().min(1).max(60),
})

export const LifeGoalSchema = z.object({
  id: IdentifierSchema,
  name: z.string().min(1).max(80),
  type: GoalTypeSchema,
  status: GoalStatusSchema,
  priority: z.number().int().min(1).max(5),
  targetDate: z.string().regex(/^\d{4}-\d{2}$/),
  targetAmount: z.number().min(0).max(10_000_000_000),
  fundedAmount: z.number().min(0).max(10_000_000_000),
  inflationRate: z.number().min(-5).max(30),
  minimumMonthly: z.number().min(0).max(100_000_000),
  fundingAccountId: IdentifierSchema.nullable(),
  memberId: IdentifierSchema.nullable(),
})

const ExposureSliceSchema = z.object({ name: z.string().min(1).max(60), weight: z.number().min(0).max(100) })
const UnderlyingHoldingSchema = z.object({ symbol: z.string().min(1).max(30), name: z.string().min(1).max(100), weight: z.number().min(0).max(100) })

export const PortfolioAccountSchema = z.object({
  id: IdentifierSchema, name: z.string().min(1).max(80), type: PortfolioAccountTypeSchema, currency: z.string().length(3),
})

export const HoldingSchema = z.object({
  id: IdentifierSchema, accountId: IdentifierSchema, symbol: z.string().min(1).max(30), name: z.string().min(1).max(120),
  assetClass: AssetClassSchema, quantity: z.number().min(0), currentPrice: z.number().min(0), costBasisPerUnit: z.number().min(0),
  currency: z.string().length(3), fxToThb: z.number().positive(), annualFee: z.number().min(0).max(20), dividendYield: z.number().min(0).max(30),
  volatility: z.number().min(0).max(200), maxDrawdown: z.number().min(0).max(100), durationYears: z.number().min(0).max(100).nullable(),
  creditQuality: z.string().max(20).nullable(), fxHedgedPercent: z.number().min(0).max(100),
  geography: z.array(ExposureSliceSchema).max(30), sector: z.array(ExposureSliceSchema).max(30), currencyExposure: z.array(ExposureSliceSchema).max(20),
  factor: z.array(ExposureSliceSchema).max(20), underlying: z.array(UnderlyingHoldingSchema).max(100),
  source: z.string().min(1).max(200), sourceProvider: z.string().min(1).max(100).default('user-input'),
  sourceUrl: z.string().url().max(2_000).nullable().default(null), sourceAsOf: z.string().min(10), sourceFetchedAt: z.string().datetime({ offset: true }).nullable().default(null),
  sourceStaleAfterHours: z.number().positive().max(24 * 366 * 20).default(24 * 90), sourceLicensingStatus: DataLicensingStatusSchema.default('userAuthorized'),
  sourceConfidence: DataConfidenceSchema.default('userProvided'), sourceValidationStatus: DataValidationStatusSchema.default('valid'),
})

export const PortfolioTransactionSchema = z.object({
  id: IdentifierSchema, externalId: z.string().max(100).nullable(), accountId: IdentifierSchema, holdingId: IdentifierSchema.nullable(),
  type: TransactionTypeSchema, date: z.string().min(10).max(35), quantity: z.number().min(0).max(TRANSACTION_LIMITS.quantity), price: z.number().min(0).max(TRANSACTION_LIMITS.price), amount: z.number().min(-TRANSACTION_LIMITS.amount).max(TRANSACTION_LIMITS.amount),
  currency: z.string().length(3), fxToThb: z.number().positive().max(TRANSACTION_LIMITS.fxToThb), sourceRow: z.number().int().min(0).max(MAX_PORTFOLIO_TRANSACTIONS + 1).nullable(), notes: z.string().max(300),
})

export const InvestmentPolicySchema = z.object({
  riskProfile: z.enum(['conservative', 'balanced', 'growth']), reviewFrequency: z.enum(['quarterly', 'semiannual', 'annual']),
  maxSingleHolding: z.number().min(1).max(100), rebalanceBand: z.number().min(0).max(50),
  targets: z.array(z.object({ assetClass: AssetClassSchema, targetWeight: z.number().min(0).max(100) })).max(20),
  approvalStatus: z.enum(['draft', 'approved']), approvedAt: z.string().nullable(),
})

export const BenchmarkSchema = z.object({ symbol: z.string().min(1).max(30), name: z.string().min(1).max(100), periodReturn: z.number().min(-100).max(1000), asOf: z.string().min(10), source: z.string().min(1).max(200) })

export const SimulationConfigSchema = z.object({
  seed: z.number().int().min(1).max(2_147_483_647), simulations: z.number().int().min(100).max(50_000),
  expectedReturn: z.number().min(-20).max(30), volatility: z.number().min(0).max(80), equityBondCorrelation: z.number().min(-1).max(1),
  inflationMean: z.number().min(-5).max(30), inflationVolatility: z.number().min(0).max(20), fxMean: z.number().min(-30).max(30), fxVolatility: z.number().min(0).max(50),
  contributionPauseMonths: z.number().int().min(0).max(240), retirementDelayYears: z.number().int().min(0).max(20), homeOverrunPercent: z.number().min(0).max(200),
  earlyDrawdownPercent: z.number().min(0).max(100), recoveryYears: z.number().int().min(0).max(20), stressPreset: StressPresetSchema,
  equityShock: z.number().min(-100).max(100), rateShock: z.number().min(-20).max(20), inflationShock: z.number().min(-20).max(50), fxShock: z.number().min(-50).max(50),
  incomeLossPercent: z.number().min(0).max(100), incomeLossMonths: z.number().int().min(0).max(120), healthcareCostAnnual: z.number().min(0).max(100_000_000),
})

export const RetirementIncomeSourceSchema = z.object({
  id: IdentifierSchema, name: z.string().min(1).max(100), type: RetirementIncomeTypeSchema, frequency: RetirementIncomeFrequencySchema,
  amount: z.number().min(0).max(100_000_000), startAge: z.number().int().min(18).max(110), endAge: z.number().int().min(18).max(110).nullable(),
  inflationRate: z.number().min(-5).max(30), taxablePercent: z.number().min(0).max(100), sourceNote: z.string().max(200),
})

export const RetirementConfigSchema = z.object({
  currentAge: z.number().int().min(18).max(99), retirementAge: z.number().int().min(19).max(100), maxAge: z.number().int().min(60).max(110),
  fundingAccountIds: z.array(IdentifierSchema).max(30), monthlyContribution: z.number().min(0).max(10_000_000),
  preRetirementReturn: z.number().min(-20).max(30), postRetirementReturn: z.number().min(-20).max(30), inflationRate: z.number().min(-5).max(30), healthcareInflationRate: z.number().min(-5).max(50),
  monthlyLivingExpenseToday: z.number().min(0).max(100_000_000), monthlyHealthcareToday: z.number().min(0).max(100_000_000), legacyTargetToday: z.number().min(0).max(10_000_000_000),
  withdrawalStrategy: WithdrawalStrategySchema, initialWithdrawalRate: z.number().min(0).max(30), guardrailLowerRate: z.number().min(0).max(30), guardrailUpperRate: z.number().min(0).max(30),
  guardrailCutPercent: z.number().min(0).max(100), guardrailRaisePercent: z.number().min(0).max(100), cashBucketYears: z.number().min(0).max(10),
  glidePathStartEquity: z.number().min(0).max(100), glidePathEndEquity: z.number().min(0).max(100), retirementShockPercent: z.number().min(0).max(100),
  incomeSources: z.array(RetirementIncomeSourceSchema).max(100),
})

export const ProtectionConfigSchema = z.object({
  enabled: z.boolean().default(false), expertReviewStatus: ExpertReviewStatusSchema.default('pending'),
  dependantCount: z.number().int().min(0).max(30), incomeReplacementYears: z.number().min(0).max(50), incomeReplacementPercent: z.number().min(0).max(100),
  existingLifeCover: z.number().min(0).max(10_000_000_000), existingHealthAnnualLimit: z.number().min(0).max(1_000_000_000), targetHealthAnnualLimit: z.number().min(0).max(1_000_000_000),
  existingDisabilityMonthlyBenefit: z.number().min(0).max(100_000_000), emergencyMonthsTarget: z.number().min(0).max(60), finalExpenses: z.number().min(0).max(100_000_000), educationCommitments: z.number().min(0).max(10_000_000_000),
})

export const TaxProfileSchema = z.object({
  enabled: z.boolean(), expertReviewStatus: ExpertReviewStatusSchema.default('pending'), taxYear: z.number().int().min(2024).max(2100), datasetVersion: z.string().min(1).max(40),
  employmentIncome: z.number().min(0).max(10_000_000_000), otherTaxableIncome: z.number().min(0).max(10_000_000_000), withholdingTax: z.number().min(0).max(1_000_000_000),
  spouseAllowance: z.boolean(), childCount: z.number().int().min(0).max(30), parentAllowanceCount: z.number().int().min(0).max(4),
  socialSecurityContribution: z.number().min(0).max(1_000_000), providentFundContribution: z.number().min(0).max(10_000_000), rmfContribution: z.number().min(0).max(10_000_000), thaiEsgContribution: z.number().min(0).max(10_000_000),
  lifeInsurancePremium: z.number().min(0).max(10_000_000), healthInsurancePremium: z.number().min(0).max(10_000_000), donations: z.number().min(0).max(100_000_000),
})

export const LegacyItemSchema = z.object({
  id: IdentifierSchema, title: z.string().min(1).max(100), category: z.enum(['ownership', 'beneficiary', 'will', 'policy', 'account', 'contact']),
  status: LegacyStatusSchema, ownerMemberId: IdentifierSchema.nullable(), localDocumentReference: z.string().max(500).nullable(), reviewedAt: z.string().max(64).nullable(),
})

export const LegacyConfigSchema = z.object({
  emergencyContactReady: z.boolean(), beneficiaryReviewDate: z.string().nullable(), items: z.array(LegacyItemSchema).max(100),
})

export const CopilotConsentSchema = z.object({
  netWorth: z.boolean(), goals: z.boolean(), portfolio: z.boolean(), retirement: z.boolean(), protection: z.boolean(), tax: z.boolean(),
})

export const CopilotAuditEventSchema = z.object({
  id: IdentifierSchema, at: z.string().datetime({ offset: true }), action: z.enum(['contextPreview', 'briefGenerated', 'recommendationApproved', 'recommendationDismissed', 'providerRequested', 'blocked']),
  recommendationId: IdentifierSchema.nullable(), fieldsShared: z.array(z.string().min(1).max(80)).max(50), reason: z.string().max(300),
})

export const CopilotRecommendationSchema = z.object({
  id: IdentifierSchema, createdAt: z.string().datetime({ offset: true }), status: z.enum(['pending', 'approved', 'dismissed']), kind: z.enum(['cashFlow', 'goal', 'portfolio', 'retirement', 'protection', 'tax', 'review']),
  title: z.string().min(1).max(140), rationale: z.string().min(1).max(1_000), tradeoffs: z.array(z.string().min(1).max(400)).min(1).max(8), assumptions: z.array(z.string().min(1).max(400)).min(1).max(12),
  confidence: z.enum(['low', 'medium', 'high']), evidence: z.array(z.object({ label: z.string().min(1).max(120), source: z.string().min(1).max(500), asOf: z.string().min(10).max(35) })).min(1).max(12),
  impact: z.string().min(1).max(500), reversibility: z.string().min(1).max(300), dispositionReason: z.string().max(300),
})

export const ReviewActionSchema = z.object({
  id: IdentifierSchema, title: z.string().min(1).max(160), status: z.enum(['todo', 'done', 'dismissed']), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), sourceRecommendationId: IdentifierSchema.nullable(),
})

export const DecisionJournalEntrySchema = z.object({
  id: IdentifierSchema, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), title: z.string().min(1).max(160), decision: z.string().min(1).max(1_000), rationale: z.string().max(1_000),
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.enum(['planned', 'active', 'completed', 'reversed']),
})

export const CopilotConfigSchema = z.object({
  enabled: z.boolean(), consent: CopilotConsentSchema, auditLog: z.array(CopilotAuditEventSchema).max(500), recommendations: z.array(CopilotRecommendationSchema).max(100),
})

export const WealthReviewConfigSchema = z.object({
  monthlyLastCompletedAt: z.string().datetime({ offset: true }).nullable(), quarterlyLastCompletedAt: z.string().datetime({ offset: true }).nullable(), annualLastCompletedAt: z.string().datetime({ offset: true }).nullable(),
  actions: z.array(ReviewActionSchema).max(300), journal: z.array(DecisionJournalEntrySchema).max(500),
})

const LegacyPlanSchema = z.object({
  id: IdentifierSchema,
  version: z.literal(1),
  name: z.string().min(1).max(80),
  updatedAt: z.string(),
  scenario: ScenarioSchema,
  initialInvestment: z.number().min(0).max(1_000_000_000),
  monthlyContribution: z.number().min(0).max(10_000_000),
  years: z.number().int().min(1).max(60),
  expectedReturn: z.number().min(-50).max(50),
  dividendYield: z.number().min(0).max(30),
  annualFee: z.number().min(0).max(10),
  inflation: z.number().min(-5).max(30),
  targetAmount: z.number().min(0).max(10_000_000_000),
  netWorth: NetWorthSchema,
})

const PlanV2Schema = z.object({
  id: IdentifierSchema,
  version: z.literal(2),
  name: z.string().min(1).max(80),
  updatedAt: z.string(),
  scenario: ScenarioSchema,
  investmentMode: InvestmentModeSchema,
  contributionTiming: ContributionTimingSchema,
  dividendMode: DividendModeSchema,
  initialInvestment: z.number().min(0).max(1_000_000_000),
  monthlyContribution: z.number().min(0).max(10_000_000),
  years: z.number().int().min(1).max(60),
  expectedReturn: z.number().min(-50).max(50),
  dividendYield: z.number().min(0).max(30),
  dividendTaxRate: z.number().min(0).max(100),
  annualFee: z.number().min(0).max(10),
  inflation: z.number().min(-5).max(30),
  foreignAllocation: z.number().min(0).max(100),
  fxAnnualChange: z.number().min(-30).max(30),
  depositRate: z.number().min(0).max(20),
  depositInterestTaxRate: z.number().min(0).max(100),
  irregularCashFlows: z.array(IrregularCashFlowSchema).max(120).default([]),
  targetAmount: z.number().min(0).max(10_000_000_000),
  netWorth: NetWorthSchema,
})

const PlanV3Schema = PlanV2Schema.omit({ version: true }).extend({
  version: z.literal(3),
  accounts: z.array(AccountSchema).max(200),
  cashFlows: z.array(CashFlowEntrySchema).max(500),
  cashFlowHistory: z.array(CashFlowSnapshotSchema).max(6_000).default([]),
  debts: z.array(DebtSchema).max(100),
  debtExtraPayment: z.number().min(0).max(100_000_000).default(5_000),
  netWorthHistory: z.array(NetWorthSnapshotSchema).max(600),
})

const PlanV4Schema = PlanV3Schema.omit({ version: true }).extend({
  version: z.literal(4),
  householdMembers: z.array(HouseholdMemberSchema).min(1).max(20),
  goals: z.array(LifeGoalSchema).max(100),
  monthlyGoalBudget: z.number().min(0).max(100_000_000),
})

const PlanV5Schema = PlanV4Schema.omit({ version: true }).extend({
  version: z.literal(5),
  portfolioAccounts: z.array(PortfolioAccountSchema).max(100),
  holdings: z.array(HoldingSchema).max(2_000),
  transactions: z.array(PortfolioTransactionSchema).max(MAX_PORTFOLIO_TRANSACTIONS),
  investmentPolicy: InvestmentPolicySchema,
  benchmark: BenchmarkSchema,
})

const PlanV6Schema = PlanV5Schema.omit({ version: true }).extend({
  version: z.literal(6),
  simulationConfig: SimulationConfigSchema,
})

const PlanV7Schema = PlanV6Schema.omit({ version: true }).extend({
  version: z.literal(7),
  retirementConfig: RetirementConfigSchema,
  protectionConfig: ProtectionConfigSchema,
  taxProfile: TaxProfileSchema,
  legacyConfig: LegacyConfigSchema,
})

const PlanV8Schema = PlanV7Schema.omit({ version: true }).extend({ version: z.literal(8) })

const PlanV9Schema = PlanV8Schema.omit({ version: true }).extend({
  version: z.literal(9), copilotConfig: CopilotConfigSchema, wealthReviewConfig: WealthReviewConfigSchema,
})

export const CalculationModelConfigSchema = z.object({
  version: z.enum(CALCULATION_MODEL_VERSIONS),
  appliedAt: z.string().datetime({ offset: true }),
  appliedBy: z.enum(['newPlan', 'migration', 'user']),
})

export const PlanSchema = PlanV9Schema.omit({ version: true }).extend({
  version: z.literal(10), calculationModel: CalculationModelConfigSchema,
})

export type WealthPlan = z.infer<typeof PlanSchema>
export type Scenario = z.infer<typeof ScenarioSchema>
export type InvestmentMode = z.infer<typeof InvestmentModeSchema>
export type ContributionTiming = z.infer<typeof ContributionTimingSchema>
export type DividendMode = z.infer<typeof DividendModeSchema>
export type WealthAccount = z.infer<typeof AccountSchema>
export type CashFlowEntry = z.infer<typeof CashFlowEntrySchema>
export type CashFlowSnapshot = z.infer<typeof CashFlowSnapshotSchema>
export type Debt = z.infer<typeof DebtSchema>
export type NetWorthSnapshot = z.infer<typeof NetWorthSnapshotSchema>
export type HouseholdMember = z.infer<typeof HouseholdMemberSchema>
export type LifeGoal = z.infer<typeof LifeGoalSchema>
export type GoalType = z.infer<typeof GoalTypeSchema>
export type GoalStatus = z.infer<typeof GoalStatusSchema>
export type PortfolioAccount = z.infer<typeof PortfolioAccountSchema>
export type Holding = z.infer<typeof HoldingSchema>
export type PortfolioTransaction = z.infer<typeof PortfolioTransactionSchema>
export type AssetClass = z.infer<typeof AssetClassSchema>
export type TransactionType = z.infer<typeof TransactionTypeSchema>
export type SimulationConfig = z.infer<typeof SimulationConfigSchema>
export type StressPreset = z.infer<typeof StressPresetSchema>
export type RetirementConfig = z.infer<typeof RetirementConfigSchema>
export type RetirementIncomeSource = z.infer<typeof RetirementIncomeSourceSchema>
export type RetirementIncomeType = z.infer<typeof RetirementIncomeTypeSchema>
export type WithdrawalStrategy = z.infer<typeof WithdrawalStrategySchema>
export type ProtectionConfig = z.infer<typeof ProtectionConfigSchema>
export type TaxProfile = z.infer<typeof TaxProfileSchema>
export type LegacyConfig = z.infer<typeof LegacyConfigSchema>
export type LegacyItem = z.infer<typeof LegacyItemSchema>
export type CopilotConsent = z.infer<typeof CopilotConsentSchema>
export type CopilotRecommendation = z.infer<typeof CopilotRecommendationSchema>
export type CopilotAuditEvent = z.infer<typeof CopilotAuditEventSchema>
export type ReviewAction = z.infer<typeof ReviewActionSchema>
export type DecisionJournalEntry = z.infer<typeof DecisionJournalEntrySchema>

const today = () => new Date().toISOString().slice(0, 10)
const futureMonth = (years: number) => {
  const date = new Date()
  date.setFullYear(date.getFullYear() + years)
  return date.toISOString().slice(0, 7)
}

function wealthCollections(netWorth: z.infer<typeof NetWorthSchema>) {
  const assets = netWorth.cash + netWorth.investments + netWorth.property
  return {
    accounts: [
      { id: 'cash-main', name: 'เงินสดและเงินสำรอง', type: 'cash' as const, balance: netWorth.cash, currency: 'THB' },
      { id: 'investment-main', name: 'พอร์ตการลงทุน', type: 'investment' as const, balance: netWorth.investments, currency: 'THB' },
      { id: 'property-main', name: 'บ้านและอสังหาริมทรัพย์', type: 'property' as const, balance: netWorth.property, currency: 'THB' },
    ],
    cashFlows: [
      { id: 'income-main', name: 'รายได้หลัก', type: 'income' as const, amount: netWorth.monthlyIncome, frequency: 'monthly' as const, category: 'เงินเดือน' },
      { id: 'expense-main', name: 'ค่าใช้จ่ายประจำ', type: 'expense' as const, amount: netWorth.monthlyExpense, frequency: 'monthly' as const, category: 'ครัวเรือน' },
    ],
    cashFlowHistory: [],
    debts: netWorth.debt > 0 ? [{ id: 'debt-main', name: 'สินเชื่อหลัก', balance: netWorth.debt, annualRate: 4.5, minimumPayment: 18_000 }] : [],
    debtExtraPayment: 5_000,
    netWorthHistory: [{ id: 'snapshot-initial', date: today(), assets, debt: netWorth.debt }],
  }
}

function lifeCollections(netWorth: z.infer<typeof NetWorthSchema>, targetAmount = 20_000_000, years = 28) {
  return {
    householdMembers: [{ id: 'member-self', name: 'ฉัน' }],
    monthlyGoalBudget: Math.max(0, Math.min(30_000, netWorth.monthlyIncome - netWorth.monthlyExpense)),
    goals: [
      { id: 'goal-emergency', name: 'เงินสำรองครอบครัว', type: 'emergency' as const, status: 'active' as const, priority: 5, targetDate: futureMonth(1), targetAmount: netWorth.monthlyExpense * 6, fundedAmount: Math.min(netWorth.cash, netWorth.monthlyExpense * 6), inflationRate: 0, minimumMonthly: 0, fundingAccountId: 'cash-main', memberId: 'member-self' },
      { id: 'goal-retirement', name: 'อิสรภาพทางการเงิน', type: 'retirement' as const, status: 'active' as const, priority: 5, targetDate: futureMonth(years), targetAmount, fundedAmount: netWorth.investments, inflationRate: 2.5, minimumMonthly: 10_000, fundingAccountId: 'investment-main', memberId: 'member-self' },
      { id: 'goal-home', name: 'เงินดาวน์บ้าน', type: 'home' as const, status: 'active' as const, priority: 3, targetDate: futureMonth(7), targetAmount: 2_500_000, fundedAmount: 950_000, inflationRate: 2.5, minimumMonthly: 3_000, fundingAccountId: 'cash-main', memberId: 'member-self' },
    ],
  }
}

function portfolioCollections() {
  const asOf = today()
  const inputProvenance = {
    source: 'ข้อมูลตัวอย่างที่ผู้ใช้แก้ไขได้', sourceProvider: 'user-input', sourceUrl: null, sourceAsOf: asOf,
    sourceFetchedAt: null, sourceStaleAfterHours: 24 * 90, sourceLicensingStatus: 'userAuthorized' as const,
    sourceConfidence: 'userProvided' as const, sourceValidationStatus: 'valid' as const,
  }
  const portfolioAccounts = [
    { id: 'portfolio-thai', name: 'บัญชีกองทุนไทย', type: 'fundPlatform' as const, currency: 'THB' },
    { id: 'portfolio-global', name: 'บัญชีลงทุนต่างประเทศ', type: 'brokerage' as const, currency: 'USD' },
  ]
  const holdings: Holding[] = [
    { id: 'holding-kset', accountId: 'portfolio-thai', symbol: 'K-SET50', name: 'K SET 50 Index Fund', assetClass: 'thaiEquity', quantity: 30_000, currentPrice: 16.5, costBasisPerUnit: 15.2, currency: 'THB', fxToThb: 1, annualFee: .6, dividendYield: 1.5, volatility: 18, maxDrawdown: 34, durationYears: null, creditQuality: null, fxHedgedPercent: 100, geography: [{ name: 'ไทย', weight: 100 }], sector: [{ name: 'การเงิน', weight: 25 }, { name: 'พลังงาน', weight: 20 }, { name: 'เทคโนโลยี', weight: 15 }, { name: 'อื่น ๆ', weight: 40 }], currencyExposure: [{ name: 'THB', weight: 100 }], factor: [{ name: 'Large Cap', weight: 100 }], underlying: [{ symbol: 'TH-LARGE-A', name: 'หุ้นไทยขนาดใหญ่ A (ตัวอย่าง)', weight: 10 }, { symbol: 'TH-LARGE-B', name: 'หุ้นไทยขนาดใหญ่ B (ตัวอย่าง)', weight: 8 }], ...inputProvenance },
    { id: 'holding-ndq', accountId: 'portfolio-thai', symbol: 'SCBNDQ(A)', name: 'SCB US Equity NDQ', assetClass: 'globalEquity', quantity: 12_000, currentPrice: 20, costBasisPerUnit: 18, currency: 'THB', fxToThb: 1, annualFee: 1.2, dividendYield: .5, volatility: 25, maxDrawdown: 42, durationYears: null, creditQuality: null, fxHedgedPercent: 0, geography: [{ name: 'สหรัฐฯ', weight: 95 }, { name: 'อื่น ๆ', weight: 5 }], sector: [{ name: 'เทคโนโลยี', weight: 55 }, { name: 'สื่อสาร', weight: 18 }, { name: 'อื่น ๆ', weight: 27 }], currencyExposure: [{ name: 'USD', weight: 100 }], factor: [{ name: 'Growth', weight: 75 }, { name: 'Quality', weight: 25 }], underlying: [{ symbol: 'US-TECH-A', name: 'หุ้นเทคสหรัฐ A (ตัวอย่าง)', weight: 12 }, { symbol: 'US-TECH-B', name: 'หุ้นเทคสหรัฐ B (ตัวอย่าง)', weight: 11 }], ...inputProvenance },
    { id: 'holding-vt', accountId: 'portfolio-global', symbol: 'VT', name: 'Vanguard Total World Stock ETF', assetClass: 'globalEquity', quantity: 100, currentPrice: 120, costBasisPerUnit: 100, currency: 'USD', fxToThb: 35, annualFee: .07, dividendYield: 2, volatility: 17, maxDrawdown: 35, durationYears: null, creditQuality: null, fxHedgedPercent: 0, geography: [{ name: 'สหรัฐฯ', weight: 60 }, { name: 'ยุโรป', weight: 17 }, { name: 'เอเชีย', weight: 18 }, { name: 'อื่น ๆ', weight: 5 }], sector: [{ name: 'เทคโนโลยี', weight: 25 }, { name: 'การเงิน', weight: 16 }, { name: 'อุตสาหกรรม', weight: 12 }, { name: 'อื่น ๆ', weight: 47 }], currencyExposure: [{ name: 'USD', weight: 60 }, { name: 'EUR', weight: 15 }, { name: 'JPY', weight: 7 }, { name: 'อื่น ๆ', weight: 18 }], factor: [{ name: 'Market', weight: 100 }], underlying: [{ symbol: 'US-TECH-A', name: 'หุ้นเทคสหรัฐ A (ตัวอย่าง)', weight: 4 }, { symbol: 'GLOBAL-BANK-A', name: 'ธนาคารโลก A (ตัวอย่าง)', weight: 2 }], ...inputProvenance },
    { id: 'holding-bond', accountId: 'portfolio-thai', symbol: 'ABFTH', name: 'ABF Thailand Bond Index Fund', assetClass: 'bond', quantity: 60_000, currentPrice: 10.2, costBasisPerUnit: 10, currency: 'THB', fxToThb: 1, annualFee: .3, dividendYield: 1.8, volatility: 4, maxDrawdown: 8, durationYears: 5.5, creditQuality: 'AA', fxHedgedPercent: 100, geography: [{ name: 'ไทย', weight: 100 }], sector: [{ name: 'รัฐบาล/รัฐวิสาหกิจ', weight: 80 }, { name: 'เอกชน', weight: 20 }], currencyExposure: [{ name: 'THB', weight: 100 }], factor: [{ name: 'Duration', weight: 100 }], underlying: [], ...inputProvenance },
    { id: 'holding-gold', accountId: 'portfolio-thai', symbol: 'GOLD-FUND', name: 'Gold Fund (Sample)', assetClass: 'commodity', quantity: 8_000, currentPrice: 14.5, costBasisPerUnit: 13.8, currency: 'THB', fxToThb: 1, annualFee: .8, dividendYield: 0, volatility: 16, maxDrawdown: 25, durationYears: null, creditQuality: null, fxHedgedPercent: 50, geography: [{ name: 'Global', weight: 100 }], sector: [{ name: 'ทองคำ', weight: 100 }], currencyExposure: [{ name: 'USD', weight: 100 }], factor: [{ name: 'Inflation hedge', weight: 100 }], underlying: [{ symbol: 'GOLD', name: 'ทองคำอ้างอิง', weight: 100 }], ...inputProvenance },
  ]
  const transactions: PortfolioTransaction[] = holdings.map((holding, index) => ({ id: `tx-seed-${index + 1}`, externalId: `SEED-${index + 1}`, accountId: holding.accountId, holdingId: holding.id, type: 'buy', date: asOf, quantity: holding.quantity, price: holding.costBasisPerUnit, amount: holding.quantity * holding.costBasisPerUnit, currency: holding.currency, fxToThb: holding.fxToThb, sourceRow: index + 1, notes: 'ยอดตั้งต้นตัวอย่าง' }))
  transactions.push({ id: 'tx-dividend-sample', externalId: 'SEED-DIV-1', accountId: 'portfolio-global', holdingId: 'holding-vt', type: 'dividend', date: asOf, quantity: 0, price: 0, amount: 180, currency: 'USD', fxToThb: 35, sourceRow: 6, notes: 'เงินปันผลตัวอย่าง' })
  return {
    portfolioAccounts, holdings, transactions,
    investmentPolicy: { riskProfile: 'balanced' as const, reviewFrequency: 'annual' as const, maxSingleHolding: 35, rebalanceBand: 5, targets: [{ assetClass: 'thaiEquity' as const, targetWeight: 25 }, { assetClass: 'globalEquity' as const, targetWeight: 45 }, { assetClass: 'bond' as const, targetWeight: 20 }, { assetClass: 'commodity' as const, targetWeight: 10 }], approvalStatus: 'draft' as const, approvedAt: null },
    benchmark: { symbol: 'BLENDED', name: 'เกณฑ์ผสมที่ผู้ใช้กำหนด', periodReturn: 8, asOf, source: 'สมมติฐานผู้ใช้' },
  }
}

function simulationCollections(expectedReturn = 7.2, inflation = 2.5) {
  return { simulationConfig: { seed: 42_052_026, simulations: 5_000, expectedReturn, volatility: 16, equityBondCorrelation: -.15, inflationMean: inflation, inflationVolatility: 1.2, fxMean: 0, fxVolatility: 8, contributionPauseMonths: 0, retirementDelayYears: 0, homeOverrunPercent: 0, earlyDrawdownPercent: 0, recoveryYears: 3, stressPreset: 'none' as const, equityShock: 0, rateShock: 0, inflationShock: 0, fxShock: 0, incomeLossPercent: 0, incomeLossMonths: 0, healthcareCostAnnual: 0 } }
}

function planningCollections(monthlyIncome = 92_000, monthlyExpense = 51_000, expectedReturn = 7.2, inflation = 2.5) {
  return {
    retirementConfig: {
      currentAge: 35, retirementAge: 60, maxAge: 100, fundingAccountIds: ['investment-main'], monthlyContribution: 15_000,
      preRetirementReturn: Math.max(-20, Math.round((expectedReturn - .6) * 10) / 10), postRetirementReturn: 4.5, inflationRate: inflation, healthcareInflationRate: 5,
      monthlyLivingExpenseToday: Math.max(0, monthlyExpense - 6_000), monthlyHealthcareToday: Math.min(monthlyExpense, 6_000), legacyTargetToday: 2_000_000,
      withdrawalStrategy: 'guardrails' as const, initialWithdrawalRate: 4, guardrailLowerRate: 3.2, guardrailUpperRate: 5,
      guardrailCutPercent: 10, guardrailRaisePercent: 10, cashBucketYears: 2,
      glidePathStartEquity: 55, glidePathEndEquity: 35, retirementShockPercent: 0,
      incomeSources: [
        { id: 'retirement-social-security', name: 'ประกันสังคม (กรอกยอดของคุณ)', type: 'socialSecurity' as const, frequency: 'monthly' as const, amount: 0, startAge: 60, endAge: null, inflationRate: 0, taxablePercent: 0, sourceNote: 'ค่าเริ่มต้นเป็นศูนย์จนกว่าผู้ใช้จะยืนยันสิทธิของตนเอง' },
      ],
    },
    protectionConfig: {
      enabled: false, expertReviewStatus: 'pending' as const,
      dependantCount: 0, incomeReplacementYears: 10, incomeReplacementPercent: 70, existingLifeCover: 0,
      existingHealthAnnualLimit: 0, targetHealthAnnualLimit: 1_000_000, existingDisabilityMonthlyBenefit: 0,
      emergencyMonthsTarget: 6, finalExpenses: 300_000, educationCommitments: 0,
    },
    taxProfile: {
      enabled: false, expertReviewStatus: 'pending' as const, taxYear: 2025, datasetVersion: 'pending-expert-review', employmentIncome: monthlyIncome * 12, otherTaxableIncome: 0, withholdingTax: 0,
      spouseAllowance: false, childCount: 0, parentAllowanceCount: 0, socialSecurityContribution: 0, providentFundContribution: 0,
      rmfContribution: 0, thaiEsgContribution: 0, lifeInsurancePremium: 0, healthInsurancePremium: 0, donations: 0,
    },
    legacyConfig: {
      emergencyContactReady: false, beneficiaryReviewDate: null,
      items: [
        { id: 'legacy-ownership', title: 'ตรวจเจ้าของบัญชีและทรัพย์สิน', category: 'ownership' as const, status: 'missing' as const, ownerMemberId: 'member-self', localDocumentReference: null, reviewedAt: null },
        { id: 'legacy-beneficiary', title: 'ทบทวนผู้รับผลประโยชน์', category: 'beneficiary' as const, status: 'missing' as const, ownerMemberId: 'member-self', localDocumentReference: null, reviewedAt: null },
        { id: 'legacy-will', title: 'พินัยกรรมหรือคำสั่งจัดการมรดก', category: 'will' as const, status: 'missing' as const, ownerMemberId: 'member-self', localDocumentReference: null, reviewedAt: null },
        { id: 'legacy-policy', title: 'ทะเบียนกรมธรรม์และความคุ้มครอง', category: 'policy' as const, status: 'missing' as const, ownerMemberId: 'member-self', localDocumentReference: null, reviewedAt: null },
        { id: 'legacy-account', title: 'ทะเบียนบัญชีและช่องทางติดต่อ', category: 'account' as const, status: 'missing' as const, ownerMemberId: 'member-self', localDocumentReference: null, reviewedAt: null },
        { id: 'legacy-contact', title: 'ผู้ติดต่อฉุกเฉินของครอบครัว', category: 'contact' as const, status: 'missing' as const, ownerMemberId: 'member-self', localDocumentReference: null, reviewedAt: null },
      ],
    },
  }
}

function reviewCollections() {
  return {
    copilotConfig: {
      enabled: false,
      consent: { netWorth: true, goals: true, portfolio: false, retirement: false, protection: false, tax: false },
      auditLog: [],
      recommendations: [],
    },
    wealthReviewConfig: {
      monthlyLastCompletedAt: null, quarterlyLastCompletedAt: null, annualLastCompletedAt: null,
      actions: [
        { id: 'review-action-monthly', title: 'ทบทวนกระแสเงินสดและรายการสำคัญเดือนนี้', status: 'todo' as const, dueDate: today(), sourceRecommendationId: null },
      ],
      journal: [],
    },
  }
}

const defaultPlanCreatedAt = new Date().toISOString()

export const defaultPlan: WealthPlan = {
  id: 'primary-plan',
  version: 10,
  name: 'แผนอิสรภาพทางการเงิน',
  updatedAt: defaultPlanCreatedAt,
  calculationModel: { version: CURRENT_CALCULATION_MODEL_VERSION, appliedAt: defaultPlanCreatedAt, appliedBy: 'newPlan' },
  scenario: 'base',
  investmentMode: 'dca',
  contributionTiming: 'end',
  dividendMode: 'reinvest',
  initialInvestment: 500_000,
  monthlyContribution: 15_000,
  years: 28,
  expectedReturn: 7.2,
  dividendYield: 1.8,
  dividendTaxRate: 10,
  annualFee: 0.6,
  inflation: 2.5,
  foreignAllocation: 50,
  fxAnnualChange: 0,
  depositRate: 1.5,
  depositInterestTaxRate: 15,
  irregularCashFlows: [],
  targetAmount: 20_000_000,
  netWorth: {
    cash: 420_000,
    investments: 1_860_000,
    property: 3_200_000,
    debt: 1_450_000,
    monthlyIncome: 92_000,
    monthlyExpense: 51_000,
  },
  ...wealthCollections({ cash: 420_000, investments: 1_860_000, property: 3_200_000, debt: 1_450_000, monthlyIncome: 92_000, monthlyExpense: 51_000 }),
  ...lifeCollections({ cash: 420_000, investments: 1_860_000, property: 3_200_000, debt: 1_450_000, monthlyIncome: 92_000, monthlyExpense: 51_000 }),
  ...portfolioCollections(),
  ...simulationCollections(7.2, 2.5),
  ...planningCollections(92_000, 51_000, 7.2, 2.5),
  ...reviewCollections(),
}

function migrateCollections<T extends z.infer<typeof LegacyPlanSchema> | z.infer<typeof PlanV2Schema>>(source: T): WealthPlan {
  const migratedAt = new Date().toISOString()
  return {
    ...defaultPlan,
    ...source,
    version: 10,
    updatedAt: migratedAt,
    calculationModel: { version: LEGACY_CALCULATION_MODEL_VERSION, appliedAt: migratedAt, appliedBy: 'migration' },
    ...wealthCollections(source.netWorth),
    ...lifeCollections(source.netWorth, source.targetAmount, source.years),
    ...portfolioCollections(),
    ...simulationCollections(source.expectedReturn, source.inflation),
    ...planningCollections(source.netWorth.monthlyIncome, source.netWorth.monthlyExpense, source.expectedReturn, source.inflation),
    ...reviewCollections(),
  }
}

function migrateV3(source: z.infer<typeof PlanV3Schema>): WealthPlan {
  const migratedAt = new Date().toISOString()
  return { ...source, version: 10, updatedAt: migratedAt, calculationModel: { version: LEGACY_CALCULATION_MODEL_VERSION, appliedAt: migratedAt, appliedBy: 'migration' }, ...lifeCollections(source.netWorth, source.targetAmount, source.years), ...portfolioCollections(), ...simulationCollections(source.expectedReturn, source.inflation), ...planningCollections(source.netWorth.monthlyIncome, source.netWorth.monthlyExpense, source.expectedReturn, source.inflation), ...reviewCollections() }
}

function migrateV4(source: z.infer<typeof PlanV4Schema>): WealthPlan {
  const migratedAt = new Date().toISOString()
  return { ...source, version: 10, updatedAt: migratedAt, calculationModel: { version: LEGACY_CALCULATION_MODEL_VERSION, appliedAt: migratedAt, appliedBy: 'migration' }, ...portfolioCollections(), ...simulationCollections(source.expectedReturn, source.inflation), ...planningCollections(source.netWorth.monthlyIncome, source.netWorth.monthlyExpense, source.expectedReturn, source.inflation), ...reviewCollections() }
}

function migrateV5(source: z.infer<typeof PlanV5Schema>): WealthPlan {
  const migratedAt = new Date().toISOString()
  return { ...source, version: 10, updatedAt: migratedAt, calculationModel: { version: LEGACY_CALCULATION_MODEL_VERSION, appliedAt: migratedAt, appliedBy: 'migration' }, ...simulationCollections(source.expectedReturn, source.inflation), ...planningCollections(source.netWorth.monthlyIncome, source.netWorth.monthlyExpense, source.expectedReturn, source.inflation), ...reviewCollections() }
}

function migrateV6(source: z.infer<typeof PlanV6Schema>): WealthPlan {
  const migratedAt = new Date().toISOString()
  return { ...source, version: 10, updatedAt: migratedAt, calculationModel: { version: LEGACY_CALCULATION_MODEL_VERSION, appliedAt: migratedAt, appliedBy: 'migration' }, ...planningCollections(source.netWorth.monthlyIncome, source.netWorth.monthlyExpense, source.expectedReturn, source.inflation), ...reviewCollections() }
}

function migrateV7(source: z.infer<typeof PlanV7Schema>): WealthPlan {
  const migratedAt = new Date().toISOString()
  return PlanSchema.parse({ ...source, version: 10, updatedAt: migratedAt, calculationModel: { version: LEGACY_CALCULATION_MODEL_VERSION, appliedAt: migratedAt, appliedBy: 'migration' }, ...reviewCollections() })
}

function migrateV8(source: z.infer<typeof PlanV8Schema>): WealthPlan {
  const migratedAt = new Date().toISOString()
  return PlanSchema.parse({ ...source, version: 10, updatedAt: migratedAt, calculationModel: { version: LEGACY_CALCULATION_MODEL_VERSION, appliedAt: migratedAt, appliedBy: 'migration' }, ...reviewCollections() })
}

function migrateV9(source: z.infer<typeof PlanV9Schema>): WealthPlan {
  const migratedAt = new Date().toISOString()
  return PlanSchema.parse({ ...source, version: 10, updatedAt: migratedAt, calculationModel: { version: LEGACY_CALCULATION_MODEL_VERSION, appliedAt: migratedAt, appliedBy: 'migration' } })
}

export function parseImportablePlan(value: unknown) {
  const current = PlanSchema.safeParse(value)
  if (current.success) return { success: true as const, data: current.data }
  const v9 = PlanV9Schema.safeParse(value)
  if (v9.success) return { success: true as const, data: migrateV9(v9.data) }
  const v8 = PlanV8Schema.safeParse(value)
  if (v8.success) return { success: true as const, data: migrateV8(v8.data) }
  const v7 = PlanV7Schema.safeParse(value)
  if (v7.success) return { success: true as const, data: migrateV7(v7.data) }
  const v6 = PlanV6Schema.safeParse(value)
  if (v6.success) return { success: true as const, data: migrateV6(v6.data) }
  const v5 = PlanV5Schema.safeParse(value)
  if (v5.success) return { success: true as const, data: migrateV5(v5.data) }
  const v4 = PlanV4Schema.safeParse(value)
  if (v4.success) return { success: true as const, data: migrateV4(v4.data) }
  const v3 = PlanV3Schema.safeParse(value)
  if (v3.success) return { success: true as const, data: migrateV3(v3.data) }
  const v2 = PlanV2Schema.safeParse(value)
  if (v2.success) return { success: true as const, data: migrateCollections(v2.data) }
  const legacy = LegacyPlanSchema.safeParse(value)
  if (legacy.success) return { success: true as const, data: migrateCollections(legacy.data) }
  return { success: false as const, error: 'ไฟล์ไม่ตรงกับ schema ของ Flow Wealth Studio หรือมีค่าที่ไม่ปลอดภัย' }
}

export function migratePlan(value: unknown): WealthPlan {
  const parsed = parseImportablePlan(value)
  return parsed.success ? parsed.data : { ...defaultPlan, updatedAt: new Date().toISOString() }
}
