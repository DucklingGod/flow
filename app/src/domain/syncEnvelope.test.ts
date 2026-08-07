import { describe, expect, it } from 'vitest'
import { createSyncEnvelope, generateSyncEncryptionKey, openSyncEnvelope, validateSyncEnvelopeStructure } from './syncEnvelope'

const baseDigest = 'a'.repeat(64)
const input = {
  mutationId: 'mutation-001',
  planId: 'primary-plan',
  householdId: 'household-001',
  deviceId: 'device-001',
  keyId: 'key-gen-001',
  baseRevision: 4,
  localRevision: 5,
  baseDigest,
  sectionIds: ['projection', 'life'] as const,
  createdAt: '2026-08-07T08:00:00.000Z',
  expiresAt: '2026-08-08T08:00:00.000Z',
  plaintext: JSON.stringify({ expectedReturn: 6.5, monthlyContribution: 20_000 }),
}

describe('client-held encrypted sync envelope', () => {
  it('round-trips bound plaintext with a non-extractable AES-GCM key', async () => {
    const key = await generateSyncEncryptionKey()
    expect(key.extractable).toBe(false)
    const created = await createSyncEnvelope(input, key)
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(validateSyncEnvelopeStructure(created.envelope)).toBe(true)
    expect(created.envelope.ciphertext).not.toContain('expectedReturn')
    const opened = await openSyncEnvelope(created.envelope, key, { planId: input.planId, householdId: input.householdId, deviceId: input.deviceId }, input.createdAt)
    expect(opened).toMatchObject({ ok: true, plaintext: input.plaintext })
  })

  it('rejects a wrong key, ciphertext tampering, and resource substitution', async () => {
    const key = await generateSyncEncryptionKey()
    const created = await createSyncEnvelope(input, key)
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const wrongKey = await generateSyncEncryptionKey()
    expect(await openSyncEnvelope(created.envelope, wrongKey, { planId: input.planId, householdId: input.householdId, deviceId: input.deviceId }, input.createdAt)).toMatchObject({ ok: false, reason: 'integrity-failure' })
    const last = created.envelope.ciphertext.at(-2) === 'A' ? 'B' : 'A'
    const tampered = { ...created.envelope, ciphertext: `${created.envelope.ciphertext.slice(0, -2)}${last}=` }
    expect(await openSyncEnvelope(tampered, key, { planId: input.planId, householdId: input.householdId, deviceId: input.deviceId }, input.createdAt)).toMatchObject({ ok: false })
    expect(await openSyncEnvelope(created.envelope, key, { planId: 'other-plan', householdId: input.householdId, deviceId: input.deviceId }, input.createdAt)).toEqual({ ok: false, reason: 'binding-mismatch' })
  })

  it('fails closed for rollback revisions, unsafe metadata, and expired envelopes', async () => {
    const key = await generateSyncEncryptionKey()
    expect(await createSyncEnvelope({ ...input, localRevision: input.baseRevision }, key)).toEqual({ ok: false, reason: 'invalid-revisions' })
    expect(await createSyncEnvelope({ ...input, mutationId: '../mutation' }, key)).toEqual({ ok: false, reason: 'invalid-metadata' })
    expect(await createSyncEnvelope({ ...input, expiresAt: '2027-08-08T08:00:00.000Z' }, key)).toEqual({ ok: false, reason: 'invalid-time-window' })
    const created = await createSyncEnvelope(input, key)
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(await openSyncEnvelope(created.envelope, key, { planId: input.planId, householdId: input.householdId, deviceId: input.deviceId }, '2026-08-09T08:00:00.000Z')).toEqual({ ok: false, reason: 'expired' })
  })
})
