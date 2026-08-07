import { describe, expect, it } from 'vitest'
import { decryptBackup, encryptBackup, isEncryptedBackup } from './backupVault'

describe('encrypted local backups', () => {
  it('round-trips a Unicode backup without exposing plaintext', async () => {
    const plaintext = JSON.stringify({ format: 'flow-wealth-backup', note: 'แผนเกษียณ' })
    const encrypted = await encryptBackup(plaintext, 'correct horse battery staple')
    expect(isEncryptedBackup(encrypted)).toBe(true)
    expect(encrypted).not.toContain('แผนเกษียณ')
    await expect(decryptBackup(encrypted, 'correct horse battery staple')).resolves.toBe(plaintext)
  })

  it('rejects weak or incorrect passphrases and unsupported input', async () => {
    await expect(encryptBackup('{}', 'short')).rejects.toThrow('passphrase-too-short')
    const encrypted = await encryptBackup('{}', 'correct horse battery staple')
    await expect(decryptBackup(encrypted, 'different passphrase')).rejects.toThrow('decrypt-failed')
    await expect(decryptBackup('{}', 'correct horse battery staple')).rejects.toThrow('unsupported-envelope')
  })
})
