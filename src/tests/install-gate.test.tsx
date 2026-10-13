import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { InstallGate } from '@/app/InstallGate'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

describe('InstallGate', () => {
  it('shows the device installer on first visit', () => {
    render(
      <InstallGate>
        <p>App shell</p>
      </InstallGate>,
    )
    expect(screen.getByRole('heading', { name: 'MyTube' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Install MyTube' })).toBeInTheDocument()
    expect(screen.queryByText('App shell')).not.toBeInTheDocument()
  })

  it('lets the user continue in the browser', async () => {
    const user = userEvent.setup()
    render(
      <InstallGate>
        <p>App shell</p>
      </InstallGate>,
    )
    await user.click(screen.getByRole('button', { name: 'Continue in this browser' }))
    expect(screen.getByText('App shell')).toBeInTheDocument()
  })
})
