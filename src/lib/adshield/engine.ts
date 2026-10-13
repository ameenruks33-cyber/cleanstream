import { AD_HOSTS, FILTER_LIST_URLS, PROTECTED_HOSTS, TRACKER_HOSTS } from './hosts.ts'
import type {
  AdShieldSettings,
  FilterDecision,
  FilterEvent,
  FilterListUpdateResult,
  RequestContext,
} from './types.ts'

export const AD_SHIELD_STORAGE_KEY = 'cleanstream.adshield.v1'
export const FILTER_EVENTS_MAX = 50
export const FILTER_LIST_MAX_BYTES = 2_000_000

export const defaultAdShieldSettings: AdShieldSettings = {
  enabled: true,
  blockThirdPartyAds: true,
  trackingProtection: true,
  allowlist: [],
  denylist: [],
}

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

export function validateDomain(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0] ?? ''
  if (!value) return { ok: false, error: 'Enter a domain such as ads.example.com.' }
  if (value === 'localhost') return { ok: true, value }
  if (value.includes(':') || value.includes(' ') || value.includes('*')) {
    return { ok: false, error: 'Use a hostname only — no ports, wildcards, or paths.' }
  }
  if (!DOMAIN_RE.test(value)) {
    return { ok: false, error: `"${raw.trim()}" is not a valid domain.` }
  }
  return { ok: true, value }
}

export function parseDomainList(raw: string): { domains: string[]; errors: string[] } {
  const domains: string[] = []
  const errors: string[] = []
  const seen = new Set<string>()
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const parsed = validateDomain(trimmed)
    if (!parsed.ok) {
      errors.push(parsed.error)
      continue
    }
    if (seen.has(parsed.value)) continue
    seen.add(parsed.value)
    domains.push(parsed.value)
  }
  return { domains, errors }
}

export function hostMatches(hostname: string, rule: string): boolean {
  const host = hostname.toLowerCase()
  const needle = rule.toLowerCase()
  return host === needle || host.endsWith(`.${needle}`)
}

export function isProtectedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  return PROTECTED_HOSTS.some((rule) => hostMatches(host, rule))
}

function isYoutubePlayerContext(context: RequestContext = {}): boolean {
  for (const candidate of [context.referrer, context.initiator]) {
    if (!candidate) continue
    try {
      const host = new URL(candidate).hostname
      if (
        hostMatches(host, 'youtube.com') ||
        hostMatches(host, 'youtube-nocookie.com') ||
        hostMatches(host, 'youtu.be') ||
        hostMatches(host, 'googlevideo.com')
      ) {
        return true
      }
    } catch {
      /* ignore malformed referrers */
    }
  }
  return false
}

function classifyHost(hostname: string): 'ad' | 'tracker' | null {
  if (AD_HOSTS.some((rule) => hostMatches(hostname, rule))) return 'ad'
  if (TRACKER_HOSTS.some((rule) => hostMatches(hostname, rule))) return 'tracker'
  return null
}

export function resolveRequestUrl(raw: string, base = 'http://127.0.0.1:5173'): URL | null {
  try {
    return new URL(raw, base)
  } catch {
    return null
  }
}

export function isRequiredAppRequest(url: URL): boolean {
  if (url.protocol === 'blob:' || url.protocol === 'data:') return true
  const host = url.hostname
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  if (url.pathname.startsWith('/api/')) return true
  return isProtectedHost(host)
}

export function evaluateRequest(
  rawUrl: string,
  settings: AdShieldSettings,
  context: RequestContext = {},
  base?: string,
): FilterDecision {
  if (!settings.enabled) return { block: false }

  const url = resolveRequestUrl(rawUrl, base)
  if (!url) return { block: false }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { block: false }

  if (isRequiredAppRequest(url) || isProtectedHost(url.hostname)) {
    return { block: false }
  }

  if (isYoutubePlayerContext(context)) {
    return { block: false }
  }

  if (settings.allowlist.some((rule) => hostMatches(url.hostname, rule))) {
    return { block: false }
  }

  if (settings.denylist.some((rule) => hostMatches(url.hostname, rule))) {
    return { block: true, reason: 'denylist', estimate: true }
  }

  const kind = classifyHost(url.hostname)
  if (kind === 'ad' && settings.blockThirdPartyAds) {
    return { block: true, reason: 'ad', estimate: true }
  }
  if (kind === 'tracker' && settings.trackingProtection) {
    return { block: true, reason: 'tracker', estimate: true }
  }

  return { block: false }
}

export function parseHostFilterList(text: string): string[] {
  const hosts: string[] = []
  const seen = new Set<string>()
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) continue
    if (trimmed.includes('##') || trimmed.includes('#@#')) continue
    const match = trimmed.match(/^\|\|([a-z0-9.-]+)\^/i)
    if (!match?.[1]) continue
    const host = match[1].toLowerCase()
    if (isProtectedHost(host) || seen.has(host)) continue
    const parsed = validateDomain(host)
    if (!parsed.ok) continue
    seen.add(parsed.value)
    hosts.push(parsed.value)
  }
  return hosts
}

export async function updateFilterLists(
  fetchImpl: typeof fetch = fetch,
): Promise<FilterListUpdateResult> {
  const collected: string[] = []
  const seen = new Set<string>()
  let lastError = ''

  for (const source of FILTER_LIST_URLS) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      const response = await fetchImpl(source, {
        signal: controller.signal,
        redirect: 'error',
        headers: { Accept: 'text/plain' },
      })
      clearTimeout(timer)
      if (!response.ok) {
        lastError = `Filter list ${source} returned ${response.status}.`
        continue
      }
      const text = await response.text()
      if (text.length > FILTER_LIST_MAX_BYTES) {
        lastError = 'A filter list was larger than the 2 MB safety limit.'
        continue
      }
      for (const host of parseHostFilterList(text)) {
        if (seen.has(host)) continue
        seen.add(host)
        collected.push(host)
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Filter list download failed.'
    }
  }

  if (collected.length === 0) {
    return {
      ok: false,
      error: lastError || 'Filter lists could not be updated. Bundled rules are still in use.',
      hosts: [...AD_HOSTS, ...TRACKER_HOSTS],
    }
  }

  return { ok: true, hosts: collected, source: FILTER_LIST_URLS.join(', ') }
}

export function sanitizeSettings(input: Partial<AdShieldSettings> | null | undefined): AdShieldSettings {
  const allow = parseDomainList((input?.allowlist ?? []).join('\n'))
  const deny = parseDomainList((input?.denylist ?? []).join('\n'))
  return {
    enabled: input?.enabled !== false,
    blockThirdPartyAds: input?.blockThirdPartyAds !== false,
    trackingProtection: input?.trackingProtection !== false,
    allowlist: allow.domains,
    denylist: deny.domains,
  }
}

export function createFilterEvent(url: string, reason: FilterEvent['reason'], at = new Date().toISOString()): FilterEvent {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    at,
    url,
    reason,
    blocked: true,
  }
}

export function appendFilterEvent(events: FilterEvent[], event: FilterEvent): FilterEvent[] {
  return [event, ...events].slice(0, FILTER_EVENTS_MAX)
}

export function isAllowedAppNavigation(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol === 'file:') return true
    const host = url.hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

export function isTrustedExternalLink(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    return (
      hostMatches(url.hostname, 'youtube.com') ||
      hostMatches(url.hostname, 'youtu.be') ||
      hostMatches(url.hostname, 'google.com') ||
      hostMatches(url.hostname, 'supabase.com')
    )
  } catch {
    return false
  }
}
