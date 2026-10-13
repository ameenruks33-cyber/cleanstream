import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { exitElementFullscreen, lockLandscape, requestElementFullscreen, unlockOrientation } from '@/lib/displayMode'

type ImmersiveContextValue = {
  active: boolean
  enter: (node?: Element | null) => Promise<void>
  exit: () => Promise<void>
}

const ImmersiveContext = createContext<ImmersiveContextValue | null>(null)

export function ImmersiveProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const lastNode = useRef<Element | null>(null)

  const enter = useCallback(async (node?: Element | null) => {
    lastNode.current = node ?? lastNode.current
    setActive(true)
    document.documentElement.classList.add('app-immersive')
    await requestElementFullscreen(lastNode.current ?? document.documentElement)
    await lockLandscape()
  }, [])

  const exit = useCallback(async () => {
    setActive(false)
    document.documentElement.classList.remove('app-immersive')
    await unlockOrientation()
    await exitElementFullscreen()
  }, [])

  const value = useMemo(() => ({ active, enter, exit }), [active, enter, exit])
  return <ImmersiveContext.Provider value={value}>{children}</ImmersiveContext.Provider>
}

export function useImmersive(): ImmersiveContextValue {
  const value = useContext(ImmersiveContext)
  if (!value) {
    return {
      active: false,
      enter: async () => undefined,
      exit: async () => undefined,
    }
  }
  return value
}
