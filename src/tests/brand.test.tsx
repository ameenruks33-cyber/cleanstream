import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Brand, WaveName } from '@/components/Brand'

describe('MyTube brand', () => {
  it('shows the animated MyTube name and logo', () => {
    render(<Brand />)
    expect(screen.getByLabelText('MyTube')).toBeInTheDocument()
    expect(document.querySelector('img[src="/logo.jpg"]')).toBeInTheDocument()
  })

  it('exposes MyTube as an accessible heading', () => {
    render(<WaveName as="h1" />)
    expect(screen.getByRole('heading', { name: 'MyTube' })).toBeInTheDocument()
  })
})
