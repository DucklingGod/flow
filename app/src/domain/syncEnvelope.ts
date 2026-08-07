import { planSectionIds, type PlanSectionId } from './planConflict'

export const SYNC_ENVELOPE_PROTOCOL_VERSION = 1
export const MAX_SYNC_PLAINTEXT_BYTES = 2 * 1024 * 1024
export const MAX_SYNC_ENVELOPE_AGE_MS = 7 * 24 * 60 * 60 * 1_000

const tokenPattern = /^[a-zA-Z0-9._:-]+$/
const digestPattern = /^[a-f0-9]{64}$/
const allowedSections = new Set<string>(planSectionIds)

export interface SyncEnvelopeMetadata {
  protocolVersion: typeof SYNC_ENVELOPE_PROTOCOL_VERSION
  mutationId: string
  planId: string
  householdId: string
  deviceId: string
  keyId: string
  baseRevision: number
  localRevision: number
  baseDigest: string
  localDigest: string
  sectionIds: readonly PlanSectionId[]
  createdAt: string
  expiresAt: string
  plaintextBytes: number
}

export interface EncryptedSyncEnvelope extends SyncEnvelopeMetadata {
  algorithm: 'AES-GCM-256'
  iv: string
  ciphertext: string
  ciphertextBytes: number
  ciphertextSha256: string
}

export interface CreateSyncEnvelopeInput {
  mutationId: string
  planId: string
  householdId: string
  deviceId: string
  keyId: string
  baseRevision: number
  localRevision: number
  baseDigest: string
  sectionIds: readonly PlanSectionId[]
  createdAt: string
  expiresAt: string
  plaintext: string
}

export type CreateSyncEnvelopeResult =
  | { ok: true; envelope: EncryptedSyncEnvelope }
  | { ok: false; reason: 'invalid-metadata' | 'invalid-revisions' | 'invalid-time-window' | 'invalid-payload' | 'invalid-key' | 'crypto-failure' }

export type OpenSyncEnvelopeResult =
  | { ok: true; plaintext: string; envelope: EncryptedSyncEnvelope }
  | { ok: false; reason: 'invalid-envelope' | 'binding-mismatch' | 'expired' | 'invalid-key' | 'integrity-failure' | 'invalid-plaintext' }

const validToken = (value: string, minimum = 1) => value.length >= minimum && value.length <= 128 && tokenPattern.test(value)
const parsedTime = (value: string) => {
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}

function validSections(value: readonly string[]): value is readonly PlanSectionId[] {
  return value.length > 0
    && value.length <= planSectionIds.length
    && new Set(value).size === value.length
    && value.every((section) => allowedSections.has(section))
}

function validKey(key: CryptoKey, usage: KeyUsage) {
  return key.type === 'secret'
    && key.algorithm.name === 'AES-GCM'
    && key.usages.includes(usage)
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 32_768
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  return btoa(binary)
}

