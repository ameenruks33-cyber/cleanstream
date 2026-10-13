import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Html5Player } from '@/features/player/Html5Player'

describe('accessible player controls', () => {
  it('exposes play, seek, volume, and speed controls', async () => {
    const user = userEvent.setup()
    render(
      <Html5Player
        src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
        title="Demo"
        captions={[{ src: '/captions/big-buck-bunny.en.vtt', label: 'English', srclang: 'en' }]}
      />,
    )
    expect(screen.getByRole('region', { name: 'Demo player' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Seek' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeInTheDocument()
    expect(screen.getByLabelText('Playback speed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mute' }))
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument()
  })
})
