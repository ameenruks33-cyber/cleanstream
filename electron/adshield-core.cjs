const PROTECTED = [
  'localhost',
  'youtube.com',
  'youtube-nocookie.com',
  'youtu.be',
  'googlevideo.com',
  'ytimg.com',
  'ggpht.com',
  'gstatic.com',
  'googleapis.com',
  'commondatastorage.googleapis.com',
  'supabase.co',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]

const AD_HOSTS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.com',
  'ads.google.com',
  'amazon-adsystem.com',
  'ads-twitter.com',
  'adnxs.com',
  'taboola.com',
  'outbrain.com',
  'criteo.com',
]

const TRACKER_HOSTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.net',
  'scorecardresearch.com',
  'quantserve.com',
  'hotjar.com',
  'mixpanel.com',
]

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i
const FILTER_LIST_MAX_BYTES = 2_000_000
const FILTER_LIST_URLS = [
  'https://easylist.to/easylist/easylist.txt',
  'https://easylist.to/easylist/easyprivacy.txt',
]

function hostMatches(hostname, rule) {
  const host = String(hostname || '').toLowerCase()
  const needle = String(rule || '').toLowerCase()
  return host === needle || host.endsWith(`.${needle}`)
}

function validateDomain(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
  if (!value) return { ok: false, error: 'Enter a domain.' }
  if (value === 'localhost') return { ok: true, value }
  if (value.includes(':') || value.includes(' ') || value.includes('*')) {
    return { ok: false, error: 'Use a hostname only.' }
  }
  if (!DOMAIN_RE.test(value)) return { ok: false, error: 'Invalid domain.' }
  return { ok: true, value }
}

function isProtectedHost(hostname) {
  const host = String(hostname || '').toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  return PROTECTED.some((rule) => hostMatches(host, rule))
}

function isYoutubePlayerContext(details = {}) {
  for (const candidate of [details.referrer, details.initiator]) {
    if (!candidate) continue
    try {
      const host = new URL(candidate).hostname
      if (
        hostMatches(host, 'youtube.com') ||
        hostMatches(host, 'youtube-nocookie.com') ||
        hostMatches(host, 'youtu.be') ||
        hostMatches(host, 'googlevideo.com')
      ) {
        return true
      }
    } catch {
      /* ignore */
    }
  }
  return false
}

function sanitizeSettings(input = {}) {
  const allowlist = Array.isArray(input.allowlist)
    ? input.allowlist.map((item) => validateDomain(item)).filter((item) => item.ok).map((item) => item.value)
    : []
  const denylist = Array.isArray(input.denylist)
    ? input.denylist.map((item) => validateDomain(item)).filter((item) => item.ok).map((item) => item.value)
    : []
  return {
    enabled: input.enabled !== false,
    blockThirdPartyAds: input.blockThirdPartyAds !== false,
    trackingProtection: input.trackingProtection !== false,
    allowlist,
    denylist,
  }
}

function classify(hostname) {
  if (AD_HOSTS.some((rule) => hostMatches(hostname, rule))) return 'ad'
  if (TRACKER_HOSTS.some((rule) => hostMatches(hostname, rule))) return 'tracker'
  return null
}

function shouldBlockRequest(rawUrl, settings, details = {}) {
  const current = sanitizeSettings(settings)
  if (!current.enabled) return { block: false }
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return { block: false }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { block: false }
  if (isProtectedHost(url.hostname) || url.pathname.startsWith('/api/')) return { block: false }
  if (isYoutubePlayerContext(details)) return { block: false }
  if (current.allowlist.some((rule) => hostMatches(url.hostname, rule))) return { block: false }
  if (current.denylist.some((rule) => hostMatches(url.hostname, rule))) {
    return { block: true, reason: 'denylist' }
  }
  const kind = classify(url.hostname)
  if (kind === 'ad' && current.blockThirdPartyAds) return { block: true, reason: 'ad' }
  if (kind === 'tracker' && current.trackingProtection) return { block: true, reason: 'tracker' }
  return { block: false }
}

function isAllowedAppNavigation(raw) {
  try {
    const url = new URL(raw)
    if (url.protocol === 'file:') return true
    const host = url.hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

function isTrustedExternalLink(raw) {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    return (
      hostMatches(url.hostname, 'youtube.com') ||
      hostMatches(url.hostname, 'youtu.be') ||
      hostMatches(url.hostname, 'google.com') ||
      hostMatches(url.hostname, 'supabase.com')
    )
  } catch {
    return false
  }
}

function parseHostFilterList(text) {
  const hosts = []
  const seen = new Set()
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) continue
    if (trimmed.includes('##') || trimmed.includes('#@#')) continue
    const match = trimmed.match(/^\|\|([a-z0-9.-]+)\^/i)
    if (!match || !match[1]) continue
    const host = match[1].toLowerCase()
    if (isProtectedHost(host) || seen.has(host)) continue
    const parsed = validateDomain(host)
    if (!parsed.ok) continue
    seen.add(parsed.value)
    hosts.push(parsed.value)
  }
  return hosts
}

async function downloadFilterLists(fetchImpl = fetch) {
  const collected = []
  const seen = new Set()
  let lastError = ''
  for (const source of FILTER_LIST_URLS) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      const response = await fetchImpl(source, {
        signal: controller.signal,
        redirect: 'error',
        headers: { Accept: 'text/plain' },
      })
      clearTimeout(timer)
      if (!response.ok) {
        lastError = `Filter list returned ${response.status}.`
        continue
      }
      const text = await response.text()
      if (text.length > FILTER_LIST_MAX_BYTES) {
        lastError = 'Filter list exceeded the 2 MB safety limit.'
        continue
      }
      for (const host of parseHostFilterList(text)) {
        if (seen.has(host)) continue
        seen.add(host)
        collected.push(host)
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Filter list download failed.'
    }
  }
  if (collected.length === 0) {
    return { ok: false, error: lastError || 'Filter lists could not be updated.', hosts: [...AD_HOSTS, ...TRACKER_HOSTS] }
  }
  return { ok: true, hosts: collected }
}

module.exports = {
  shouldBlockRequest,
  isAllowedAppNavigation,
  isTrustedExternalLink,
  sanitizeSettings,
  validateDomain,
  parseHostFilterList,
  downloadFilterLists,
  isProtectedHost,
}
