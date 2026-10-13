import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defaultAdShieldSettings,
  evaluateRequest,
  isAllowedAppNavigation,
  isProtectedHost,
  isTrustedExternalLink,
  parseDomainList,
  parseHostFilterList,
  sanitizeSettings,
  updateFilterLists,
  validateDomain,
} from '@/lib/adshield/engine'
import { emptyAdShieldStore, parseAdShieldStore } from '@/lib/adshield/storage'

const require = createRequire(import.meta.url)
const electronCore = require('../../electron/adshield-core.cjs') as {
  shouldBlockRequest: (
    url: string,
    settings: typeof defaultAdShieldSettings,
    details?: { referrer?: string },
  ) => { block: boolean; reason?: string }
  isAllowedAppNavigation: (url: string) => boolean
  isTrustedExternalLink: (url: string) => boolean
  parseHostFilterList: (text: string) => string[]
  downloadFilterLists: (fetchImpl: typeof fetch) => Promise<{ ok: boolean; error?: string; hosts: string[] }>
  validateDomain: (raw: string) => { ok: boolean }
}

const on = defaultAdShieldSettings

describe('Ad Shield preferences', () => {
  it('enables protection by default and can be turned off', () => {
    expect(on.enabled).toBe(true)
    const off = sanitizeSettings({ enabled: false })
    expect(off.enabled).toBe(false)
    expect(evaluateRequest('https://doubleclick.net/ad.js', off).block).toBe(false)
    expect(evaluateRequest('https://doubleclick.net/ad.js', on).block).toBe(true)
  })

  it('saves and resets stored preferences', () => {
    const stored = parseAdShieldStore(
      JSON.stringify({
        settings: { enabled: false, allowlist: ['cdn.example.com'], denylist: ['ads.evil.test'] },
        blockedEstimate: 4,
        events: [],
      }),
    )
    expect(stored.settings.enabled).toBe(false)
    expect(stored.settings.allowlist).toEqual(['cdn.example.com'])
    expect(emptyAdShieldStore().settings.enabled).toBe(true)
    expect(emptyAdShieldStore().blockedEstimate).toBe(0)
  })
})

describe('allowlist and denylist validation', () => {
  it('accepts hostnames and rejects unsafe rules', () => {
    expect(validateDomain('ads.partner.net').ok).toBe(true)
    expect(validateDomain('https://ads.partner.net/path').ok).toBe(true)
    expect(validateDomain('ads.partner.net:443').ok).toBe(false)
    expect(validateDomain('*.ads.net').ok).toBe(false)
    expect(validateDomain('not a domain').ok).toBe(false)
    const parsed = parseDomainList('ads.ok.test\n\n# comment\nbad domain')
    expect(parsed.domains).toEqual(['ads.ok.test'])
    expect(parsed.errors.length).toBeGreaterThan(0)
  })
})

describe('required requests stay functional', () => {
  it('never blocks app APIs, captions, licensed media, or YouTube player origins', () => {
    const denyAll = sanitizeSettings({ denylist: ['127.0.0.1', 'youtube.com', 'commondatastorage.googleapis.com'] })
    expect(evaluateRequest('/api/health', denyAll).block).toBe(false)
    expect(evaluateRequest('/api/youtube/search?q=varkala', denyAll).block).toBe(false)
    expect(evaluateRequest('http://127.0.0.1:8787/api/library', denyAll).block).toBe(false)
    expect(evaluateRequest('https://www.youtube.com/embed/dQw4w9WgXcQ', on).block).toBe(false)
    expect(evaluateRequest('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', on).block).toBe(false)
    expect(evaluateRequest('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', on).block).toBe(false)
    expect(isProtectedHost('www.youtube-nocookie.com')).toBe(true)
  })

  it('does not intercept YouTube player advertisement hosts when the player is the referrer', () => {
    const decision = evaluateRequest('https://googleads.g.doubleclick.net/pagead/ads', on, {
      referrer: 'https://www.youtube.com/embed/k_ufLLasmRY',
    })
    expect(decision.block).toBe(false)
  })
})

describe('filter-list updates', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses host rules and ignores element hiding and YouTube origins', () => {
    const hosts = parseHostFilterList(`
! comment
||tracker.example^
||youtube.com^
##.ytp-ad-module
||ads.network.test^$third-party
`)
    expect(hosts).toContain('tracker.example')
    expect(hosts).toContain('ads.network.test')
    expect(hosts).not.toContain('youtube.com')
  })

  it('keeps bundled hosts when a filter-list download fails', async () => {
    const result = await updateFilterLists(async () => {
      throw new Error('network down')
    })
    expect(result.ok).toBe(false)
    expect(result.hosts.length).toBeGreaterThan(0)
    expect(result.error).toMatch(/network down|could not/i)
  })
})

describe('Electron navigation and renderer security helpers', () => {
  it('allows only the app origin to navigate in-window', () => {
    expect(isAllowedAppNavigation('http://localhost:5173/search')).toBe(true)
    expect(isAllowedAppNavigation('http://127.0.0.1:8787/')).toBe(true)
    expect(isAllowedAppNavigation('https://evil.example/phish')).toBe(false)
    expect(electronCore.isAllowedAppNavigation('http://localhost:5173/')).toBe(true)
    expect(electronCore.isAllowedAppNavigation('https://doubleclick.net')).toBe(false)
  })

  it('opens trusted https links externally and blocks random remote content', () => {
    expect(isTrustedExternalLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(isTrustedExternalLink('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false)
    expect(electronCore.isTrustedExternalLink('https://evil.example')).toBe(false)
  })

  it('mirrors request filtering in the desktop adapter', () => {
    expect(electronCore.shouldBlockRequest('https://doubleclick.net/ad', on).block).toBe(true)
    expect(
      electronCore.shouldBlockRequest('https://doubleclick.net/ad', on, {
        referrer: 'https://www.youtube.com/embed/abc',
      }).block,
    ).toBe(false)
    expect(electronCore.shouldBlockRequest('https://www.youtube.com/embed/abc', on).block).toBe(false)
  })

  it('handles filter-list update errors in the desktop adapter', async () => {
    const result = await electronCore.downloadFilterLists(async () => {
      throw new Error('timeout')
    })
    expect(result.ok).toBe(false)
    expect(result.hosts.length).toBeGreaterThan(0)
  })
})
