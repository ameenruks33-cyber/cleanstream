import { describe, expect, it } from 'vitest'
import { resolveAuthenticatedUserId } from '../../src/lib/authz.ts'

describe('server authorization helper', () => {
  it('never trusts a body-supplied user id', () => {
    expect(resolveAuthenticatedUserId('auth-user', 'attacker')).toBe('auth-user')
    expect(() => resolveAuthenticatedUserId(undefined, 'attacker')).toThrow(/Sign in required/)
  })
})
