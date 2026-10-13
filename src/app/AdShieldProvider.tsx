import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { appendFilterEvent, createFilterEvent, evaluateRequest } from '@/lib/adshield/engine'
import {
  clearAdShieldStore,
  emptyAdShieldStore,
  loadAdShieldStore,
  saveAdShieldStore,
  type StoredAdShield,
} from '@/lib/adshield/storage'
import type { AdShieldSettings, FilterEvent } from '@/lib/adshield/types'

type AdShieldContextValue = {
  settings: AdShieldSettings
  blockedEstimate: number
  events: FilterEvent[]
  desktop: boolean
  updateSettings: (patch: Partial<AdShieldSettings>) => void
  setDomainLists: (allowlist: string[], denylist: string[]) => void
  clearEvents: () => void
  reset: () => void
}

const AdShieldContext = createContext<AdShieldContextValue | null>(null)

function syncDesktop(settings: AdShieldSettings) {
  const desktop = window.cleanstream?.adShield
  if (!desktop) return
  void desktop.syncSettings(settings)
}

export function AdShieldProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<StoredAdShield>(() => loadAdShieldStore())
  const storeRef = useRef(store)
  storeRef.current = store

  useEffect(() => {
    saveAdShieldStore(store)
    syncDesktop(store.settings)
  }, [store])

  useEffect(() => {
    function onReset() {
      setStore(emptyAdShieldStore())
    }
    window.addEventListener('cleanstream-adshield-reset', onReset)
    return () => window.removeEventListener('cleanstream-adshield-reset', onReset)
  }, [])

  useEffect(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const decision = evaluateRequest(raw, storeRef.current.settings, { referrer: window.location.href })
      if (decision.block && decision.reason) {
        const event = createFilterEvent(raw, decision.reason)
        setStore((current) => ({
          ...current,
          blockedEstimate: current.blockedEstimate + 1,
          events: appendFilterEvent(current.events, event),
        }))
        return new Response(null, { status: 451, statusText: 'Blocked by CleanStream Ad Shield' })
      }
      return originalFetch(input, init)
    }

    const originalBeacon = navigator.sendBeacon?.bind(navigator)
    if (originalBeacon) {
      navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
        const raw = String(url)
        const decision = evaluateRequest(raw, storeRef.current.settings, { referrer: window.location.href })
        if (decision.block) return false
        return originalBeacon(url, data)
      }
    }

    return () => {
      window.fetch = originalFetch
      if (originalBeacon) navigator.sendBeacon = originalBeacon
    }
  }, [])

  const updateSettings = useCallback((patch: Partial<AdShieldSettings>) => {
    setStore((current) => ({ ...current, settings: { ...current.settings, ...patch } }))
  }, [])

  const setDomainLists = useCallback((allowlist: string[], denylist: string[]) => {
    setStore((current) => ({ ...current, settings: { ...current.settings, allowlist, denylist } }))
  }, [])

  const clearEvents = useCallback(() => {
    setStore((current) => ({ ...current, events: [], blockedEstimate: 0 }))
  }, [])

  const reset = useCallback(() => {
    clearAdShieldStore()
    setStore(emptyAdShieldStore())
  }, [])

  const value = useMemo<AdShieldContextValue>(
    () => ({
      settings: store.settings,
      blockedEstimate: store.blockedEstimate,
      events: store.events,
      desktop: Boolean(window.cleanstream?.desktop),
      updateSettings,
      setDomainLists,
      clearEvents,
      reset,
    }),
    [store, updateSettings, setDomainLists, clearEvents, reset],
  )

  return <AdShieldContext.Provider value={value}>{children}</AdShieldContext.Provider>
}

export function useAdShield(): AdShieldContextValue {
  const context = useContext(AdShieldContext)
  if (!context) throw new Error('useAdShield must be used inside AdShieldProvider')
  return context
}

