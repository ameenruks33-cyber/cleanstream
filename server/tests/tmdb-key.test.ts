import { describe, expect, it } from 'vitest'
import { normalizeTmdbApiKey } from '../config/env.ts'

describe('normalizeTmdbApiKey', () => {
  it('accepts a v3 API key', () => {
    expect(normalizeTmdbApiKey('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  })

  it('pulls the v3 key from a JWT read-access token', () => {
    const payload = Buffer.from(
      JSON.stringify({ aud: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', scopes: ['api_read'] }),
      'utf8',
    ).toString('base64url')
    const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`
    expect(normalizeTmdbApiKey(token)).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  })

  it('rejects empty or junk values', () => {
    expect(normalizeTmdbApiKey('')).toBeNull()
    expect(normalizeTmdbApiKey('not-a-key')).toBeNull()
  })
})
