import { exports } from 'cloudflare:workers'

/**
 * Integration-style fetch — uses exports.default from the Worker under test.
 * The Worker runs in the same context as the test runner, with real bindings
 * from wrangler.test.toml (CACHE KV, D1, rate limiters, etc).
 */
export function fetchWithEnv(url: string, init?: RequestInit) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (exports as any).default.fetch(new Request(url, init))
}

export function resetKV() {
  // State is managed by the pool-workers runtime
}

/**
 * Creates a mock rate limiter that always succeeds (success: true)
 * or always fails (success: false).
 */
export function createMockRateLimiter(allow: boolean): {
  limit: () => Promise<{ success: boolean }>
} {
  return {
    limit: async () => ({ success: allow }),
  }
}

export { exports as app }
