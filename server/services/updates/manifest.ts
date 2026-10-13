import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type UpdateManifest = {
  version: string
  builtAt?: string
  channel: 'web'
  pushConfigured: boolean
  notes: string
  delivery: {
    web: string
    android: string
    ios: string
    desktop: string
  }
}

function readBuiltVersion(): { version: string; builtAt?: string } {
  const candidates = [
    join(process.cwd(), 'dist', 'version.json'),
    join(process.cwd(), 'version.json'),
    join(process.cwd(), 'public', 'version.json'),
  ]
  for (const file of candidates) {
    if (!existsSync(file)) continue
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as { version?: string; builtAt?: string }
      if (typeof parsed.version === 'string' && parsed.version) {
        return { version: parsed.version, builtAt: parsed.builtAt }
      }
    } catch {
      /* ignore unreadable stamp */
    }
  }
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID
  if (sha) return { version: sha }
  return { version: 'local' }
}

export function getUpdateManifest(pushConfigured: boolean): UpdateManifest {
  const built = readBuiltVersion()
  return {
    version: built.version,
    builtAt: built.builtAt,
    channel: 'web',
    pushConfigured,
    notes:
      'Installed web apps refresh after this release is activated. Native Play/App Store binaries follow those stores. Desktop uses a signed installer, not a silent executable replace.',
    delivery: {
      web: 'version.json, service worker, Web Push, and periodic background checks',
      android: 'Chrome/Android PWAs use Web Push (FCM). Play Store APK/AAB updates are a separate native listing.',
      ios: 'Installed iOS PWAs use Web Push (APNs). App Store IPA updates are a separate native listing.',
      desktop: 'Signed installer or framework auto-update; this app notifies and does not overwrite its own executable.',
    },
  }
}
