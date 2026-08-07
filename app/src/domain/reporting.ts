import { calculateProjection } from './finance/projection'
import { analyzePortfolio } from './portfolio'
import type { WealthPlan } from './schema'
import { calculateWealthHealth } from './wealth'

const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })

function csvCell(value: unknown) {
  let text = String(value ?? '')
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

export function buildCsvReport(plan: WealthPlan, generatedAt = new Date()) {
  const wealth = calculateWealthHealth(plan)
  const projection = calculateProjection(plan)
  const portfolio = analyzePortfolio(plan)
  const rows: unknown[][] = [
    ['Flow Wealth Studio report', generatedAt.toISOString()],
    ['คำเตือน', 'แบบจำลองเพื่อการวางแผน ไม่ใช่คำแนะนำหรือการรับประกันผลตอบแทน'],
    ['Calculation model', projection.modelVersion, `schema v${plan.version}`],
    [],
    ['สรุป', 'ค่า', 'หน่วย/วันที่'],
    ['ความมั่งคั่งสุทธิ', wealth.netWorth, 'THB'],
    ['เงินสำรอง', wealth.emergencyMonths.toFixed(2), 'เดือน'],
    ['มูลค่าเป้าหมายจำลอง', projection.futureValue, 'THB'],
    ['ผลตอบแทนสุทธิจำลอง', projection.netAnnualReturn.toFixed(2), '%/ปี'],
    ['มูลค่าพอร์ต', portfolio.totalValue, 'THB'],
    ['ค่าธรรมเนียมพอร์ต', portfolio.annualFeeBaht, 'THB/ปี'],
    [],
    ['บัญชีทรัพย์สิน', 'ประเภท', 'ยอดคงเหลือ', 'สกุลเงิน'],
    ...plan.accounts.map((item) => [item.name, item.type, item.balance, item.currency]),
    [],
    ['เป้าหมาย', 'ประเภท', 'เป้าหมายวันนี้', 'ยอดสะสม', 'วันเป้าหมาย', 'สถานะ'],
    ...plan.goals.map((item) => [item.name, item.type, item.targetAmount, item.fundedAmount, item.targetDate, item.status]),
    [],
    ['Holding', 'Symbol', 'Asset class', 'มูลค่า THB', 'Source as-of'],
    ...plan.holdings.map((item) => [item.name, item.symbol, item.assetClass, item.quantity * item.currentPrice * item.fxToThb, item.sourceAsOf]),
  ]
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`
}

export function buildPrintableReport(plan: WealthPlan, generatedAt = new Date()) {
  const wealth = calculateWealthHealth(plan)
  const projection = calculateProjection(plan)
  const portfolio = analyzePortfolio(plan)
  const accounts = plan.accounts.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.type)}</td><td class="num">${escapeHtml(money.format(item.balance))}</td><td>${escapeHtml(item.currency)}</td></tr>`).join('')
  const goals = plan.goals.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.targetDate)}</td><td class="num">${escapeHtml(money.format(item.targetAmount))}</td><td class="num">${escapeHtml(money.format(item.fundedAmount))}</td><td>${escapeHtml(item.status)}</td></tr>`).join('')
  const holdings = plan.holdings.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.symbol)}</td><td>${escapeHtml(item.assetClass)}</td><td class="num">${escapeHtml(money.format(item.quantity * item.currentPrice * item.fxToThb))}</td><td>${escapeHtml(item.sourceAsOf)}</td></tr>`).join('')
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Flow Wealth Report</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#173a2f;font:12px/1.45 Arial,sans-serif}header{padding:22px;border-radius:18px;background:#f0f7df}h1{margin:5px 0;font-size:28px}h2{margin:22px 0 8px;font-size:17px}.eyebrow{color:#6d7f77;font-size:10px;font-weight:700;letter-spacing:.13em}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.card{padding:12px;border:1px solid #dce4d8;border-radius:12px}.card span{display:block;color:#65776f;font-size:10px}.card b{display:block;margin-top:3px;font-size:18px}table{width:100%;border-collapse:collapse;page-break-inside:auto}th,td{padding:7px;border-bottom:1px solid #dfe5dd;text-align:left}th{color:#52665d;background:#f5f7f3}.num{text-align:right}tr{page-break-inside:avoid}footer{margin-top:24px;padding-top:10px;border-top:1px solid #dfe5dd;color:#6c7b74;font-size:10px}</style></head><body><header><span class="eyebrow">FLOW WEALTH STUDIO · LOCAL REPORT</span><h1>ภาพรวมแผนความมั่งคั่ง</h1><p>สร้างเมื่อ ${escapeHtml(generatedAt.toLocaleString('th-TH'))} · schema v${escapeHtml(plan.version)} · model ${escapeHtml(projection.modelVersion)}</p></header><div class="cards"><div class="card"><span>ความมั่งคั่งสุทธิ</span><b>${escapeHtml(money.format(wealth.netWorth))}</b></div><div class="card"><span>เงินสำรอง</span><b>${escapeHtml(wealth.emergencyMonths.toFixed(1))} เดือน</b></div><div class="card"><span>มูลค่าปลายทางจำลอง</span><b>${escapeHtml(money.format(projection.futureValue))}</b></div><div class="card"><span>เงินต้นสะสม</span><b>${escapeHtml(money.format(projection.contributed))}</b></div><div class="card"><span>มูลค่าพอร์ต</span><b>${escapeHtml(money.format(portfolio.totalValue))}</b></div><div class="card"><span>ค่าธรรมเนียม/ปี</span><b>${escapeHtml(money.format(portfolio.annualFeeBaht))}</b></div></div><h2>บัญชีทรัพย์สิน</h2><table><thead><tr><th>ชื่อ</th><th>ประเภท</th><th class="num">ยอดคงเหลือ</th><th>สกุล</th></tr></thead><tbody>${accounts}</tbody></table><h2>เป้าหมายชีวิต</h2><table><thead><tr><th>เป้าหมาย</th><th>วันที่</th><th class="num">ยอดเป้าหมาย</th><th class="num">สะสมแล้ว</th><th>สถานะ</th></tr></thead><tbody>${goals}</tbody></table><h2>Portfolio holdings</h2><table><thead><tr><th>ชื่อ</th><th>Symbol</th><th>ประเภท</th><th class="num">มูลค่า</th><th>As-of</th></tr></thead><tbody>${holdings}</tbody></table><footer>ผลลัพธ์เป็นแบบจำลองจากข้อมูลและสมมติฐานของผู้ใช้ ไม่ใช่คำแนะนำการลงทุน ภาษี กฎหมาย หรือการรับประกันผลตอบแทน · รายงานนี้สร้างในเครื่องและอาจมีข้อมูลการเงินส่วนบุคคล</footer></body></html>`
}
