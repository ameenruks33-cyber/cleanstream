import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AdShieldProvider } from '@/app/AdShieldProvider'
import { AdShieldPage } from '@/features/adshield/AdShieldPage'
import { Html5Player } from '@/features/player/Html5Player'
import { YouTubeEmbed } from '@/features/player/YouTubeEmbed'
import { AD_SHIELD_STORAGE_KEY } from '@/lib/adshield/engine'

function renderShield() {
  return render(
    <MemoryRouter>
      <AdShieldProvider>
        <AdShieldPage />
      </AdShieldProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  window.localStorage.removeItem(AD_SHIELD_STORAGE_KEY)
})

describe('Ad Shield settings accessibility', () => {
  it('exposes keyboard-operable switches and persists disable', async () => {
    const user = userEvent.setup()
    renderShield()
    const master = screen.getByRole('switch', { name: 'Ad Shield' })
    expect(master).toHaveAttribute('aria-checked', 'true')
    await user.click(master)
    expect(master).toHaveAttribute('aria-checked', 'false')
    await user.tab()
    expect(document.activeElement).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear filtering history' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset Ad Shield settings' })).toBeInTheDocument()
    expect(screen.getByText(/does not include YouTube/i)).toBeInTheDocument()
    expect(screen.queryByText(/100% YouTube ad blocking/i)).not.toBeInTheDocument()
  })

  it('validates custom domains before saving', async () => {
    const user = userEvent.setup()
    renderShield()
    await user.type(screen.getByRole('textbox', { name: 'Denylist' }), 'not a domain')
    await user.click(screen.getByRole('button', { name: 'Save domain lists' }))
    expect(screen.getByText(/Fix the invalid domains/i)).toBeInTheDocument()
  })
})

describe('playback paths', () => {
  it('keeps the official YouTube embed unmodified', () => {
    render(<YouTubeEmbed videoId="dQw4w9WgXcQ" title="Never Gonna Give You Up" />)
    const iframe = screen.getByTitle('Never Gonna Give You Up')
    expect(iframe).toHaveAttribute('src', expect.stringContaining('https://www.youtube.com/embed/dQw4w9WgXcQ'))
    expect(iframe.hasAttribute('allowfullscreen') || iframe.hasAttribute('allowFullScreen')).toBe(true)
    expect(document.querySelector('[data-official-youtube-embed="true"]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /skip ad/i })).not.toBeInTheDocument()
  })

  it('plays authorized files in an ad-free HTML5 player', () => {
    const { container } = render(
      <Html5Player
        src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
        title="Demo"
        captions={[{ src: '/captions/big-buck-bunny.en.vtt', label: 'English', srclang: 'en' }]}
      />,
    )
    expect(container.querySelector('[data-ad-free="true"]')).toBeTruthy()
    expect(container.querySelector('[data-ad-integrations="none"]')).toBeTruthy()
    expect(container.querySelector('video')?.getAttribute('src')).toContain('commondatastorage.googleapis.com')
  })
})
