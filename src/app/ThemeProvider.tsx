import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useLibrary } from '@/app/LibraryProvider'

type ThemeContextValue = {
  theme: 'dark' | 'light'
  mode: 'dark' | 'light' | 'system'
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', mode: 'dark' })

function resolveTheme(mode: 'dark' | 'light' | 'system'): 'dark' | 'light' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return mode
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { state } = useLibrary()
  const theme = typeof window === 'undefined' ? 'dark' : resolveTheme(state.preferences.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
    document.documentElement.style.colorScheme = theme
    document.documentElement.dataset.theme = theme
    document.documentElement.classList.toggle('reduce-motion', state.preferences.reducedMotion)
  }, [theme, state.preferences.reducedMotion])

  const value = useMemo(
    () => ({ theme, mode: state.preferences.theme }),
    [theme, state.preferences.theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
