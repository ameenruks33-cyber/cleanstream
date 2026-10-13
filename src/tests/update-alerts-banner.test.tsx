import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdateAlertsBanner } from '@/app/UpdateAlertsBanner'
import { PUSH_BANNER_DISMISS_KEY } from '@/lib/deviceUpdates'

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('update alerts banner', () => {
  it('asks this device to enable notifications', async () => {
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: async () => 'granted',
    })
    render(<UpdateAlertsBanner />)
    expect(screen.getByText(/Update alerts are off on this device/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(sessionStorage.getItem(PUSH_BANNER_DISMISS_KEY)).toBe('1')
    expect(screen.queryByText(/Update alerts are off on this device/)).not.toBeInTheDocument()
  })
})
