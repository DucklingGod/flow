import { describe, expect, it } from 'vitest'
import { decryptLocalReference, encryptLocalReference, isEncryptedReference } from './documentVault'

describe('local document reference vault', () => {
  it('encrypts and decrypts a Unicode reference without storing plaintext', async () => {
    const reference = 'ตู้เอกสาร A / แฟ้มกรมธรรม์ 02'
    const encrypted = await encryptLocalReference(reference, 'long-passphrase')
    expect(isEncryptedReference(encrypted)).toBe(true)
    expect(encrypted).not.toContain(reference)
    await expect(decryptLocalReference(encrypted, 'long-passphrase')).resolves.toBe(reference)
  })

  it('rejects a wrong passphrase and weak passphrases', async () => {
    await expect(encryptLocalReference('cabinet-a', 'short')).rejects.toThrow('passphrase-too-short')
    const encrypted = await encryptLocalReference('cabinet-a', 'correct-passphrase')
    await expect(decryptLocalReference(encrypted, 'wrong-passphrase')).rejects.toThrow('decrypt-failed')
  })
})
