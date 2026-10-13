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

export function saveAdShieldStore(store: StoredAdShield): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AD_SHIELD_STORAGE_KEY, JSON.stringify(store))
}

export function clearAdShieldStore(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AD_SHIELD_STORAGE_KEY)
  window.dispatchEvent(new Event('cleanstream-adshield-reset'))
}
