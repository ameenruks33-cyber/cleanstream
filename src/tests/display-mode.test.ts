import { describe, expect, it } from 'vitest'
import { shouldAutoEnterFullView, shouldAutoExitFullView } from '@/lib/displayMode'

describe('phone landscape full view', () => {
  it('enters full view when a handheld device turns landscape', () => {
    expect(
      shouldAutoEnterFullView({ handheld: true, landscape: true, active: false, skipped: false }),
    ).toBe(true)
    expect(
      shouldAutoEnterFullView({ handheld: false, landscape: true, active: false, skipped: false }),
    ).toBe(false)
    expect(
      shouldAutoEnterFullView({ handheld: true, landscape: true, active: false, skipped: true }),
    ).toBe(false)
  })

  it('leaves auto full view when the phone returns to portrait', () => {
    expect(shouldAutoExitFullView({ handheld: true, landscape: false, autoEntered: true })).toBe(true)
    expect(shouldAutoExitFullView({ handheld: true, landscape: true, autoEntered: true })).toBe(false)
  })
})
