import { useEffect, useRef, useState, type ReactNode } from 'react'
import { APP_NAME, BrandLogo, WaveLine, WaveName } from '@/components/Brand'
import { Button } from '@/components/Button'
import { isDesktopElectron, isIosDevice, isStandaloneDisplay } from '@/lib/pwa'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const SKIP_KEY = 'cleanstream-continue-browser'

export function InstallGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => shouldSkipInstaller())
  const [prompting, setPrompting] = useState(false)
  const [ios, setIos] = useState(false)
  const deferred = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (shouldSkipInstaller()) {
      setReady(true)
      return
    }
    setIos(isIosDevice())

    const onPrompt = (event: Event) => {
      event.preventDefault()
      const installEvent = event as BeforeInstallPromptEvent
      deferred.current = installEvent
      void autoInstall(installEvent)
    }
    const onInstalled = () => setReady(true)

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function autoInstall(event: BeforeInstallPromptEvent) {
    setPrompting(true)
    try {
      await event.prompt()
      const choice = await event.userChoice
      if (choice.outcome === 'accepted') setReady(true)
    } catch {
      /* Browser blocked the automatic prompt; the Install button remains. */
    } finally {
      setPrompting(false)
    }
  }

  async function installNow() {
    if (deferred.current) {
      await autoInstall(deferred.current)
      return
    }
    setPrompting(true)
  }

  function continueInBrowser() {
    sessionStorage.setItem(SKIP_KEY, '1')
    setReady(true)
  }

  if (ready) return children

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-ink">
      <div className="w-full max-w-md rounded-[2rem] border border-line bg-panel p-8 text-center shadow-2xl">
        <BrandLogo className="mx-auto h-36 w-36" />
        <p className="mt-6 text-xs uppercase tracking-[0.22em] text-muted">Install on this device</p>
        <WaveName as="h1" className="mt-3 justify-center text-4xl" />
        <WaveLine className="mx-auto mt-2 w-40" />
        <p className="mt-3 text-sm leading-7 text-muted">
          Install {APP_NAME} on this phone or tablet. After that it opens from your home screen as its own app — not
          inside Chrome or Safari. Search any video in the world. YouTube still uses the official player.
        </p>
        {ios ? (
          <p className="mt-4 rounded-2xl bg-raised px-4 py-3 text-left text-sm leading-6 text-ink">
            On iPhone or iPad: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. That installs
            MyTube as an app. Safari cannot install automatically.
          </p>
        ) : (
          <Button className="mt-6 w-full" variant="primary" onClick={() => void installNow()} disabled={prompting}>
            {prompting ? 'Waiting for system installer…' : `Install ${APP_NAME}`}
          </Button>
        )}
        <Button className="mt-3 w-full" variant="ghost" onClick={continueInBrowser}>
          Continue in this browser
        </Button>
      </div>
    </div>
  )
}

function shouldSkipInstaller(): boolean {
  if (typeof window === 'undefined') return true
  if (isDesktopElectron() || isStandaloneDisplay()) return true
  return sessionStorage.getItem(SKIP_KEY) === '1'
}
