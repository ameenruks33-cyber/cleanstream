const { app, BrowserWindow, ipcMain, session, shell } = require('electron')
const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const adshield = require('./adshield-core.cjs')

const DEV_URL = process.env.ELECTRON_START_URL
let apiProcess
let adShieldSettings = adshield.sanitizeSettings({})
let blockedEstimate = 0
let extraFilterHosts = []

function userEnvPath() {
  return path.join(app.getPath('userData'), '.env')
}

function loadUserEnv() {
  const file = userEnvPath()
  if (!fs.existsSync(file)) return
  const text = fs.readFileSync(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function startApi() {
  if (DEV_URL) return
  loadUserEnv()
  const serverEntry = path.join(__dirname, '..', 'dist-server', 'index.cjs')
  if (!fs.existsSync(serverEntry)) return
  process.env.NODE_ENV = 'production'
  process.env.PORT = process.env.PORT || '8787'
  process.env.APP_URL = process.env.APP_URL || 'http://127.0.0.1:8787'
  apiProcess = spawn(process.execPath, [serverEntry], {
    env: process.env,
    stdio: 'ignore',
  })
}

const LOCAL_HEALTH = 'http://127.0.0.1:8787/api/health'

async function waitForApi(attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(LOCAL_HEALTH, { redirect: 'error' })
      if (response.ok) return
    } catch {
      /* still booting */
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

let filterInstalled = false

function applyAdShieldFilter() {
  if (filterInstalled) return
  filterInstalled = true
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    const settings = {
      ...adShieldSettings,
      denylist: [...adShieldSettings.denylist, ...extraFilterHosts],
    }
    const decision = adshield.shouldBlockRequest(details.url, settings, {
      referrer: details.referrer,
      resourceType: details.resourceType,
    })
    if (decision.block) {
      blockedEstimate += 1
      callback({ cancel: true })
      return
    }
    callback({ cancel: false })
  })
}

function attachNavigationGuards(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (adshield.isTrustedExternalLink(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (adshield.isAllowedAppNavigation(url)) return
    event.preventDefault()
    if (adshield.isTrustedExternalLink(url)) {
      void shell.openExternal(url)
    }
  })
}

ipcMain.handle('adshield:sync', (_event, settings) => {
  adShieldSettings = adshield.sanitizeSettings(settings)
  return { ok: true }
})

ipcMain.handle('adshield:stats', () => ({ blockedEstimate }))

ipcMain.handle('adshield:update-lists', async () => {
  const result = await adshield.downloadFilterLists()
  if (result.ok) extraFilterHosts = result.hosts
  return result
})

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0c0b0a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  applyAdShieldFilter()
  attachNavigationGuards(win)

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://i.ytimg.com https://yt3.ggpht.com https://commondatastorage.googleapis.com; media-src 'self' blob: https://commondatastorage.googleapis.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self' http://127.0.0.1:8787 https://*.supabase.co wss://*.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'",
        ],
      },
    })
  })

  if (DEV_URL) {
    await win.loadURL(DEV_URL)
  } else {
    startApi()
    await waitForApi()
    await win.loadURL('http://127.0.0.1:8787')
  }
}

app.whenReady().then(() => {
  void createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (apiProcess) apiProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})
