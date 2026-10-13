import { afterEach, describe, expect, it } from 'vitest'
import {
  decryptString,
  encryptString,
  protectVaultWithPassphrase,
  readVaultRecord,
  resetVaultMemory,
  unlockVault,
  wipeVault,
  writeVaultRecord,
} from '@/lib/cryptoVault'

afterEach(async () => {
  await wipeVault()
  resetVaultMemory()
})

describe('AES-256-GCM vault', () => {
  it('round-trips plaintext and rejects a wrong passphrase', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const payload = await encryptString(key, 'secret-library')
    expect(payload.startsWith('cs1.')).toBe(true)
    expect(payload.includes('secret-library')).toBe(false)
    expect(await decryptString(key, payload)).toBe('secret-library')

    await writeVaultRecord('library', '{"favorites":[]}')
    expect(await readVaultRecord('library')).toBe('{"favorites":[]}')

    await protectVaultWithPassphrase('correct horse')
    resetVaultMemory()
    await expect(unlockVault('wrong passphrase')).rejects.toThrow(/does not unlock/)
    await unlockVault('correct horse')
    expect(await readVaultRecord('library')).toBe('{"favorites":[]}')
  })
})
