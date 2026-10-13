export type FilterReason = 'ad' | 'tracker' | 'denylist'

export type AdShieldSettings = {
  enabled: boolean
  blockThirdPartyAds: boolean
  trackingProtection: boolean
  allowlist: string[]
  denylist: string[]
}

export type FilterEvent = {
  id: string
  at: string
  url: string
  reason: FilterReason
  blocked: true
}

export type RequestContext = {
  referrer?: string
  initiator?: string
  resourceType?: string
}

export type FilterDecision = {
  block: boolean
  reason?: FilterReason
  estimate?: boolean
}

export type FilterListUpdateResult =
  | { ok: true; hosts: string[]; source: string }
  | { ok: false; error: string; hosts: string[] }
