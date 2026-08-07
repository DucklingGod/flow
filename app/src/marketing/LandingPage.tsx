import {
  ArrowRight, BarChart3, BookOpenCheck, Check, CircleGauge, Compass, DatabaseBackup, Flag,
  FlaskConical, Landmark, Lock, Menu, ReceiptText, ShieldCheck, Sparkles, WalletCards, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import './marketing.css'
import { annualSavingPercent, orderedPlans, planCatalog, type PlanDefinition } from '../domain/entitlements'
import { useFlowSession } from '../auth/sessionContext'
import { HeroCalculator } from './HeroCalculator'
import { useReveal } from './useReveal'

const pillars = [
  {
    icon: Compass,
    title: 'เห็นภาพรวมจากข้อมูลชุดเดียว',
    body: 'ทรัพย์สิน หนี้สิน กระแสเงินสด เป้าหมาย และพอร์ต อยู่บนฐานข้อมูลเดียวกัน แก้ที่เดียวแล้วอัปเดตทุกหน้าจอทันที',
  },
  {
    icon: FlaskConical,
    title: 'ทดลองอนาคตก่อนตัดสินใจ',
    body: 'Monte Carlo, stress test และ sensitivity บอกช่วงผลลัพธ์ที่เป็นไปได้ พร้อม seed ที่ทำซ้ำได้ ไม่ใช่ตัวเลขเดียวที่ดูดีเกินจริง',
  },
  {
    icon: ShieldCheck,
    title: 'ทุกตัวเลขตรวจย้อนกลับได้',
    body: 'ทุกผลลัพธ์บอกที่มา วันที่ของข้อมูล และเวอร์ชันของแบบจำลอง แผนเดิมจะไม่ถูกคำนวณใหม่ด้วยโมเดลใหม่จนกว่าคุณจะกดอนุมัติ',
  },
  {
    icon: Lock,
    title: 'ข้อมูลอยู่ในเครื่องคุณเป็นค่าเริ่มต้น',
    body: 'แผนถูกเก็บใน browser ของคุณ สำรองได้แบบเข้ารหัสด้วยรหัสผ่านที่เราไม่เคยเห็น และลบทิ้งทั้งหมดได้ทุกเมื่อ',
  },
]

const studios = [
  { icon: Compass, name: 'Studio View', detail: 'ภาพรวมแผนและสมมติฐานหลัก', tier: 'free' },
  { icon: WalletCards, name: 'Wealth Map', detail: 'ทรัพย์สิน หนี้สิน และกระแสเงินสด', tier: 'free' },
  { icon: Flag, name: 'Life Canvas', detail: 'จัดลำดับและติดตามเป้าหมายชีวิต', tier: 'free' },
  { icon: DatabaseBackup, name: 'Plan Vault', detail: 'สำรอง ย้อนเวอร์ชัน และลบข้อมูล', tier: 'free' },
  { icon: BarChart3, name: 'Portfolio X-Ray', detail: 'holdings, exposure, fee และความเสี่ยงจริง', tier: 'plus' },
  { icon: FlaskConical, name: 'Scenario Studio', detail: 'Monte Carlo, stress test และ sensitivity', tier: 'plus' },
  { icon: Landmark, name: 'Retirement', detail: 'เตรียม cash-flow หลังเกษียณ', tier: 'plus' },
  { icon: ReceiptText, name: 'Thailand Tax', detail: 'ภาษีรายปีและสิทธิลดหย่อนแบบมี version', tier: 'pro' },
  { icon: CircleGauge, name: 'Protection Gap', detail: 'เงินสำรอง ชีวิต สุขภาพ และรายได้', tier: 'pro' },
  { icon: BookOpenCheck, name: 'Wealth Review', detail: 'ทบทวนแผนและ AI Copilot', tier: 'pro' },
]

const problems = [
  {
    pain: 'เงินกระจายอยู่หลายที่ จนไม่รู้ว่าตัวเองมีเท่าไหร่จริง ๆ',
    detail: 'บัญชีธนาคารหลายแห่ง กองทุน หุ้น ประกัน RMF/SSF และหนี้อีกหลายก้อน แต่ละที่เห็นแค่ส่วนของตัวเอง',
    answer: 'Wealth Map รวมทรัพย์สิน หนี้สิน และกระแสเงินสดไว้ที่เดียว แล้วคำนวณมูลค่าสุทธิกับเงินสำรองให้อัตโนมัติ',
    studio: 'Wealth Map',
  },
  {
    pain: 'ไม่รู้ว่าเป้าหมายที่ตั้งไว้ จะไปถึงจริงหรือเปล่า',
    detail: 'บ้าน การศึกษาลูก เกษียณ — รู้ว่าอยากได้ แต่ไม่รู้ว่าต้องเก็บเดือนละเท่าไหร่ และถ้าตลาดไม่เป็นใจจะเป็นอย่างไร',
    answer: 'ใส่เป้าหมายแล้วดูว่าต้องลงทุนเท่าไหร่ พร้อมช่วงผลลัพธ์จาก Monte Carlo ไม่ใช่ตัวเลขเดียวที่ดูดีเกินจริง',
    studio: 'Life Canvas + Scenario Studio',
  },
  {
    pain: 'Excel ที่ทำเองพังทุกครั้งที่แก้ และไม่บอกความไม่แน่นอน',
    detail: 'สูตรซ้อนกันจนไม่กล้าแตะ ลืมว่าเคยตั้งสมมติฐานอะไรไว้ และไม่มีใครตรวจว่าคำนวณถูก',
    answer: 'ทุกผลลัพธ์บอกสูตร สมมติฐาน วันที่ของข้อมูล และเวอร์ชันของแบบจำลอง ย้อนดูเวอร์ชันเก่าได้ทุกเมื่อ',
    studio: 'Plan Vault',
  },
  {
    pain: 'คำแนะนำที่ได้ มักมาพร้อมของที่เขาอยากขาย',
    detail: 'ยากที่จะแยกว่าอันไหนเหมาะกับเรา อันไหนเป็นเป้าการขายของคนแนะนำ',
    answer: 'Flow ไม่ขายผลิตภัณฑ์การเงิน ไม่รับค่าคอมมิชชั่น และไม่มีช่องทางซื้อขายใด ๆ รายได้มาจากค่าสมาชิกเท่านั้น',
    studio: 'ไม่มี conflict of interest',
  },
  {
    pain: 'แอปการเงินส่วนใหญ่ ขอรหัสเข้าธนาคารก่อนเริ่ม',
    detail: 'ต้องแลกข้อมูลบัญชีทั้งหมดเพื่อดูกราฟสวย ๆ และไม่รู้ว่าข้อมูลถูกเก็บหรือส่งต่อไปไหนบ้าง',
    answer: 'Flow ไม่เชื่อมบัญชีธนาคารเลย คุณกรอกเฉพาะตัวเลขที่ต้องการ และข้อมูลถูกเก็บในเครื่องคุณเป็นค่าเริ่มต้น',
    studio: 'Local-first',
  },
]

const steps = [
  {
    title: 'กรอกตัวเลขที่คุณรู้อยู่แล้ว',
    body: 'เงินออม รายรับรายจ่าย หนี้ และเป้าหมาย เริ่มจากค่าประมาณก่อนก็ได้ ไม่ต้องเชื่อมบัญชีธนาคารหรือกรอกให้ครบในครั้งเดียว',
  },
  {
    title: 'ดูภาพรวมและช่วงผลลัพธ์ที่เป็นไปได้',
    body: 'Flow คำนวณมูลค่าสุทธิ ช่องว่างของเป้าหมาย และโอกาสสำเร็จ พร้อมบอกว่าตัวเลขแต่ละตัวมาจากสมมติฐานอะไร',
  },
  {
    title: 'เลือกสิ่งที่จะทำเดือนนี้ แล้วกลับมาทบทวน',
    body: 'ได้รายการที่เรียงตามผลกระทบ พร้อม trade-off ให้อ่านก่อนตัดสินใจ คุณเป็นคนลงมือเอง Flow บันทึกเหตุผลไว้ให้ย้อนดู',
  },
]

type CompareMark = 'yes' | 'partial' | 'no'
const compareColumns = ['Flow', 'Excel ที่ทำเอง', 'แอปธนาคาร', 'ที่ปรึกษาการเงิน'] as const
const compareRows: { label: string; marks: [CompareMark, CompareMark, CompareMark, CompareMark]; notes: [string, string, string, string] }[] = [
  {
    label: 'เห็นภาพรวมทุกบัญชีในที่เดียว',
    marks: ['yes', 'partial', 'no', 'yes'],
    notes: ['รวมให้อัตโนมัติ', 'ต้องทำเอง', 'เห็นเฉพาะของธนาคารนั้น', 'ถ้าให้ข้อมูลครบ'],
  },
  {
    label: 'จำลองความไม่แน่นอน (Monte Carlo)',
    marks: ['yes', 'partial', 'no', 'partial'],
    notes: ['พร้อม seed ที่ทำซ้ำได้', 'ทำได้แต่ยากมาก', 'ไม่มี', 'แล้วแต่เครื่องมือที่ใช้'],
  },
  {
    label: 'บอกที่มาและวันที่ของทุกตัวเลข',
    marks: ['yes', 'no', 'partial', 'partial'],
    notes: ['source + as-of + model version', 'ไม่มี', 'เฉพาะยอดของธนาคาร', 'แล้วแต่รายงาน'],
  },
  {
    label: 'ไม่มีแรงจูงใจในการขายผลิตภัณฑ์',
    marks: ['yes', 'yes', 'no', 'partial'],
    notes: ['รายได้จากค่าสมาชิกเท่านั้น', 'ไม่มีใครขายคุณ', 'มีผลิตภัณฑ์ของตัวเอง', 'ขึ้นกับรูปแบบค่าตอบแทน'],
  },
  {
    label: 'ข้อมูลอยู่ในมือคุณ',
    marks: ['yes', 'yes', 'no', 'no'],
    notes: ['เก็บในเครื่อง ลบเองได้', 'ไฟล์เป็นของคุณ', 'อยู่บนระบบธนาคาร', 'อยู่กับผู้ให้บริการ'],
  },
  {
    label: 'ไม่ต้องให้รหัสเข้าธนาคาร',
    marks: ['yes', 'yes', 'no', 'yes'],
    notes: ['ไม่เชื่อมบัญชีเลย', 'ไม่ต้อง', 'ต้องล็อกอิน', 'ไม่ต้อง'],
  },
]

const planChooser = [
  {
    who: 'เพิ่งเริ่มจัดระเบียบการเงิน',
    detail: 'อยากเห็นภาพรวมและตั้งเป้าหมายแรก ยังไม่มีพอร์ตลงทุนที่ซับซ้อน',
    tier: 'free' as const,
  },
  {
    who: 'มีพอร์ตลงทุนและหลายเป้าหมาย',
    detail: 'อยากรู้ความเสี่ยงจริงของพอร์ต ค่าธรรมเนียมที่จ่ายอยู่ และโอกาสไปถึงเกษียณ',
    tier: 'plus' as const,
  },
  {
    who: 'ต้องวางแผนภาษีและความคุ้มครอง',
    detail: 'ใช้สิทธิลดหย่อนเต็มที่ ตรวจช่องว่างความคุ้มครอง และเตรียมเอกสารให้ครอบครัว',
    tier: 'pro' as const,
  },
]

const reassurances = [
  'เริ่มฟรี ไม่ต้องใช้บัตรเครดิต',
  'ยกเลิกได้ทุกเมื่อ ไม่มีสัญญาผูกมัด',
  'ลดกลับไปใช้ฟรี ข้อมูลไม่หาย',
  'ส่งออกข้อมูลของคุณได้เสมอ ทุกแพ็กเกจ',
]

const tierBadge: Record<string, string> = { free: 'ฟรี', plus: 'Plus', pro: 'Pro' }

const planHighlights: Record<string, string[]> = {
  free: [
    'Studio View, Wealth Map และ Life Canvas',
    'เป้าหมายชีวิตสูงสุด 3 รายการ',
    'Plan Vault: สำรองแบบเข้ารหัส 3 เวอร์ชัน',
    'Local Copilot แบบ deterministic',
    'ใช้งานออฟไลน์ได้เต็มรูปแบบ',
  ],
  plus: [
    'ทุกอย่างใน Free',
    'Portfolio X-Ray และ Scenario Studio',
    'Retirement และ Legacy Studio',
    'เป้าหมาย 25 รายการ · เวอร์ชัน 50 ชุด',
    'ส่งออกรายงาน CSV และ PDF',
    'Sync แบบเข้ารหัส 3 อุปกรณ์ · เร็ว ๆ นี้',
  ],
  pro: [
    'ทุกอย่างใน Plus',
    'Thailand Tax และ Protection Gap',
    'Data Studio และแหล่งข้อมูลผู้ให้บริการ',
    'AI Copilot (LM Studio / OpenRouter)',
    'Product Acceptance Snapshot',
    'ซัพพอร์ตลำดับต้น · Sync 10 อุปกรณ์ (เร็ว ๆ นี้)',
  ],
}

const faqs = [
  {
    q: 'ต้องเชื่อมบัญชีธนาคารหรือให้รหัสผ่านไหม',
    a: 'ไม่ต้องเลย Flow ไม่มีการเชื่อมต่อกับธนาคารหรือโบรกเกอร์ คุณกรอกเฉพาะตัวเลขที่ต้องการใช้วางแผน และแก้ไขหรือลบได้ตลอดเวลา',
  },
  {
    q: 'ต้องใช้เวลาตั้งค่านานไหม กว่าจะเห็นประโยชน์',
    a: 'เริ่มจากไม่กี่ช่อง — เงินออมตั้งต้น เงินลงทุนต่อเดือน ระยะเวลา และเป้าหมาย — แล้วจะเห็นผลลัพธ์ทันที ส่วนที่เหลือเช่นพอร์ตหรือภาษี ค่อยเติมเมื่อพร้อม',
  },
  {
    q: 'ข้อมูลการเงินของฉันถูกเก็บที่ไหน',
    a: 'ค่าเริ่มต้นคือเก็บใน browser ของคุณเองผ่าน IndexedDB ไม่มีการอัปโหลดขึ้น server เมื่อ sync แบบเข้ารหัสเปิดใช้งาน ข้อมูลจะถูกเข้ารหัสบนเครื่องก่อนส่งเสมอ และกุญแจอยู่กับคุณ',
  },
  {
    q: 'ต่างจากทำ Excel เองอย่างไร',
    a: 'Excel ทำได้เกือบทุกอย่าง ถ้าคุณมีเวลาและระวังสูตรเอง Flow ต่างตรงที่บอกที่มาของทุกตัวเลข เก็บเวอร์ชันย้อนหลังให้ จำลองความไม่แน่นอนแบบ Monte Carlo ได้ในคลิกเดียว และจะไม่คำนวณแผนเดิมด้วยโมเดลใหม่จนกว่าคุณจะอนุมัติ',
  },
  {
    q: 'Flow ซื้อขายหรือโอนเงินแทนฉันได้ไหม',
    a: 'ไม่ได้ และจะไม่ทำ Flow ไม่มีช่องทางเชื่อมต่อกับโบรกเกอร์ ธนาคาร หรือระบบยื่นภาษี ทุกคำแนะนำเป็นรายการที่คุณเลือกทำเองเท่านั้น',
  },
  {
    q: 'ตัวเลขที่ได้ถือเป็นคำแนะนำการลงทุนหรือไม่',
    a: 'ไม่ใช่ ผลลัพธ์ทั้งหมดเป็นการจำลองจากสมมติฐานที่คุณกรอกเอง ไม่ใช่การรับประกันผลตอบแทน และไม่ใช่คำแนะนำการลงทุน ภาษี หรือกฎหมายเฉพาะบุคคล',
  },
  {
    q: 'ถ้ายกเลิกแพ็กเกจ ข้อมูลจะหายไหม',
    a: 'ไม่หาย แผนของคุณอยู่ในเครื่องคุณ เมื่อกลับไปใช้ Free คุณจะยังเปิดดูและแก้ไขข้อมูลเดิมได้ เพียงแต่เครื่องมือระดับ Plus/Pro จะถูกล็อกไว้',
  },
  {
    q: 'รองรับภาษีไทยแล้วหรือยัง',
    a: 'Thailand Tax และ Protection ยังเป็นสถานะ estimate ที่ปิดไว้เป็นค่าเริ่มต้น จนกว่าจะผ่านการตรวจสอบจากผู้เชี่ยวชาญด้านการเงิน ภาษี และกฎหมายไทยอย่างเป็นอิสระ',
  },
  {
    q: 'Flow หารายได้จากอะไร',
    a: 'จากค่าสมาชิกเท่านั้น เราไม่ขายผลิตภัณฑ์การเงิน ไม่รับค่าคอมมิชชั่นจากผู้ให้บริการ ไม่มี analytics ภายนอก และไม่ขายข้อมูลผู้ใช้ นี่คือเหตุผลที่คำแนะนำใน Flow ไม่มีของที่เราอยากขายแฝงอยู่',
  },
  {
    q: 'ยกเลิกอย่างไร และข้อมูลจะเป็นอย่างไร',
    a: 'ยกเลิกได้ทุกเมื่อ ไม่มีสัญญาผูกมัด เมื่อกลับไปใช้แพ็กเกจฟรี แผนของคุณยังอยู่ในเครื่องครบถ้วน เปิดดูและแก้ไขได้ตามปกติ เพียงแต่เครื่องมือระดับ Plus/Pro จะถูกล็อก และคุณส่งออกข้อมูลทั้งหมดได้เสมอทุกแพ็กเกจ',
  },
]

function PlanCard({ plan, annual, featured }: { plan: PlanDefinition; annual: boolean; featured: boolean }) {
  const price = annual ? plan.annualThb : plan.monthlyThb
  const saving = annualSavingPercent(plan.tier)
  return (
    <article className={`plan-card${featured ? ' featured' : ''}`}>
      {featured && <span className="plan-flag">แนะนำ</span>}
      <header>
        <strong>{plan.name}</strong>
        <p>{plan.tagline}</p>
      </header>
      <div className="plan-price">
        {price === 0
          ? <><b>ฟรี</b><span>ตลอดการใช้งาน</span></>
          : <><b>฿{price.toLocaleString('th-TH')}</b><span>{annual ? '/ปี' : '/เดือน'}</span></>}
        {annual && saving > 0 && <em>ประหยัด {saving}%</em>}
      </div>
      <ul>
        {planHighlights[plan.tier].map((item) => <li key={item}><Check />{item}</li>)}
      </ul>
      <a className={featured ? 'plan-cta primary' : 'plan-cta'} href={plan.monthlyThb === 0 ? '/sign-up' : `/sign-up?plan=${plan.billingPlanId}`}>
        {plan.monthlyThb === 0 ? 'เริ่มใช้ฟรี' : `เลือก ${plan.name}`}<ArrowRight />
      </a>
    </article>
  )
}

// Marketing paths that are really deep links into a section of this page. The
// in-app upgrade prompts link to /pricing, so landing at the top of the hero
// instead of the plan table would strand a user who is actively trying to buy.
const sectionForPath: Record<string, string> = {
  '/pricing': 'pricing',
  '/features': 'features',
  '/studios': 'studios',
  '/faq': 'faq',
}

export function LandingPage() {
  const [annual, setAnnual] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const session = useFlowSession()
  const signedIn = session.status === 'signedIn'

  useReveal()

  useEffect(() => {
    const sectionId = sectionForPath[window.location.pathname]
    if (!sectionId) return
    // Jump rather than smooth-scroll: this is an arrival, not a nudge, and it
    // avoids animating a full page for anyone who asked for reduced motion.
    document.getElementById(sectionId)?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [])

  return (
    <div className="marketing">
      <header className="marketing-nav">
        <a className="marketing-brand" href="/">
          <img src="/flow-logo-optimized.png" alt="" />
          <span><strong>flow.</strong><small>wealth studio</small></span>
        </a>
        <nav className={menuOpen ? 'open' : ''} aria-label="เมนูหลัก">
          <a href="#problem" onClick={() => setMenuOpen(false)}>ปัญหาที่แก้</a>
          <a href="#studios" onClick={() => setMenuOpen(false)}>เครื่องมือ</a>
          <a href="#compare" onClick={() => setMenuOpen(false)}>เปรียบเทียบ</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>ราคา</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>คำถาม</a>
        </nav>
        <div className="marketing-nav-actions">
          {/* Only an actually signed-in visitor skips the funnel. A build with no
              identity provider still routes through the auth pages, which explain
              the local-only state and offer a direct "open locally" escape — far
              clearer than silently dropping someone into the planner. */}
          {signedIn
            ? <a className="nav-cta" href="/#/studio">เปิดแอป<ArrowRight /></a>
            : <>
                <a className="nav-link" href="/sign-in">เข้าสู่ระบบ</a>
                <a className="nav-cta" href="/sign-up">เริ่มใช้ฟรี<ArrowRight /></a>
              </>}
        </div>
        <button className="marketing-menu-toggle" aria-expanded={menuOpen} aria-label="เปิดหรือปิดเมนู" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-eyebrow"><Sparkles />PERSONAL WEALTH OPERATING SYSTEM</span>
            <h1>ออกแบบความมั่งคั่ง<br /><em>ให้ไปพร้อมกับชีวิต</em></h1>
            <p>เห็นภาพการเงินวันนี้ ทดลองอนาคตด้วยแบบจำลองที่ตรวจย้อนกลับได้ แล้วเลือกสิ่งที่ควรทำต่อ — โดยข้อมูลยังอยู่ในเครื่องของคุณ</p>
            <div className="hero-actions">
              <a className="hero-primary" href="/sign-up">เริ่มใช้ฟรี ไม่ต้องใช้บัตร<ArrowRight /></a>
              <a className="hero-secondary" href="#pricing">ดูแพ็กเกจทั้งหมด</a>
            </div>
            <ul className="hero-trust">
              <li><Lock />ข้อมูลอยู่ในเครื่อง</li>
              <li><ShieldCheck />ไม่มีการซื้อขายแทนคุณ</li>
              <li><DatabaseBackup />สำรองแบบเข้ารหัส</li>
            </ul>
          </div>
          <div className="hero-visual">
            <HeroCalculator />
          </div>
        </section>

        <section className="marketing-section problem-section" id="problem">
          <div className="section-intro">
            <span className="eyebrow">ปัญหาที่ FLOW แก้</span>
            <h2>ถ้าคุณเคยเจอห้าเรื่องนี้<br />Flow ถูกสร้างมาเพื่อคุณ</h2>
            <p>ไม่ใช่แอปจดรายรับรายจ่าย และไม่ใช่แอปเทรด แต่เป็นที่ที่คุณตอบได้ว่า “ตอนนี้อยู่ตรงไหน จะไปถึงไหม และเดือนนี้ควรทำอะไร”</p>
          </div>
          <div className="problem-list">
            {problems.map(({ pain, detail, answer, studio }, index) => (
              <article className="problem-row" data-reveal key={pain}>
                <div className="problem-pain">
                  <span className="problem-index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{pain}</strong>
                    <p>{detail}</p>
                  </div>
                </div>
                <div className="problem-answer">
                  <span className="problem-answer-tag"><Check />Flow แก้ให้อย่างไร</span>
                  <p>{answer}</p>
                  <small>{studio}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section how-section" id="how">
          <div className="section-intro">
            <span className="eyebrow">เริ่มอย่างไร</span>
            <h2>สามขั้นตอน ใช้เวลาไม่ถึงสิบนาที</h2>
          </div>
          <ol className="step-list">
            {steps.map(({ title, body }, index) => (
              <li data-reveal key={title}>
                <span className="step-number">{index + 1}</span>
                <div><strong>{title}</strong><p>{body}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="marketing-section" id="features">
          <div className="section-intro">
            <span className="eyebrow">ทำไมต้อง FLOW</span>
            <h2>เครื่องมือวางแผน ที่ไม่ขอให้คุณเชื่อโดยไม่มีหลักฐาน</h2>
          </div>
          <div className="pillar-grid">
            {pillars.map(({ icon: Icon, title, body }) => (
              <article className="pillar-card" data-reveal key={title}>
                <span className="pillar-icon"><Icon /></span>
                <strong>{title}</strong>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section studios-section" id="studios">
          <div className="section-intro">
            <span className="eyebrow">เครื่องมือทั้งหมด</span>
            <h2>สิบสามหน้าจอ ที่ทำงานบนแผนเดียวกัน</h2>
            <p>เริ่มจากสี่เครื่องมือหลักแบบฟรี แล้วปลดล็อกส่วนที่ลึกขึ้นเมื่อแผนของคุณซับซ้อนขึ้น</p>
          </div>
          <div className="studio-showcase">
            {studios.map(({ icon: Icon, name, detail, tier }) => (
              <article className={`studio-chip tier-${tier}`} data-reveal key={name}>
                <span className="studio-chip-icon"><Icon /></span>
                <div><strong>{name}</strong><small>{detail}</small></div>
                <span className={`studio-tier tier-${tier}`}>{tierBadge[tier]}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section compare-section" id="compare">
          <div className="section-intro">
            <span className="eyebrow">เปรียบเทียบ</span>
            <h2>Flow เทียบกับวิธีที่คุณอาจใช้อยู่</h2>
            <p>ทุกวิธีมีข้อดีของตัวเอง ตารางนี้บอกตรง ๆ ว่าแต่ละอย่างเก่งเรื่องไหน เพื่อให้คุณเลือกได้ว่าจำเป็นต้องมี Flow จริงหรือไม่</p>
          </div>
          <div className="compare-scroll" data-reveal tabIndex={0} role="group" aria-label="ตารางเปรียบเทียบ Flow กับทางเลือกอื่น">
            <table className="compare-table">
              <caption className="visually-hidden">เปรียบเทียบความสามารถของ Flow กับ Excel แอปธนาคาร และที่ปรึกษาการเงิน</caption>
              <thead>
                <tr>
                  <th scope="col">ความสามารถ</th>
                  {compareColumns.map((column) => <th scope="col" key={column} className={column === 'Flow' ? 'compare-own' : ''}>{column}</th>)}
                </tr>
              </thead>
              <tbody>
                {compareRows.map(({ label, marks, notes }) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {marks.map((mark, index) => (
                      <td key={compareColumns[index]} className={`mark-${mark}${index === 0 ? ' compare-own' : ''}`}>
                        <span className="mark-icon" aria-hidden="true" />
                        <span className="visually-hidden">{mark === 'yes' ? 'ทำได้' : mark === 'partial' ? 'ทำได้บางส่วน' : 'ทำไม่ได้'} — </span>
                        <small>{notes[index]}</small>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="compare-note">
            <Check />Excel และที่ปรึกษาที่ดีก็ทำงานได้ดีมาก — Flow เหมาะกับคนที่อยากได้ความเร็วของเครื่องมือสำเร็จรูป โดยไม่ต้องแลกด้วยการมอบข้อมูลหรือรับคำแนะนำที่มีของแถมมาขาย
          </p>
        </section>

        <section className="marketing-section privacy-band" data-reveal>
          <div className="privacy-copy">
            <span className="eyebrow light">ขอบเขตที่เราไม่ข้าม</span>
            <h2>Flow อ่านและคำนวณ<br />แต่ไม่ลงมือแทนคุณ</h2>
            <p>ไม่มีการเชื่อมต่อโบรกเกอร์ ไม่มีการโอนเงิน ไม่มีการยื่นภาษี และไม่มีการให้ AI ถือเครื่องมือใด ๆ การกด “อนุมัติ” คือการเพิ่มรายการที่คุณจะไปทำเอง พร้อมบันทึกเหตุผลไว้ให้ย้อนดู</p>
          </div>
          <ul className="privacy-list">
            <li><Check />ข้อมูลเก็บใน browser ของคุณเป็นค่าเริ่มต้น</li>
            <li><Check />สำรองข้อมูลเข้ารหัส AES-256-GCM ด้วยรหัสผ่านของคุณ</li>
            <li><Check />Sync เข้ารหัสบนเครื่องก่อนส่งทุกครั้ง</li>
            <li><Check />ลบข้อมูลทั้งหมดในเครื่องได้ด้วยตัวเอง</li>
            <li><Check />ไม่มี analytics ภายนอก ไม่ขายข้อมูล</li>
          </ul>
        </section>

        <section className="marketing-section pricing-section" id="pricing">
          <div className="section-intro">
            <span className="eyebrow">ราคา</span>
            <h2>เริ่มฟรี จ่ายเมื่อแผนของคุณต้องการมากกว่านี้</h2>
            <div className="billing-toggle" role="group" aria-label="รอบการเรียกเก็บเงิน">
              <button className={annual ? '' : 'active'} aria-pressed={!annual} onClick={() => setAnnual(false)}>รายเดือน</button>
              <button className={annual ? 'active' : ''} aria-pressed={annual} onClick={() => setAnnual(true)}>รายปี<em>ประหยัดกว่า</em></button>
            </div>
          </div>
          <div className="plan-chooser" data-reveal>
            <span className="plan-chooser-title">ไม่แน่ใจว่าควรเลือกอันไหน?</span>
            <div className="plan-chooser-grid">
              {planChooser.map(({ who, detail, tier }) => (
                <article key={who}>
                  <strong>{who}</strong>
                  <p>{detail}</p>
                  <span className={`studio-tier tier-${tier}`}>เริ่มที่ {planCatalog[tier].name}</span>
                </article>
              ))}
            </div>
          </div>
          <div className="plan-grid" data-reveal>
            {orderedPlans.map((plan) => <PlanCard key={plan.tier} plan={plan} annual={annual} featured={plan.tier === 'plus'} />)}
          </div>
          <ul className="pricing-reassurance">
            {reassurances.map((item) => <li key={item}><Check />{item}</li>)}
          </ul>
          <p className="pricing-note">ราคารวมภาษีมูลค่าเพิ่มแล้ว · รายการที่ระบุว่า “เร็ว ๆ นี้” ยังไม่เปิดใช้งาน และจะไม่ถูกนับเป็นเหตุผลในการเรียกเก็บเงินจนกว่าจะพร้อมใช้จริง</p>
        </section>

        <section className="marketing-section faq-section" id="faq">
          <div className="section-intro">
            <span className="eyebrow">คำถามที่พบบ่อย</span>
            <h2>สิ่งที่คนมักถามก่อนเริ่ม</h2>
          </div>
          <div className="faq-list">
            {faqs.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="closing-cta" data-reveal>
          <div>
            <h2>เริ่มวางแผนวันนี้ ด้วยข้อมูลที่คุณควบคุมเอง</h2>
            <p>ไม่ต้องใช้บัตรเครดิต ไม่ต้องเชื่อมบัญชีธนาคาร เริ่มจากตัวเลขที่คุณรู้อยู่แล้ว</p>
          </div>
          <a href="/sign-up">สร้างบัญชีฟรี<ArrowRight /></a>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="footer-brand">
          <img src="/flow-logo-optimized.png" alt="" />
          <div><strong>Flow Wealth Studio</strong><small>Design wealth. Live with clarity.</small></div>
        </div>
        <p className="footer-disclaimer">
          ผลลัพธ์ทั้งหมดเป็นแบบจำลองจากสมมติฐานที่ผู้ใช้กำหนด ไม่ใช่การรับประกันผลตอบแทน และไม่ใช่คำแนะนำการลงทุน ภาษี หรือกฎหมายเฉพาะบุคคล
          Flow ไม่ดำเนินการซื้อขาย โอนเงิน หรือยื่นภาษีแทนผู้ใช้
        </p>
        <div className="footer-links">
          <a href="/#/studio">เปิดแอป</a>
          <a href="#pricing">ราคา</a>
          <a href="/sign-in">เข้าสู่ระบบ</a>
        </div>
      </footer>
    </div>
  )
}
