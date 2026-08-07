import type { LegacyConfig } from './schema'

export interface LegacyReadiness {
  score: number
  completedItems: number
  inProgressItems: number
  missingItems: number
  encryptedReferenceCount: number
  missingOwnerCount: number
  beneficiaryReviewStale: boolean
  nextActions: string[]
}

export function calculateLegacyReadiness(config: LegacyConfig, today = new Date()) : LegacyReadiness {
  const completedItems = config.items.filter((item) => item.status === 'complete').length
  const inProgressItems = config.items.filter((item) => item.status === 'inProgress').length
  const missingItems = config.items.filter((item) => item.status === 'missing').length
  const encryptedReferenceCount = config.items.filter((item) => item.localDocumentReference?.startsWith('flowref:v1:')).length
  const missingOwnerCount = config.items.filter((item) => item.ownerMemberId === null).length
  const checklistScore = config.items.length ? (completedItems + inProgressItems * .5) / config.items.length * 80 : 0
  const contactScore = config.emergencyContactReady ? 10 : 0
  let beneficiaryReviewStale = true
  if (config.beneficiaryReviewDate) {
    const reviewed = new Date(`${config.beneficiaryReviewDate}T00:00:00`)
    beneficiaryReviewStale = !Number.isFinite(reviewed.getTime()) || today.getTime() - reviewed.getTime() > 365.25 * 24 * 60 * 60 * 1000
  }
  const reviewScore = beneficiaryReviewStale ? 0 : 10
  const nextActions: string[] = []
  if (!config.emergencyContactReady) nextActions.push('ยืนยันผู้ติดต่อฉุกเฉินและวิธีเข้าถึงข้อมูลที่จำเป็น')
  if (beneficiaryReviewStale) nextActions.push('ทบทวนผู้รับผลประโยชน์ภายในรอบ 12 เดือน')
  const firstMissing = config.items.find((item) => item.status === 'missing')
  if (firstMissing) nextActions.push(`เริ่มรายการ: ${firstMissing.title}`)
  if (missingOwnerCount) nextActions.push(`ระบุเจ้าของหรือผู้รับผิดชอบอีก ${missingOwnerCount} รายการ`)
  return { score: Math.round(checklistScore + contactScore + reviewScore), completedItems, inProgressItems, missingItems, encryptedReferenceCount, missingOwnerCount, beneficiaryReviewStale, nextActions: nextActions.slice(0, 4) }
}
