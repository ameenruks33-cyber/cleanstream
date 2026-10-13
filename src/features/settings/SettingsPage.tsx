import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLibrary } from '@/app/LibraryProvider'
import { Button } from '@/components/Button'
import { fetchHealth, saveYoutubeApiKey } from '@/services/api'
import { protectVaultWithPassphrase, removeVaultPassphrase, vaultStatus } from '@/lib/cryptoVault'
import { isSupabaseConfigured } from '@/services/supabaseClient'
import type { ThemeMode } from '@/types'

const themes: { id: ThemeMode; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'system', label: 'System' },
]

export function SettingsPage() {
  const { state, user, updatePreferences, signIn, signOut, deleteAccountData, clearHistory, clearSearchHistory } =
    useLibrary()
  const [email, setEmail] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [youtubeReady, setYoutubeReady] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [vaultLocked, setVaultLocked] = useState(false)

  useEffect(() => {
    void fetchHealth().then((health) => setYoutubeReady(health.youtubeConfigured))
    void vaultStatus().then((status) => setVaultLocked(status === 'locked'))
  }, [])

  async function onSignIn(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const next = await signIn(email)
      setMessage(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-4xl">Settings</h1>
        <p className="mt-2 text-sm text-muted">Theme, privacy, and optional account sync. Minimal data by default.</p>
      </div>

      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-2xl">YouTube search</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Search already returns watchable YouTube videos and plays them in the official player. An optional YouTube
          Data API v3 key uses Google’s catalog instead. The key stays on this computer.
        </p>
        <p className="mt-3 text-sm text-muted">
          Status:{' '}
          <strong className="text-ink">
            {youtubeReady ? 'Official YouTube Data API is on' : 'Live search is on (optional API key not set)'}
          </strong>
        </p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm leading-6 text-muted">
          <li>
            Open{' '}
            <a className="text-tide" href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">
              Google Cloud YouTube Data API
            </a>
          </li>
          <li>Enable the API, then create an API key.</li>
          <li>Paste the key below (it usually starts with AIza).</li>
        </ol>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            setError(null)
            void saveYoutubeApiKey(apiKey)
              .then(() => {
                setYoutubeReady(true)
                setApiKey('')
                setMessage('YouTube search is on. Try a title in the search bar.')
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Could not save the key.')
              })
          }}
        >
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="AIza…"
            aria-label="YouTube API key"
            className="flex-1 rounded-full border border-line bg-raised px-4 py-2.5 text-sm"
          />
          <Button variant="primary" type="submit">
            Save API key
          </Button>
        </form>
        {message ? <p className="mt-3 text-sm text-tide">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-ember">{error}</p> : null}
      </section>

      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-2xl">Appearance</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {themes.map((theme) => (
            <Button
              key={theme.id}
              variant={state.preferences.theme === theme.id ? 'primary' : 'ghost'}
              onClick={() => updatePreferences({ theme: theme.id })}
            >
              {theme.label}
            </Button>
          ))}
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={state.preferences.reducedMotion}
            onChange={(event) => updatePreferences({ reducedMotion: event.target.checked })}
          />
          Reduce motion
        </label>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-2xl">Ad Shield</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Block third-party ads and optional trackers inside MyTube. Licensed library videos stay ad-free. YouTube’s
          official player is unchanged — it may still show YouTube ads.
        </p>
        <Link to="/ad-shield" className="mt-4 inline-flex text-sm text-tide">
          Open Ad Shield settings
        </Link>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-2xl">Device encryption</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          MyTube encrypts library data and Ad Shield settings on this device with AES-256-GCM. Traffic to the app
          uses HTTPS. YouTube playback still goes through Google’s official player. Add a passphrase so someone else
          using this browser cannot read your lists.
        </p>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            setError(null)
            void protectVaultWithPassphrase(passphrase)
              .then(() => {
                setPassphrase('')
                setVaultLocked(true)
                setMessage('Vault passphrase saved. You will need it the next time this browser opens MyTube.')
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Could not protect the vault.')
              })
          }}
        >
          <input
            type="password"
            minLength={8}
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="At least 8 characters"
            aria-label="Vault passphrase"
            autoComplete="new-password"
            className="flex-1 rounded-full border border-line bg-raised px-4 py-2.5 text-sm"
          />
          <Button variant="primary" type="submit">
            {vaultLocked ? 'Update passphrase' : 'Encrypt with passphrase'}
          </Button>
        </form>
        {vaultLocked ? (
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => {
              void removeVaultPassphrase().then(() => {
                setVaultLocked(false)
                setMessage('Passphrase removed. Data stays AES-encrypted with a device key.')
              })
            }}
          >
            Remove passphrase lock
          </Button>
        ) : null}
      </section>

      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-2xl">Privacy</h2>
        <label className="mt-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={state.preferences.historyEnabled}
            onChange={(event) => updatePreferences({ historyEnabled: event.target.checked })}
          />
          Save watch history on this device
        </label>
        <label className="mt-3 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={state.preferences.analyticsConsent}
            onChange={(event) => updatePreferences({ analyticsConsent: event.target.checked })}
          />
          Allow basic product metrics (off unless you opt in; MyTube ships with no tracker)
        </label>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={clearHistory}>
            Clear watch history
          </Button>
          <Button variant="ghost" onClick={clearSearchHistory}>
            Clear search history
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-2xl">Account</h2>
        {!isSupabaseConfigured() ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            Supabase is not configured. Guest mode keeps favorites, playlists, and history in this browser. Add
            VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable magic-link sign-in and sync. This uses Supabase’s
            free tier when you create a project; it may not stay free forever.
          </p>
        ) : user ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              Signed in as <strong>{user.email}</strong>
            </p>
            <Button variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        ) : (
          <form onSubmit={(event) => void onSignIn(event)} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              aria-label="Email"
              className="flex-1 rounded-full border border-line bg-raised px-4 py-2.5 text-sm"
            />
            <Button variant="primary" type="submit">
              Email sign-in link
            </Button>
          </form>
        )}
        {message ? <p className="mt-3 text-sm text-tide">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-ember">{error}</p> : null}
      </section>

      <section className="rounded-3xl border border-ember/30 bg-ember/8 p-6">
        <h2 className="font-display text-2xl">Delete local data</h2>
        <p className="mt-2 text-sm text-muted">
          Removes favorites, playlists, history, and preferences from this browser. If you are signed in, the cloud copy
          of your library is also deleted. This cannot restore YouTube videos — we never stored the media.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => void deleteAccountData()}>
          Delete my MyTube data
        </Button>
      </section>
    </div>
  )
}
