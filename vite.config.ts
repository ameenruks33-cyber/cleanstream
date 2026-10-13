import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

function autoUpdatePlugin(): Plugin {
  return {
    name: 'cleanstream-auto-update',
    apply: 'build',
    closeBundle() {
      const version = `${Date.now()}`
      const swPath = path.resolve(root, 'dist/sw.js')
      if (existsSync(swPath)) {
        const source = readFileSync(swPath, 'utf8').replaceAll('__CLEANSTREAM_VERSION__', version)
        writeFileSync(swPath, source)
      }
      writeFileSync(
        path.resolve(root, 'dist/version.json'),
        `${JSON.stringify({
          version,
          builtAt: new Date().toISOString(),
          channel: 'web',
          notes: 'Reload the installed web app to activate this release.',
        })}\n`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), autoUpdatePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx', 'server/tests/**/*.test.ts'],
    restoreMocks: true,
  },
})
