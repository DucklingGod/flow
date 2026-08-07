import type { TaxProfile } from './schema'

export interface TaxSource {
  title: string
  url: string
  effectiveFrom: string
  checkedAt: string
}

export interface TaxDataset {
  taxYear: number
  version: string
  status: 'draft-expert-review'
  personalAllowance: number
  spouseAllowance: number
  childAllowance: number
  parentAllowance: number
  socialSecurityCap: number
  employmentExpensePercent: number
  employmentExpenseCap: number
  retirementGroupCap: number
  rmfIncomePercent: number
  thaiEsgCap: number
  thaiEsgIncomePercent: number
  lifeInsuranceCap: number
  healthInsuranceCap: number
  combinedLifeHealthCap: number
  donationIncomePercent: number
  brackets: { upTo: number; rate: number }[]
  sources: TaxSource[]
}

export const TAX_DATASETS: Record<number, TaxDataset> = {
  2025: {
    taxYear: 2025,
    version: 'th-pit-2025-draft-v1',
    status: 'draft-expert-review',
    personalAllowance: 60_000,
    spouseAllowance: 60_000,
    childAllowance: 30_000,
    parentAllowance: 30_000,
    socialSecurityCap: 9_000,
    employmentExpensePercent: 50,
    employmentExpenseCap: 100_000,
    retirementGroupCap: 500_000,
    rmfIncomePercent: 30,
    thaiEsgCap: 300_000,
    thaiEsgIncomePercent: 30,
    lifeInsuranceCap: 100_000,
    healthInsuranceCap: 25_000,
    combinedLifeHealthCap: 100_000,
    donationIncomePercent: 10,
    brackets: [
      { upTo: 150_000, rate: 0 }, { upTo: 300_000, rate: 5 }, { upTo: 500_000, rate: 10 }, { upTo: 750_000, rate: 15 },
      { upTo: 1_000_000, rate: 20 }, { upTo: 2_000_000, rate: 25 }, { upTo: 5_000_000, rate: 30 }, { upTo: Infinity, rate: 35 },
    ],
    sources: [
      { title: 'กรมสรรพากร · การหักค่าใช้จ่าย', url: 'https://www.rd.go.th/556.html', effectiveFrom: '2017-01-01', checkedAt: '2026-08-07' },
      { title: 'กรมสรรพากร · ค่าลดหย่อนและยกเว้น', url: 'https://www.rd.go.th/557.html', effectiveFrom: '2024-01-01', checkedAt: '2026-08-07' },
      { title: 'กรมสรรพากร · บัญชีอัตราภาษีเงินได้', url: 'https://www.rd.go.th/5938.html', effectiveFrom: '2017-01-01', checkedAt: '2026-08-07' },
      { title: 'ก.ล.ต. · เงื่อนไข Thai ESG', url: 'https://www.sec.or.th/TH/Pages/News_Detail.aspx?SECID=11027', effectiveFrom: '2024-08-16', checkedAt: '2026-08-07' },
    ],
  },
}

export interface TaxResult {
  status: 'disabled' | 'unsupported-year' | 'estimate'
  dataset: TaxDataset | null
  grossIncome: number
  employmentExpense: number
  totalAllowancesBeforeDonation: number
  donationAllowance: number
  taxableIncome: number
  taxBeforeWithholding: number
  withholdingTax: number
  taxPayable: number
  estimatedRefund: number
  marginalRate: number
  effectiveRate: number
  eligible: {
    personal: number; spouse: number; child: number; parent: number; socialSecurity: number
    retirementGroup: number; rmf: number; providentFund: number; thaiEsg: number; lifeHealthInsurance: number
  }
  remainingRoom: { retirementGroup: number; rmf: number; thaiEsg: number }
  warnings: string[]
}

const finite = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0

function progressiveTax(taxableIncome: number, dataset: TaxDataset) {
  let tax = 0
  let lower = 0
  let marginalRate = 0
  for (const bracket of dataset.brackets) {
    const amount = Math.max(0, Math.min(taxableIncome, bracket.upTo) - lower)
    tax += amount * bracket.rate / 100
    if (taxableIncome > lower) marginalRate = bracket.rate
    if (taxableIncome <= bracket.upTo) break
    lower = bracket.upTo
  }
  return { tax, marginalRate }
}

