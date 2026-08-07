import { useEffect, useMemo } from 'react'
import { BriefcaseBusiness, Coffee, GraduationCap, Heart, Home, Landmark, Plus, Shield, Target, Trash2, UserPlus, Users, X } from 'lucide-react'
import { migratePlan, type GoalStatus, type GoalType, type HouseholdMember, type LifeGoal, type WealthPlan } from '../domain/schema'
import { allocateGoalFunding, monthsUntil } from '../domain/goals'
import { FormattedNumberInput } from './FormattedNumberInput'

const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
const typeOptions: Array<{ value: GoalType; label: string; icon: typeof Target }> = [
  { value: 'home', label: 'ซื้อบ้าน', icon: Home }, { value: 'education', label: 'การศึกษา', icon: GraduationCap },
  { value: 'wedding', label: 'แต่งงาน', icon: Heart }, { value: 'family', label: 'ดูแลครอบครัว', icon: Users },
  { value: 'business', label: 'เริ่มธุรกิจ', icon: BriefcaseBusiness }, { value: 'break', label: 'พักงาน', icon: Coffee },
  { value: 'retirement', label: 'เกษียณ', icon: Landmark }, { value: 'emergency', label: 'เงินสำรอง', icon: Shield },
  { value: 'custom', label: 'กำหนดเอง', icon: Target },
]
const statusLabels: Record<GoalStatus, string> = { active: 'กำลังออม', paused: 'พักออม', completed: 'สำเร็จแล้ว', cancelled: 'ยกเลิก' }

function futureMonth(years: number) {
  const date = new Date()
  date.setMonth(date.getMonth() + Math.round(years * 12))
  return date.toISOString().slice(0, 7)
}

