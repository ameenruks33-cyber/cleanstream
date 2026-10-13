import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkPublishedVersion, shouldReloadForVersion, VERSION_STORAGE_KEY } from '@/lib/autoUpdate'
import { shouldShowUpdateNotification } from '@/lib/deviceUpdates'

afterEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('auto update', () => {
  it('notifies installed devices when a service worker replaces a previous one', () => {
    expect(shouldShowUpdateNotification(null, 'v2', true)).toBe(true)
    expect(shouldShowUpdateNotification('v1', 'v2', false)).toBe(true)
    expect(shouldShowUpdateNotification(null, 'v1', false)).toBe(false)
    expect(shouldShowUpdateNotification('v1', 'v1', true)).toBe(false)
    expect(shouldShowUpdateNotification('111', '1791914614428', true)).toBe(true)
  })

  it('reloads only when a new published version appears', () => {
    expect(shouldReloadForVersion(null, 'abc')).toBe(false)
    expect(shouldReloadForVersion('abc', 'abc')).toBe(false)
    expect(shouldReloadForVersion('abc', undefined)).toBe(false)
    expect(shouldReloadForVersion('abc', 'def')).toBe(true)
  })

  it('stores the first published version without reloading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: 'v1' }),
      }),
    )
    const reload = vi.fn()
    await checkPublishedVersion(reload)
    expect(localStorage.getItem(VERSION_STORAGE_KEY)).toBe('v1')
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads when a previous sessionStorage version is still present', async () => {
    sessionStorage.setItem(VERSION_STORAGE_KEY, 'v1')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: 'v2' }),
      }),
    )
    const reload = vi.fn()
    await checkPublishedVersion(reload)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads when version.json changes', async () => {
    localStorage.setItem(VERSION_STORAGE_KEY, 'v1')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: 'v2' }),
      }),
    )
    const reload = vi.fn()
    await checkPublishedVersion(reload)
    expect(reload).toHaveBeenCalledOnce()
  })
})
