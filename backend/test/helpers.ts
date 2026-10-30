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

// Track INSERTs into ai_generated_content for test assertions
export const savedAiContent: Array<{
  source_lang: string
  target_lang: string
  topic: string
  level: string
  mode: string
  count: number
  pairs_json: string
  cache_key: string
}> = []

export function resetSavedAiContent() {
  savedAiContent.length = 0
}

/**
 * resetKV is a no-op — state is managed by the pool-workers runtime
 */
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

// In-memory mock of system_settings rows, keyed by setting name
export const systemSettingsStore = new Map<string, string>()

export function resetSystemSettings() {
  systemSettingsStore.clear()
}

/**
 * Creates a mock D1Database that reads from systemSettingsStore for
 * system_settings queries and tracks INSERTs into ai_generated_content.
 */
function createMockDB(): D1Database {
  return {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        all: async <T>() => {
          if (sql.includes('FROM system_settings') && sql.includes('WHERE key =')) {
            const key = values[0] as string
            const value = systemSettingsStore.get(key)
            if (value !== undefined) {
              return { results: [{ value }] as unknown as T[], success: true } as never
            }
            return { results: [] as T[], success: true } as never
          }
          if (sql.includes('FROM system_settings')) {
            // LIKE queries
            const pattern = values[0] as string
            const results: Array<{ key: string; value: string }> = []
            for (const [key, value] of systemSettingsStore.entries()) {
              if (
                key === pattern ||
                (pattern.endsWith('%') && key.startsWith(pattern.slice(0, -1)))
              ) {
                results.push({ key, value })
              }
            }
            return { results: results as unknown as T[], success: true } as never
          }
          return { results: [] as T[], success: true } as never
        },
        run: async () => {
          if (sql.includes('INSERT INTO ai_generated_content')) {
            const row = {
              source_lang: values[0] as string,
              target_lang: values[1] as string,
              topic: values[2] as string,
              level: values[3] as string,
              mode: values[4] as string,
              count: values[5] as number,
              pairs_json: values[6] as string,
              cache_key: values[7] as string,
            }
            savedAiContent.push(row)
          }
          return { success: true }
        },
        first: async () => (sql.includes('INSERT INTO quota_buckets') ? { used: 1 } : null),
        raw: async () => [],
      }),
      all: async <T>() => ({ results: [] as T[], success: true }) as never,
      first: async () => null,
      run: async () => ({ success: true }),
      raw: async () => [],
    }),
    batch: async () => [],
    exec: async () => ({ success: true }),
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database
}

export function createMockEnv(overrides?: Record<string, unknown>) {
  const db = (overrides?.DB as D1Database | undefined) ?? createMockDB()
  return {
    DB: db,
    ENVIRONMENT: 'local',
    PUBLIC_APP_ORIGIN: 'http://localhost',
    CACHE: {} as KVNamespace,
    ENCRYPTION_KEY: 'test-encryption-key-32-chars!!',
    ...overrides,
  } as never
}

export { exports as app }