export function LifeCanvas({ plan: rawPlan, setPlan }: { plan: WealthPlan; setPlan: React.Dispatch<React.SetStateAction<WealthPlan>> }) {
  const plan = Array.isArray(rawPlan.goals) ? rawPlan : migratePlan(rawPlan)
  useEffect(() => { if (!Array.isArray(rawPlan.goals)) setPlan(migratePlan(rawPlan)) }, [rawPlan, setPlan])
  const allocation = useMemo(() => allocateGoalFunding(plan), [plan])
  const patchGoal = (id: string, patch: Partial<LifeGoal>) => setPlan((current) => ({ ...current, goals: current.goals.map((goal) => goal.id === id ? { ...goal, ...patch } : goal) }))
  const addGoal = () => setPlan((current) => ({ ...current, goals: [...current.goals, {
    id: crypto.randomUUID(), name: 'เป้าหมายใหม่', type: 'custom', status: 'active', priority: 3,
    targetDate: futureMonth(5), targetAmount: 1_000_000, fundedAmount: 0, inflationRate: 2.5,
    minimumMonthly: 0, fundingAccountId: current.accounts[0]?.id ?? null, memberId: current.householdMembers[0]?.id ?? null,
  }] }))
  const addMember = () => setPlan((current) => ({ ...current, householdMembers: [...current.householdMembers, { id: crypto.randomUUID(), name: `สมาชิก ${current.householdMembers.length + 1}` }] }))
  const patchMember = (id: string, patch: Partial<HouseholdMember>) => setPlan((current) => ({ ...current, householdMembers: current.householdMembers.map((member) => member.id === id ? { ...member, ...patch } : member) }))

  return <section className="content-section life-canvas" id="life-canvas">
    <div className="section-heading"><div><span className="eyebrow">LIFE CANVAS</span><h2>ให้ทุกเป้าหมายใช้เงินก้อนเดียวกันอย่างมีลำดับ</h2></div><button className="life-add" onClick={addGoal}><Plus />เพิ่มเป้าหมาย</button></div>
    <div className={`allocation-overview panel ${allocation.collisions ? 'has-collision' : ''}`}>
      <div><span>เงินเหลือจริง/เดือน</span><strong>{money.format(allocation.availableBudget)}</strong><small>{allocation.cashFlowLimited ? `จากงบที่ตั้ง ${money.format(allocation.requestedBudget)}` : 'ไม่เกินกระแสเงินสดที่เหลือ'}</small></div>
      <div><span>โปะหนี้</span><strong>{money.format(allocation.debtAllocation)}</strong><small>นับอยู่ในงบก้อนเดียวกัน</small></div>
      <div><span>จัดให้เป้าหมาย</span><strong>{money.format(allocation.goalAllocation)}</strong><small>ไม่มีการนับเงินซ้ำ</small></div>
      <div><span>เป้าหมายชนกัน</span><strong>{allocation.collisions}</strong><small>{allocation.collisions ? 'ดูเหตุผลในแต่ละเป้าหมาย' : 'งบรองรับตามลำดับแล้ว'}</small></div>
      <label>งบทั้งหมดต่อเดือน <b>{money.format(plan.monthlyGoalBudget)}</b><input aria-label="งบเป้าหมายต่อเดือน" type="range" min="0" max={Math.max(100_000, Math.ceil(allocation.requestedBudget / 10_000) * 10_000)} step="1000" value={plan.monthlyGoalBudget} onChange={(event) => setPlan((current) => ({ ...current, monthlyGoalBudget: Number(event.target.value) }))} /></label>
    </div>

    <div className="household-bar"><div><Users /><span><b>สมาชิกในแผน</b><small>เมื่อลบสมาชิก เป้าหมายเดิมจะถูกพักเพื่อให้มอบหมายใหม่</small></span></div><div className="member-list">{plan.householdMembers.map((member) => <span key={member.id}><input aria-label="ชื่อสมาชิก" value={member.name} onChange={(event) => patchMember(member.id, { name: event.target.value || 'สมาชิก' })} />{plan.householdMembers.length > 1 && <button aria-label={`ลบ ${member.name}`} onClick={() => setPlan((current) => ({ ...current, householdMembers: current.householdMembers.filter((item) => item.id !== member.id) }))}><X /></button>}</span>)}<button onClick={addMember}><UserPlus />เพิ่มสมาชิก</button></div></div>

    <div className="goal-timeline-head"><span>วันนี้</span><i /><span>10 ปี</span><i /><span>20 ปี</span><i /><span>30 ปี</span><i /><span>40 ปี</span></div>
    <div className="goal-editor-list">{allocation.allocations.map((item) => {
      const goal = item.goal
      const selectedType = typeOptions.find((type) => type.value === goal.type) ?? typeOptions.at(-1)!
      const Icon = selectedType.icon
      const horizon = Math.min(40, Math.round(monthsUntil(goal.targetDate) / 12))
      return <article className={`panel goal-editor ${goal.status} ${item.collision ? 'collision' : ''}`} key={goal.id}>
        <div className="goal-main"><div className="goal-type-icon"><Icon /></div><div className="goal-identity"><input aria-label="ชื่อเป้าหมาย" value={goal.name} onChange={(event) => patchGoal(goal.id, { name: event.target.value || 'เป้าหมาย' })} /><select aria-label="ประเภทเป้าหมาย" value={goal.type} onChange={(event) => patchGoal(goal.id, { type: event.target.value as GoalType })}>{typeOptions.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></div><div className="goal-status"><select aria-label="สถานะเป้าหมาย" value={goal.status} onChange={(event) => patchGoal(goal.id, { status: event.target.value as GoalStatus })}>{(Object.keys(statusLabels) as GoalStatus[]).map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select><button aria-label={`ลบ ${goal.name}`} onClick={() => setPlan((current) => ({ ...current, goals: current.goals.filter((entry) => entry.id !== goal.id) }))}><Trash2 /></button></div></div>
        <div className="goal-timeline"><label><span>{horizon === 0 ? 'ภายในปีนี้' : `อีก ${horizon} ปี`} · {goal.targetDate}</span><input aria-label={`ระยะเวลาของ ${goal.name}`} type="range" min="0" max="40" value={horizon} onChange={(event) => patchGoal(goal.id, { targetDate: futureMonth(Number(event.target.value)) })} /></label><div className="priority-control" role="group" aria-label={`ลำดับความสำคัญของ ${goal.name}`}><span>Priority</span>{[1,2,3,4,5].map((priority) => <button key={priority} className={goal.priority === priority ? 'active' : ''} aria-pressed={goal.priority === priority} onClick={() => patchGoal(goal.id, { priority })}>{priority}</button>)}</div></div>
        <div className="goal-results"><div><span>Goal Success</span><strong>{item.successProbability.toFixed(0)}%</strong><i><b style={{ width: `${item.successProbability}%` }} /></i><small>planning score · Monte Carlo ใน P5</small></div><div><span>จัดสรร/เดือน</span><strong>{money.format(item.allocatedMonthly)}</strong><small>ต้องใช้ {money.format(item.requiredMonthly)}</small></div><div><span>Funding gap</span><strong>{money.format(item.fundingGap)}</strong><small>เป้าปรับเงินเฟ้อ {money.format(item.inflationAdjustedTarget)}</small></div><p className={item.collision ? 'warning' : ''}>{item.reason}</p></div>
        <details className="goal-details"><summary>ปรับจำนวนเงิน เงินเฟ้อ บัญชี และเจ้าของเป้าหมาย</summary><div><label>เป้าหมายวันนี้<FormattedNumberInput min="0" value={goal.targetAmount} onValueChange={(value) => patchGoal(goal.id, { targetAmount: Math.max(0, value) })} /></label><label>มีแล้ว<FormattedNumberInput min="0" value={goal.fundedAmount} onValueChange={(value) => patchGoal(goal.id, { fundedAmount: Math.max(0, value) })} /></label><label>เงินเฟ้อเฉพาะเป้า %<FormattedNumberInput step="0.1" value={goal.inflationRate} onValueChange={(value) => patchGoal(goal.id, { inflationRate: value })} /></label><label>ขั้นต่ำ/เดือน<FormattedNumberInput min="0" value={goal.minimumMonthly} onValueChange={(value) => patchGoal(goal.id, { minimumMonthly: Math.max(0, value) })} /></label><label>บัญชีเงินทุน<select value={goal.fundingAccountId ?? ''} onChange={(event) => patchGoal(goal.id, { fundingAccountId: event.target.value || null })}><option value="">ไม่ระบุ</option>{plan.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label>สมาชิก<select value={goal.memberId ?? ''} onChange={(event) => patchGoal(goal.id, { memberId: event.target.value || null })}><option value="">ส่วนกลาง</option>{plan.householdMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label></div></details>
      </article>
    })}</div>
  </section>
}
