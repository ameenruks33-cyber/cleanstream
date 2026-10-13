import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VideoGrid } from '@/components/VideoGrid'
import { WatchNav } from '@/features/player/WatchNav'
import { ownedVideos } from '@/data/ownedVideos'
import { readWatchQueue } from '@/lib/watchQueue'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

describe('watch navigation', () => {
  it('goes back and to the next video', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    const onFullView = vi.fn()
    render(
      <WatchNav
        onBack={onBack}
        previousTitle="Elephant's Dream"
        nextTitle="Sintel"
        onPrevious={onPrevious}
        onNext={onNext}
        onFullView={onFullView}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: /Previous/ }))
    await user.click(screen.getByRole('button', { name: /Next/ }))
    await user.click(screen.getByRole('button', { name: 'Full view' }))
    expect(onBack).toHaveBeenCalledOnce()
    expect(onFullView).toHaveBeenCalledOnce()
    expect(onPrevious).toHaveBeenCalledOnce()
    expect(onNext).toHaveBeenCalledOnce()
    expect(screen.getByText('Up next: Sintel')).toBeInTheDocument()
  })

  it('stores the grid you opened so next stays in that list', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/library']}>
        <VideoGrid videos={ownedVideos} />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('link', { name: /Big Buck Bunny/ }))
    const queue = readWatchQueue()
    expect(queue.origin).toBe('/library')
    expect(queue.items.map((item) => item.id)).toEqual(ownedVideos.map((item) => item.id))
  })
})
