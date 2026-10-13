import { deleteVaultRecord, readVaultRecord, writeVaultRecord } from '@/lib/cryptoVault'
import { AD_SHIELD_STORAGE_KEY, defaultAdShieldSettings, sanitizeSettings } from './engine.ts'
import type { AdShieldSettings, FilterEvent } from './types.ts'

export type StoredAdShield = {
  settings: AdShieldSettings
  blockedEstimate: number
  events: FilterEvent[]
}

export function emptyAdShieldStore(): StoredAdShield {
  return {
    settings: { ...defaultAdShieldSettings, allowlist: [], denylist: [] },
    blockedEstimate: 0,
    events: [],
  }
}

export function parseAdShieldStore(raw: string | null): StoredAdShield {
  const empty = emptyAdShieldStore()
  if (!raw) return empty
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAdShield>
    return {
      settings: sanitizeSettings(parsed.settings),
      blockedEstimate: typeof parsed.blockedEstimate === 'number' && parsed.blockedEstimate >= 0 ? parsed.blockedEstimate : 0,
      events: Array.isArray(parsed.events) ? parsed.events.slice(0, 50) : [],
    }
  } catch {
    return empty
  }
}

export function loadAdShieldStore(): StoredAdShield {
  if (typeof window === 'undefined') return emptyAdShieldStore()
  return parseAdShieldStore(window.localStorage.getItem(AD_SHIELD_STORAGE_KEY))
}

export async function loadEncryptedAdShieldStore(): Promise<{ store: StoredAdShield; found: boolean }> {
  try {
    const vaulted = await readVaultRecord('adshield')
    if (vaulted) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(AD_SHIELD_STORAGE_KEY)
      return { store: parseAdShieldStore(vaulted), found: true }
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) throw error
  }
  if (typeof localStorage === 'undefined') return { store: emptyAdShieldStore(), found: false }
  const legacy = localStorage.getItem(AD_SHIELD_STORAGE_KEY)
  if (!legacy) return { store: emptyAdShieldStore(), found: false }
  const parsed = parseAdShieldStore(legacy)
  await writeVaultRecord('adshield', JSON.stringify(parsed))
  localStorage.removeItem(AD_SHIELD_STORAGE_KEY)
  return { store: parsed, found: true }
}

export function saveAdShieldStore(store: StoredAdShield): void {
  if (typeof window === 'undefined') return
  void writeVaultRecord('adshield', JSON.stringify(store))
  window.localStorage.removeItem(AD_SHIELD_STORAGE_KEY)
}

export function clearAdShieldStore(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AD_SHIELD_STORAGE_KEY)
  void deleteVaultRecord('adshield')
  window.dispatchEvent(new Event('cleanstream-adshield-reset'))
}
