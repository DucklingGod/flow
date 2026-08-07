import { Lock, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEntitlement } from '../auth/useEntitlement'
import { planFor, requiredTierFor, type EntitlementKey } from '../domain/entitlements'

/**
 * Renders `children` when the current tier grants `entitlement`, otherwise an
 * upgrade prompt naming the cheapest tier that unlocks it.
 *
 * This stops an honest user from wandering into a paid surface; it does not
 * stop a determined one. See `useEntitlement` for the enforcement caveat.
 */
export function FeatureGate({ entitlement, title, children }: { entitlement: EntitlementKey; title: string; children: ReactNode }) {
  const allowed = useEntitlement(entitlement)
  if (allowed) return <>{children}</>

  const required = requiredTierFor(entitlement)
  const plan = required ? planFor(required) : null

  return (
    <section className="feature-gate panel" aria-labelledby="feature-gate-title">
      <div className="feature-gate-icon"><Lock /></div>
      <div className="feature-gate-copy">
        <span className="eyebrow">{plan ? plan.name.toUpperCase() : 'UPGRADE'}</span>
        <h2 id="feature-gate-title">{title}</h2>
        <p>
          {plan
            ? `เครื่องมือนี้อยู่ในแพ็กเกจ ${plan.name} — ${plan.tagline} เริ่มต้น ${plan.monthlyThb.toLocaleString('th-TH')} บาท/เดือน`
            : 'เครื่องมือนี้ยังไม่เปิดให้ใช้งานในบัญชีของคุณ'}
        </p>
        <p className="feature-gate-note">แผนและข้อมูลทั้งหมดของคุณยังอยู่ในเครื่องเหมือนเดิม การอัปเกรดไม่เปลี่ยนตัวเลขที่คุณกรอกไว้</p>
      </div>
      <a className="feature-gate-action" href="/pricing">
        <Sparkles />ดูแพ็กเกจ
      </a>
    </section>
  )
}
