import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestMagicLink, verifyMagicLink } from '../../src/api/client'

afterEach(() => vi.unstubAllGlobals())

describe('auth HTTP JSON contract', () => {
  it.each([
    ['request', { email: 'synthetic@example.invalid' }],
    ['verify', { token: 'synthetic-invalid-token' }],
  ] as const)('serializes %s body exactly once', async (action, expected) => {
    let actual: unknown
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      actual = JSON.parse(init.body as string)
      return Response.json({ success: true })
    })

    if (action === 'request') await requestMagicLink('synthetic@example.invalid')
    else await verifyMagicLink('synthetic-invalid-token')

    expect(actual).toEqual(expected)
    expect(typeof actual).toBe('object')
  })
})
