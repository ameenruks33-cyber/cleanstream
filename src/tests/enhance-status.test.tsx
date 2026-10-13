import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EnhanceStatus } from '@/features/player/EnhanceStatus'
import { YouTubeEmbed } from '@/features/player/YouTubeEmbed'

describe('enhancement UI', () => {
  it('shows background status without claiming native 4K recovery', () => {
    render(
      <EnhanceStatus
        inspection={{
          enhanceable: true,
          reason: 'Eligible for background Lanczos upscaling to 3840×2160.',
          source: { width: 1280, height: 720, fps: 24, codec: 'h264' },
        }}
        job={{
          jobId: 'job-1',
          fileId: 'big-buck-bunny',
          status: 'running',
          stage: 'lanczos',
          progress: 40,
          message: 'Scaling toward 3840×2160 with Lanczos.',
          ai: { available: false, status: 'skipped', note: 'No AI binary.' },
        }}
        usingEnhanced={false}
        onToggle={() => undefined}
      />,
    )
    expect(screen.getByText(/Enhancing in the background/)).toBeInTheDocument()
    expect(screen.getByText(/does not restore true 4K/i)).toBeInTheDocument()
    expect(screen.queryByText(/100% native 4K/i)).not.toBeInTheDocument()
  })

  it('leaves the official YouTube player unmodified', () => {
    render(<YouTubeEmbed videoId="dQw4w9WgXcQ" title="Never Gonna Give You Up" />)
    const iframe = screen.getByTitle('Never Gonna Give You Up')
    expect(iframe.getAttribute('src')).toContain('youtube.com/embed/dQw4w9WgXcQ')
    expect(screen.queryByText(/enhanced copy/i)).not.toBeInTheDocument()
  })
})
