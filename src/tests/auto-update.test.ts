import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkPublishedVersion, shouldReloadForVersion, VERSION_STORAGE_KEY } from '@/lib/autoUpdate'

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('auto update', () => {
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
    expect(sessionStorage.getItem(VERSION_STORAGE_KEY)).toBe('v1')
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads when version.json changes', async () => {
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
})
