const encoder = new TextEncoder()
const decoder = new TextDecoder()
const PREFIX = 'flowref:v1'
const ITERATIONS = 210_000

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function deriveKey(passphrase: string, salt: Uint8Array, usage: KeyUsage[]) {
  const baseKey = await globalThis.crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  )
}

export function isEncryptedReference(value: string | null) {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`)
}

export async function encryptLocalReference(reference: string, passphrase: string) {
  if (!reference.trim()) throw new Error('reference-required')
  if (passphrase.length < 8) throw new Error('passphrase-too-short')
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, ['encrypt'])
  const ciphertext = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(reference.trim()))
  return `${PREFIX}:${toBase64(salt)}:${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`
}

export async function decryptLocalReference(envelope: string, passphrase: string) {
  if (!isEncryptedReference(envelope)) throw new Error('unsupported-envelope')
  if (passphrase.length < 8) throw new Error('passphrase-too-short')
  const [, version, saltText, ivText, cipherText] = envelope.split(':')
  if (version !== 'v1' || !saltText || !ivText || !cipherText) throw new Error('invalid-envelope')
  try {
    const salt = fromBase64(saltText)
    const iv = fromBase64(ivText)
    const key = await deriveKey(passphrase, salt, ['decrypt'])
    const plaintext = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromBase64(cipherText))
    return decoder.decode(plaintext)
  } catch {
    throw new Error('decrypt-failed')
  }
}
