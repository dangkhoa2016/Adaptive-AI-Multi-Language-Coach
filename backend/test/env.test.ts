import { env } from 'cloudflare:workers'
import { describe, it, expect } from 'vitest'

describe('env bindings', () => {
  it('has ENCRYPTION_KEY from .dev.vars.test', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((env as any).ENCRYPTION_KEY).toBe('test-encryption-key-not-for-production')
  })
})