export function calculateTax(profile: TaxProfile): TaxResult {
  const dataset = TAX_DATASETS[profile.taxYear] ?? null
  const emptyEligible = { personal: 0, spouse: 0, child: 0, parent: 0, socialSecurity: 0, retirementGroup: 0, rmf: 0, providentFund: 0, thaiEsg: 0, lifeHealthInsurance: 0 }
  if (!dataset) return { status: 'unsupported-year', dataset: null, grossIncome: 0, employmentExpense: 0, totalAllowancesBeforeDonation: 0, donationAllowance: 0, taxableIncome: 0, taxBeforeWithholding: 0, withholdingTax: finite(profile.withholdingTax), taxPayable: 0, estimatedRefund: 0, marginalRate: 0, effectiveRate: 0, eligible: emptyEligible, remainingRoom: { retirementGroup: 0, rmf: 0, thaiEsg: 0 }, warnings: ['ยังไม่มีชุดกฎทางการสำหรับปีภาษีที่เลือก ระบบจึงปิดการคำนวณ'] }

  const employmentIncome = finite(profile.employmentIncome)
  const otherTaxableIncome = finite(profile.otherTaxableIncome)
  const grossIncome = employmentIncome + otherTaxableIncome
  const employmentExpense = Math.min(employmentIncome * dataset.employmentExpensePercent / 100, dataset.employmentExpenseCap)
  const assessableAfterExpense = Math.max(0, grossIncome - employmentExpense)
  const rmfIndividualCap = grossIncome * dataset.rmfIncomePercent / 100
  const rmfRequested = Math.min(finite(profile.rmfContribution), rmfIndividualCap)
  const providentRequested = finite(profile.providentFundContribution)
  const retirementGroup = Math.min(dataset.retirementGroupCap, rmfRequested + providentRequested)
  const providentFund = Math.min(providentRequested, retirementGroup)
  const rmf = Math.min(rmfRequested, Math.max(0, retirementGroup - providentFund))
  const thaiEsg = Math.min(finite(profile.thaiEsgContribution), dataset.thaiEsgCap, grossIncome * dataset.thaiEsgIncomePercent / 100)
  const lifeInsurance = Math.min(finite(profile.lifeInsurancePremium), dataset.lifeInsuranceCap)
  const healthInsurance = Math.min(finite(profile.healthInsurancePremium), dataset.healthInsuranceCap)
  const lifeHealthInsurance = Math.min(dataset.combinedLifeHealthCap, lifeInsurance + healthInsurance)
  const eligible = {
    personal: dataset.personalAllowance,
    spouse: profile.spouseAllowance ? dataset.spouseAllowance : 0,
    child: profile.childCount * dataset.childAllowance,
    parent: profile.parentAllowanceCount * dataset.parentAllowance,
    socialSecurity: Math.min(finite(profile.socialSecurityContribution), dataset.socialSecurityCap),
    retirementGroup, rmf, providentFund, thaiEsg, lifeHealthInsurance,
  }
  const totalAllowancesBeforeDonation = Object.entries(eligible).filter(([key]) => !['rmf', 'providentFund'].includes(key)).reduce((sum, [, value]) => sum + value, 0)
  const beforeDonation = Math.max(0, assessableAfterExpense - totalAllowancesBeforeDonation)
  const donationAllowance = Math.min(finite(profile.donations), beforeDonation * dataset.donationIncomePercent / 100)
  const taxableIncome = Math.max(0, beforeDonation - donationAllowance)
  const { tax: taxBeforeWithholding, marginalRate } = progressiveTax(taxableIncome, dataset)
  const withholdingTax = finite(profile.withholdingTax)
  const taxPayable = Math.max(0, taxBeforeWithholding - withholdingTax)
  const estimatedRefund = Math.max(0, withholdingTax - taxBeforeWithholding)
  const warnings = [
    'ผลลัพธ์เป็น estimate สำหรับการวางแผน ไม่ใช่แบบยื่นภาษีหรือคำปรึกษาภาษี',
    'รายได้อื่นถูกนับเต็มจำนวนโดยยังไม่หักค่าใช้จ่ายเฉพาะมาตรา 40(2)-(8)',
    'ค่าลดหย่อนบุตรใช้ฐาน 30,000 บาทต่อคน ยังไม่เพิ่มสิทธิบุตรคนที่ 2 ที่เกิดตั้งแต่ปี 2561 เพราะยังไม่ได้เก็บวันเกิด',
    'กลุ่ม PVD/RMF ใช้เพดานรวมแบบย่อ ต้องตรวจฐานค่าจ้าง เงื่อนไขสะสม และกองทุนเกษียณอื่นก่อนยื่นจริง',
    'เงินบริจาคคำนวณแบบ 1 เท่า ไม่รองรับ e-Donation 2 เท่าในรุ่นนี้',
    'Thai ESG ต้องถือครองอย่างน้อย 5 ปี และตรวจคุณสมบัติหน่วยลงทุนก่อนใช้สิทธิ',
  ]
  if (profile.datasetVersion !== dataset.version) warnings.unshift(`ข้อมูลในแผนระบุ dataset ${profile.datasetVersion} ระบบกำลังแสดง ${dataset.version}; ต้องยืนยันก่อนใช้`)
  return {
    status: profile.enabled ? 'estimate' : 'disabled', dataset, grossIncome, employmentExpense, totalAllowancesBeforeDonation, donationAllowance,
    taxableIncome, taxBeforeWithholding, withholdingTax, taxPayable, estimatedRefund, marginalRate,
    effectiveRate: grossIncome > 0 ? taxBeforeWithholding / grossIncome * 100 : 0,
    eligible,
    remainingRoom: {
      retirementGroup: Math.max(0, dataset.retirementGroupCap - retirementGroup),
      rmf: Math.max(0, Math.min(rmfIndividualCap, dataset.retirementGroupCap - providentFund) - rmf),
      thaiEsg: Math.max(0, Math.min(dataset.thaiEsgCap, grossIncome * dataset.thaiEsgIncomePercent / 100) - thaiEsg),
    },
    warnings,
  }
}
