import { useState } from 'react'
import { useLibrary } from '@/app/LibraryProvider'
import { Button } from '@/components/Button'

export function ConsentBanner() {
  const { state, updatePreferences } = useLibrary()
  const [hidden, setHidden] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.sessionStorage.getItem('cleanstream.consent.hidden') === '1'
  })
  if (state.preferences.analyticsConsent || hidden) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-2xl rounded-2xl border border-line bg-panel/95 p-4 shadow-2xl backdrop-blur md:left-auto">
      <p className="text-sm leading-6 text-muted">
        CleanStream does not insert third-party ads and does not collect analytics unless you opt in. Watch history and
        lists stay on this device unless you sign in.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => {
            updatePreferences({ analyticsConsent: true })
            window.sessionStorage.setItem('cleanstream.consent.hidden', '1')
            setHidden(true)
          }}
        >
          Allow basic product metrics
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            window.sessionStorage.setItem('cleanstream.consent.hidden', '1')
            setHidden(true)
          }}
        >
          Keep local only
        </Button>
      </div>
    </div>
  )
}
