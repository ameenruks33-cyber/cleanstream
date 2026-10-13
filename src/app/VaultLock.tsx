import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BrandMark } from '@/components/Brand'
import { Button } from '@/components/Button'
import { unlockVault, vaultStatus } from '@/lib/cryptoVault'

export function VaultLock({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'locked' | 'open'>('checking')
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void vaultStatus().then((next) => {
      if (cancelled) return
      setStatus(next === 'locked' ? 'locked' : 'open')
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function onUnlock(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await unlockVault(passphrase)
      setPassphrase('')
      setStatus('open')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlock the vault.')
    }
  }

  if (status === 'open') return children
  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-muted">
        Opening encrypted vault…
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-ink">
      <form
        onSubmit={(event) => void onUnlock(event)}
        className="w-full max-w-md rounded-[2rem] border border-line bg-panel p-8 shadow-2xl"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center">
          <BrandMark className="h-16 w-16" />
        </div>
        <p className="mt-6 text-center text-xs uppercase tracking-[0.22em] text-muted">Encrypted vault</p>
        <h1 className="mt-3 text-center font-display text-4xl">Unlock CleanStream</h1>
        <p className="mt-3 text-center text-sm leading-7 text-muted">
          Local favorites, history, and Ad Shield settings are encrypted with AES-256-GCM. Enter the passphrase for this
          device.
        </p>
        <label className="mt-6 block text-sm">
          <span className="sr-only">Vault passphrase</span>
          <input
            type="password"
            required
            minLength={8}
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-full border border-line bg-raised px-4 py-2.5 text-sm"
            placeholder="Passphrase"
          />
        </label>
        {error ? <p className="mt-3 text-sm text-ember">{error}</p> : null}
        <Button variant="primary" type="submit" className="mt-6 w-full">
          Unlock
        </Button>
      </form>
    </div>
  )
}