function base64ToBytes(value: string, maximumBytes = MAX_SYNC_PLAINTEXT_BYTES + 32) {
  if (!value || value.length > Math.ceil(maximumBytes / 3) * 4 + 4 || value.length % 4 !== 0 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(value)) return null
  try {
    const binary = atob(value)
    if (binary.length > maximumBytes) return null
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch { return null }
}

async function sha256(bytes: Uint8Array) {
  const owned = new Uint8Array(bytes.byteLength)
  owned.set(bytes)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', owned))
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function additionalData(metadata: SyncEnvelopeMetadata) {
  return new TextEncoder().encode(JSON.stringify({
    protocolVersion: metadata.protocolVersion,
    mutationId: metadata.mutationId,
    planId: metadata.planId,
    householdId: metadata.householdId,
    deviceId: metadata.deviceId,
    keyId: metadata.keyId,
    baseRevision: metadata.baseRevision,
    localRevision: metadata.localRevision,
    baseDigest: metadata.baseDigest,
    localDigest: metadata.localDigest,
    sectionIds: metadata.sectionIds,
    createdAt: metadata.createdAt,
    expiresAt: metadata.expiresAt,
    plaintextBytes: metadata.plaintextBytes,
  }))
}

function validateMetadata(metadata: SyncEnvelopeMetadata) {
  if (metadata.protocolVersion !== SYNC_ENVELOPE_PROTOCOL_VERSION) return 'invalid-metadata' as const
  if (![metadata.mutationId, metadata.planId, metadata.householdId, metadata.deviceId].every((value) => validToken(value)) || !validToken(metadata.keyId, 8)) return 'invalid-metadata' as const
  if (!digestPattern.test(metadata.baseDigest) || !digestPattern.test(metadata.localDigest) || !validSections(metadata.sectionIds)) return 'invalid-metadata' as const
  if (!Number.isSafeInteger(metadata.baseRevision) || metadata.baseRevision < 0 || !Number.isSafeInteger(metadata.localRevision) || metadata.localRevision <= metadata.baseRevision) return 'invalid-revisions' as const
  if (!Number.isSafeInteger(metadata.plaintextBytes) || metadata.plaintextBytes < 1 || metadata.plaintextBytes > MAX_SYNC_PLAINTEXT_BYTES) return 'invalid-payload' as const
  const created = parsedTime(metadata.createdAt)
  const expires = parsedTime(metadata.expiresAt)
  if (created === null || expires === null || expires <= created || expires - created > MAX_SYNC_ENVELOPE_AGE_MS) return 'invalid-time-window' as const
  return null
}

export function validateSyncEnvelopeStructure(envelope: EncryptedSyncEnvelope) {
  if (validateMetadata(envelope) || envelope.algorithm !== 'AES-GCM-256' || !digestPattern.test(envelope.ciphertextSha256)) return false
  const iv = base64ToBytes(envelope.iv, 12)
  const ciphertext = base64ToBytes(envelope.ciphertext, MAX_SYNC_PLAINTEXT_BYTES + 16)
  return Boolean(iv
    && iv.byteLength === 12
    && ciphertext
    && ciphertext.byteLength === envelope.ciphertextBytes
    && ciphertext.byteLength === envelope.plaintextBytes + 16)
}

export async function generateSyncEncryptionKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function createSyncEnvelope(input: CreateSyncEnvelopeInput, key: CryptoKey): Promise<CreateSyncEnvelopeResult> {
  if (!validKey(key, 'encrypt')) return { ok: false, reason: 'invalid-key' }
  const plaintext = new TextEncoder().encode(input.plaintext)
  const localDigest = await sha256(plaintext)
  const metadata: SyncEnvelopeMetadata = {
    protocolVersion: SYNC_ENVELOPE_PROTOCOL_VERSION,
    mutationId: input.mutationId,
    planId: input.planId,
    householdId: input.householdId,
    deviceId: input.deviceId,
    keyId: input.keyId,
    baseRevision: input.baseRevision,
    localRevision: input.localRevision,
    baseDigest: input.baseDigest,
    localDigest,
    sectionIds: [...input.sectionIds],
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    plaintextBytes: plaintext.byteLength,
  }
  const invalid = validateMetadata(metadata)
  if (invalid) return { ok: false, reason: invalid }
  const iv = crypto.getRandomValues(new Uint8Array(12))
  try {
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: additionalData(metadata), tagLength: 128 }, key, plaintext))
    return {
      ok: true,
      envelope: {
        ...metadata,
        algorithm: 'AES-GCM-256',
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(ciphertext),
        ciphertextBytes: ciphertext.byteLength,
        ciphertextSha256: await sha256(ciphertext),
      },
    }
  } catch { return { ok: false, reason: 'crypto-failure' } }
}

export async function openSyncEnvelope(
  envelope: EncryptedSyncEnvelope,
  key: CryptoKey,
  expected: { planId: string; householdId: string; deviceId: string },
  now = new Date().toISOString(),
): Promise<OpenSyncEnvelopeResult> {
  if (!validKey(key, 'decrypt')) return { ok: false, reason: 'invalid-key' }
  if (!validateSyncEnvelopeStructure(envelope)) return { ok: false, reason: 'invalid-envelope' }
  if (envelope.planId !== expected.planId || envelope.householdId !== expected.householdId || envelope.deviceId !== expected.deviceId) return { ok: false, reason: 'binding-mismatch' }
  const current = parsedTime(now)
  const created = parsedTime(envelope.createdAt) as number
  const expires = parsedTime(envelope.expiresAt) as number
  if (current === null || current < created - 60_000 || current > expires) return { ok: false, reason: 'expired' }
  const iv = base64ToBytes(envelope.iv, 12)
  const ciphertext = base64ToBytes(envelope.ciphertext, MAX_SYNC_PLAINTEXT_BYTES + 16)
  if (!iv || iv.byteLength !== 12 || !ciphertext || ciphertext.byteLength !== envelope.ciphertextBytes || ciphertext.byteLength !== envelope.plaintextBytes + 16) return { ok: false, reason: 'invalid-envelope' }
  if (await sha256(ciphertext) !== envelope.ciphertextSha256) return { ok: false, reason: 'integrity-failure' }
  try {
    const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: additionalData(envelope), tagLength: 128 }, key, ciphertext))
    if (plaintext.byteLength !== envelope.plaintextBytes || await sha256(plaintext) !== envelope.localDigest) return { ok: false, reason: 'integrity-failure' }
    return { ok: true, plaintext: new TextDecoder('utf-8', { fatal: true }).decode(plaintext), envelope }
  } catch { return { ok: false, reason: 'integrity-failure' } }
}
