import { useEffect, type ReactNode } from 'react'
import { isStandaloneDisplay } from '@/lib/pwa'

export function NativeApp({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      root.classList.toggle('app-native', isStandaloneDisplay())
    }
    apply()
    const media = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)')
    media.addEventListener('change', apply)
    window.addEventListener('appinstalled', apply)
    return () => {
      media.removeEventListener('change', apply)
      window.removeEventListener('appinstalled', apply)
    }
  }, [])

  return children
}
