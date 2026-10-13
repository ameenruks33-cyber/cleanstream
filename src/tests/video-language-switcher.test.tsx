import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import VideoLanguageSwitcher from '@/components/VideoLanguageSwitcher'
import { Html5Player } from '@/features/player/Html5Player'
import type { VideoLanguageTrack } from '@/lib/videoLanguages'

describe('video language switcher', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('applies a licensed Malayalam subtitle track', async () => {
    const user = userEvent.setup()
    const onApplied = vi.fn()
    const track: VideoLanguageTrack = {
      status: 'ready',
      videoId: 'big-buck-bunny',
      language: 'ml',
      mode: 'subtitles',
      trackUrl: '/api/video-language/media/big-buck-bunny/ml.vtt',
      cues: [{ start: 0, end: 4, text: 'ബിഗ് ബക്ക് ബണ്ണി' }],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => track,
      })),
    )

    render(<VideoLanguageSwitcher videoId="big-buck-bunny" onApplied={onApplied} />)
    expect(screen.getByLabelText('Preferred language')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Malayalam' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Tamil' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Arabic' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Apply language' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Language track is ready.')
    expect(onApplied).toHaveBeenCalledWith(track)
  })

  it('queues dubbed audio and surfaces the job id', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input)
        if (url.includes('/jobs/')) {
          return {
            ok: true,
            json: async () => ({
              status: 'ready',
              jobId: '11111111-2222-4333-8333-444444444444',
              videoId: 'sintel',
              language: 'hi',
              mode: 'dubbed',
              trackUrl: '/api/video-language/media/sintel/hi.vtt',
              cues: [{ start: 0, end: 4, text: 'सिन्टेल' }],
            }),
          }
        }
        return {
          ok: true,
          json: async () => ({
            status: 'queued',
            jobId: '11111111-2222-4333-8333-444444444444',
            videoId: 'sintel',
            language: 'hi',
            mode: 'dubbed',
          }),
        }
      }),
    )

    render(<VideoLanguageSwitcher videoId="sintel" />)
    await user.selectOptions(screen.getByLabelText('Preferred language'), 'hi')
    await user.selectOptions(screen.getByLabelText('Playback mode'), 'dubbed')
    await user.click(screen.getByRole('button', { name: 'Apply language' }))
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Dubbed audio is ready.')
    })
    expect(vi.mocked(fetch).mock.calls.some((call) => String(call[0]).includes('/jobs/'))).toBe(true)
  })

  it('attaches the selected subtitle track to the licensed player', () => {
    render(
      <Html5Player
        src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
        title="Sintel"
        captionLanguage="ta"
        captions={[
          {
            src: '/api/video-language/media/sintel/ta.vtt',
            label: 'Tamil',
            srclang: 'ta',
          },
        ]}
      />,
    )
    const track = document.querySelector('track')
    expect(track?.getAttribute('srclang')).toBe('ta')
    expect(track?.getAttribute('src')).toBe('/api/video-language/media/sintel/ta.vtt')
    expect(track?.getAttribute('label')).toBe('Tamil')
  })
})
