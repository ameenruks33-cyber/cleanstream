export function isHandheldDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

export function isLandscapeViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(orientation: landscape)').matches
}

export function shouldAutoEnterFullView(input: {
  handheld: boolean
  landscape: boolean
  active: boolean
  skipped: boolean
}): boolean {
  return input.handheld && input.landscape && !input.active && !input.skipped
}

export function shouldAutoExitFullView(input: {
  handheld: boolean
  landscape: boolean
  autoEntered: boolean
}): boolean {
  return input.handheld && !input.landscape && input.autoEntered
}

export async function lockLandscape(): Promise<void> {
  const orientation = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void> }
  if (typeof orientation?.lock !== 'function') return
  try {
    await orientation.lock('landscape')
  } catch {
    /* iOS and some browsers only lock after a user gesture or not at all. */
  }
}

export async function unlockOrientation(): Promise<void> {
  try {
    screen.orientation?.unlock?.()
  } catch {
    /* Unlock is optional. */
  }
}

export async function requestElementFullscreen(node: Element | null): Promise<boolean> {
  if (!node || typeof document === 'undefined') return false
  if (document.fullscreenElement) return true
  const request =
    node.requestFullscreen?.bind(node) ??
    (node as Element & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen?.bind(node)
  if (!request) return false
  try {
    await request()
    return true
  } catch {
    return false
  }
}

export async function exitElementFullscreen(): Promise<void> {
  if (typeof document === 'undefined' || !document.fullscreenElement) return
  try {
    await document.exitFullscreen()
  } catch {
    /* Already left full screen. */
  }
}

type WebkitVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
  webkitExitFullscreen?: () => void
  webkitDisplayingFullscreen?: boolean
}

export function enterIosVideoFullscreen(video: HTMLVideoElement | null): boolean {
  const player = video as WebkitVideo | null
  if (!player?.webkitEnterFullscreen) return false
  try {
    player.webkitEnterFullscreen()
    return true
  } catch {
    return false
  }
}
