import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAdShield } from '@/app/AdShieldProvider'
import { Button } from '@/components/Button'
import { parseDomainList, updateFilterLists } from '@/lib/adshield/engine'

function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-4 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-ember' : 'bg-raised'}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`}
        />
      </button>
    </div>
  )
}

export function AdShieldPage() {
  const { settings, blockedEstimate, events, desktop, updateSettings, setDomainLists, clearEvents, reset } =
    useAdShield()
  const [allowText, setAllowText] = useState(settings.allowlist.join('\n'))
  const [denyText, setDenyText] = useState(settings.denylist.join('\n'))
  const [listMessage, setListMessage] = useState<string | null>(null)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)

  const allowErrors = useMemo(() => parseDomainList(allowText).errors, [allowText])
  const denyErrors = useMemo(() => parseDomainList(denyText).errors, [denyText])

  function onSaveLists(event: FormEvent) {
    event.preventDefault()
    const allow = parseDomainList(allowText)
    const deny = parseDomainList(denyText)
    if (allow.errors.length || deny.errors.length) {
      setListMessage('Fix the invalid domains before saving.')
      return
    }
    setDomainLists(allow.domains, deny.domains)
    setListMessage('Allowlist and denylist saved on this device.')
  }

  async function onUpdateLists() {
    setUpdateMessage('Checking filter lists…')
    const result = await updateFilterLists()
    if (result.ok) {
      setUpdateMessage(`Updated ${result.hosts.length} host rules from public lists. YouTube player origins stay allowed.`)
      return
    }
    setUpdateMessage(result.error)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Privacy</p>
        <h1 className="mt-2 font-display text-4xl">Ad Shield</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Ad Shield blocks third-party advertising and optional tracking requests inside CleanStream. It does not remove
          advertisements from YouTube’s official player. Licensed library videos play without ad SDKs.
        </p>
      </div>

      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-2xl">Protection</h2>
        <Switch
          checked={settings.enabled}
          onChange={(value) => updateSettings({ enabled: value })}
          label="Ad Shield"
          description="Master switch. When off, CleanStream does not filter third-party ad or tracker requests."
        />
        <Switch
          checked={settings.blockThirdPartyAds}
          onChange={(value) => updateSettings({ blockThirdPartyAds: value })}
          label="Block third-party ad components"
          description="Stops known advertising networks from loading in CleanStream’s own interface."
        />
        <Switch
          checked={settings.trackingProtection}
          onChange={(value) => updateSettings({ trackingProtection: value })}
          label="Tracking protection"
          description="Blocks common analytics and fingerprinting hosts. No filtering telemetry is sent by default."
        />
      </section>

      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-2xl">Activity</h2>
        <p className="mt-2 text-sm text-muted">
          About <strong className="text-ink">{blockedEstimate}</strong> blocked requests (estimate). This count is local
          and does not include YouTube’s player.
        </p>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No filtering events yet.</p>
        ) : (
          <ul className="mt-4 space-y-2" aria-label="Recent filtering events">
            {events.slice(0, 12).map((event) => (
              <li key={event.id} className="rounded-2xl border border-line bg-raised px-3 py-2 text-sm">
                <span className="text-ember">{event.reason}</span>
                <span className="ml-2 break-all text-muted">{event.url}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={clearEvents}>
            Clear filtering history
          </Button>
          <Button variant="ghost" onClick={reset}>
            Reset Ad Shield settings
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-2xl">Domain lists</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          One hostname per line. Allowlist always wins. These lists apply to CleanStream and, in the desktop app, to
          supported web requests — never to YouTube’s official player origins.
        </p>
        <form className="mt-4 space-y-4" onSubmit={onSaveLists}>
          <label className="block text-sm" htmlFor="adshield-allowlist">
            Allowlist
            <textarea
              id="adshield-allowlist"
              value={allowText}
              onChange={(event) => setAllowText(event.target.value)}
              rows={4}
              spellCheck={false}
              aria-invalid={allowErrors.length > 0}
              className="mt-2 w-full rounded-2xl border border-line bg-raised px-3 py-2 font-mono text-xs"
              placeholder="cdn.example.com"
            />
          </label>
          {allowErrors.map((error) => (
            <p key={error} className="text-sm text-ember">
              {error}
            </p>
          ))}
          <label className="block text-sm" htmlFor="adshield-denylist">
            Denylist
            <textarea
              id="adshield-denylist"
              value={denyText}
              onChange={(event) => setDenyText(event.target.value)}
              rows={4}
              spellCheck={false}
              aria-invalid={denyErrors.length > 0}
              className="mt-2 w-full rounded-2xl border border-line bg-raised px-3 py-2 font-mono text-xs"
              placeholder="ads.example.net"
            />
          </label>
          {denyErrors.map((error) => (
            <p key={error} className="text-sm text-ember">
              {error}
            </p>
          ))}
          <Button variant="primary" type="submit">
            Save domain lists
          </Button>
          {listMessage ? <p className="text-sm text-tide">{listMessage}</p> : null}
        </form>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-6">
        <h2 className="font-display text-2xl">Desktop filter lists</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {desktop
            ? 'The Windows app can refresh EasyList-style host rules. Element-hiding rules and YouTube player origins are ignored.'
            : 'Full browser-level filtering runs in the CleanStream desktop app. In Chrome, Ad Shield only filters requests made by this site.'}
        </p>
        <Button variant="ghost" className="mt-4" onClick={() => void onUpdateLists()}>
          Check filter-list updates
        </Button>
        {updateMessage ? <p className="mt-3 text-sm text-muted">{updateMessage}</p> : null}
      </section>

      <section className="rounded-3xl border border-line bg-panel p-6 text-sm leading-6 text-muted">
        <h2 className="font-display text-2xl text-ink">What is and is not blocked</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Blocked: third-party ad networks and optional trackers in CleanStream’s own UI.</li>
          <li>Ad-free: licensed library files in the HTML5 player — no advertising SDK.</li>
          <li>Not blocked: advertisements inside YouTube’s official embed. CleanStream does not intercept or rewrite that player.</li>
          <li>Never blocked: app APIs, captions, fonts, licensed media, sign-in, and YouTube player origins.</li>
        </ul>
        <p className="mt-4">
          Ad-free YouTube, where eligible, is{' '}
          <a className="text-tide" href="https://www.youtube.com/premium" target="_blank" rel="noreferrer">
            YouTube Premium
          </a>
          . Preferences stay on this computer. Filtering history is not sent to an external server.
        </p>
        <p className="mt-3">
          <Link className="text-tide" to="/about">
            Read the full policy notes
          </Link>
        </p>
      </section>
    </div>
  )
}
