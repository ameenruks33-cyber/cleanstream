/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

type CleanstreamAdShieldBridge = {
  syncSettings: (settings: {
    enabled: boolean
    blockThirdPartyAds: boolean
    trackingProtection: boolean
    allowlist: string[]
    denylist: string[]
  }) => Promise<void>
  getStats: () => Promise<{ blockedEstimate: number }>
}

interface Window {
  cleanstream?: {
    desktop?: boolean
    adShield?: CleanstreamAdShieldBridge
  }
}
