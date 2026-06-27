import { describe, expect, it, beforeEach } from 'vitest'

const users = new Map<string, { id: string; email: string }>()
const learnedPairs = new Map<string, Array<Record<string, unknown>>>()

function createMockDB(): D1Database {
  return {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        all: async <T>() => {
          if (sql.includes('FROM learned_pairs') && sql.includes('WHERE user_id =')) {
            const uid = values[0] as string
            const pairs = learnedPairs.get(uid) ?? []
            if (sql.includes('next_review IS NULL OR next_review <= date')) {
              const today = new Date().toISOString().split('T')[0]
              return {
                results: pairs.filter(
                  (p: any) => !p.next_review || p.next_review <= today,
                ) as unknown as T[],
                success: true,
              }
            }
            return { results: pairs as unknown as T[], success: true }
          }
          if (sql.includes('FROM learned_pairs WHERE id =')) {
            for (const [, pairs] of learnedPairs) {
              const pair = pairs.find((p: any) => p.id === values[0])
              if (pair) return { results: [pair] as unknown as T[], success: true } as any
            }
            return { results: [] as unknown as T[], success: true }
          }
          if (sql.includes('COUNT')) {
            const uid = values[0] as string
            const pairs = learnedPairs.get(uid) ?? []
            const due = pairs.filter(
              (p: any) => !p.next_review || p.next_review <= new Date().toISOString().split('T')[0],
            ).length
            const learning = pairs.filter((p: any) => p.status === 'learning').length
            const mastered = pairs.filter((p: any) => p.status === 'mastered').length
            if (sql.includes('next_review IS NULL OR next_review <= date')) {
              return { results: [{ count: due }] as any, success: true }
            }
            if (sql.includes("status = 'learning'")) {
              return { results: [{ count: learning }] as any, success: true }
            }
            if (sql.includes("status = 'mastered'")) {
              return { results: [{ count: mastered }] as any, success: true }
            }
            return { results: [{ count: pairs.length }] as any, success: true }
          }
          return { results: [] as unknown as T[], success: true }
        },
        first: async <T>() => {
          const uid = values[0] as string
          if (sql.includes('SELECT COUNT')) {
            const pairs = learnedPairs.get(uid) ?? []
            if (sql.includes('next_review IS NULL OR next_review <= date')) {
              const due = pairs.filter(
                (p: any) =>
                  !p.next_review || p.next_review <= new Date().toISOString().split('T')[0],
              ).length
              return { count: due } as unknown as T
            }
            if (sql.includes("status = 'learning'")) {
              return {
                count: pairs.filter((p: any) => p.status === 'learning').length,
              } as unknown as T
            }
            if (sql.includes("status = 'mastered'")) {
              return {
                count: pairs.filter((p: any) => p.status === 'mastered').length,
              } as unknown as T
            }
            return { count: pairs.length } as unknown as T
          }
          if (sql.includes('FROM learned_pairs WHERE id =')) {
            for (const [, pairs] of learnedPairs) {
              const pair = pairs.find((p: any) => p.id === values[0])
              if (pair) return pair as unknown as T | null
            }
            return null
          }
          if (sql.includes('SELECT id, ease, interval, repetitions, user_id')) {
            for (const [, pairs] of learnedPairs) {
              const pair = pairs.find((p: any) => p.id === values[0])
              if (pair) return pair as unknown as T | null
            }
            return null
          }
          if (sql.includes('SELECT id, user_id')) {
            for (const [, pairs] of learnedPairs) {
              const pair = pairs.find((p: any) => p.id === values[0])
              if (pair) return pair as unknown as T | null
            }
            return null
          }
          // Generic SELECT from learned_pairs by id
          if (
            sql.includes('FROM learned_pairs WHERE id = ?') ||
            (sql.includes('SELECT') &&
              sql.includes('FROM learned_pairs') &&
              sql.includes('WHERE id'))
          ) {
            for (const [, pairs] of learnedPairs) {
              const pair = pairs.find((p: any) => p.id === values[0])
              if (pair) return pair as unknown as T | null
            }
            return null
          }
          return null
        },
        run: async () => {
          if (sql.includes('INSERT INTO learned_pairs')) {
            // Parse: INSERT INTO learned_pairs (col1, col2, ...) VALUES (val1, val2, ...)
            const colMatch = sql.match(/\(([\w_,\s]+)\)\s*VALUES\s*\(([^)]+)\)/i)
            if (colMatch) {
              const cols = colMatch[1].split(',').map((c: string) => c.trim())
              const valsRaw = colMatch[2].split(',').map((c: string) => c.trim())
              const record: Record<string, unknown> = {}
              let valueIdx = 0
              cols.forEach((col: string, i: number) => {
                if (valsRaw[i] === '?') {
                  record[col] = values[valueIdx++]
                } else {
                  // Parse literal: strip quotes, convert numbers
                  let lit = valsRaw[i]
                  if (lit.startsWith("'") && lit.endsWith("'")) {
                    record[col] = lit.slice(1, -1)
                  } else if (lit === 'NULL') {
                    record[col] = null
                  } else if (/^\d+$/.test(lit)) {
                    record[col] = Number(lit)
                  } else if (/^\d+\.\d+$/.test(lit)) {
                    record[col] = Number(lit)
                  } else {
                    record[col] = lit
                  }
                }
              })
              const userIdVal = record.user_id as string
              if (!learnedPairs.has(userIdVal)) {
                learnedPairs.set(userIdVal, [])
              }
              learnedPairs.get(userIdVal)!.push(record)
            }
          } else if (sql.includes('UPDATE learned_pairs')) {
            // Find the pair by the last bound value (WHERE id = ?)
            const pairId = values[values.length - 1] as string
            for (const [, pairs] of learnedPairs) {
              const idx = pairs.findIndex((p: any) => p.id === pairId)
              if (idx !== -1) {
                const existing = pairs[idx] as Record<string, unknown>
                // Map SET clauses in order: ease, interval, repetitions, next_review, last_seen, status, updated_at
                const setClauses = [
                  'ease',
                  'interval',
                  'repetitions',
                  'next_review',
                  'last_seen',
                  'status',
                  'updated_at',
                ]
                setClauses.forEach((col, i) => {
                  existing[col] = values[i]
                })
                // Also handle the simpler UPDATE for reset
                if (values.length <= 3) {
                  // ease = 2.5, interval = 0, repetitions = 0, next_review = NULL, status = 'learning', updated_at = ?
                  existing.ease = 2.5
                  existing.interval = 0
                  existing.repetitions = 0
                  existing.next_review = null
                  existing.status = 'learning'
                  existing.updated_at = values[0]
                }
              }
            }
          }
          return { success: true, meta: { changes: 1 } as any }
        },
        raw: async () => [],
      }),
      all: async <T>() => ({ results: [] as unknown as T[], success: true }),
      first: async () => null,
      run: async () => ({ success: true, meta: { changes: 1 } as any }),
      raw: async () => [],
    }),
    batch: async () => [],
    exec: async () => ({ success: true }),
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database
}

async function callApp(url: string, init?: RequestInit, cookie?: string): Promise<Response> {
  const { default: app } = await import('../../src/index')
  const env = {
    DB: createMockDB(),
    CACHE: {} as KVNamespace,
    RATE_LIMITER_API: { limit: async () => ({ success: true }) } as unknown as RateLimit,
    RATE_LIMITER_AUTH: { limit: async () => ({ success: true }) } as unknown as RateLimit,
    ENCRYPTION_KEY: 'test-key-32-chars-xxxxxxxxxxxxx',
    JWT_SECRET: 'test-jwt-secret-32-chars-long!!',
    AI: {} as Ai,
    ASSETS: {} as Fetcher,
  }
  const headers = new Headers(init?.headers)
  headers.set('content-type', 'application/json')
  if (cookie) headers.set('cookie', cookie)
  return app.fetch(new Request(url, { ...init, headers }), env, {
    waitUntil: () => {},
    passThroughOnException: () => {},
    props: {},
  })
}

describe('review routes', () => {
  const userId = 'review-user-1'
  let jwt: string

  beforeEach(async () => {
    users.clear()
    learnedPairs.clear()
    users.set(userId, { id: userId, email: 'review@test.com' })
    const { createJwt } = await import('../../src/services/auth')
    jwt = await createJwt(userId, 'test-jwt-secret-32-chars-long!!')
  })

  it('GET /api/review/stats returns 401 without auth', async () => {
    const res = await callApp('http://localhost/api/review/stats')
    expect(res.status).toBe(401)
  })

  it('GET /api/review/stats returns zero counts', async () => {
    const res = await callApp('http://localhost/api/review/stats', {}, `auth_token=${jwt}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.dueCount).toBe(0)
    expect(body.totalCount).toBe(0)
  })

  it('POST /api/vocab/save creates a new learned pair', async () => {
    const res = await callApp(
      'http://localhost/api/vocab/save',
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'en',
          target: 'vi',
          sourceText: 'hello',
          targetText: 'xin chào',
        }),
      },
      `auth_token=${jwt}`,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.pair.source_text).toBe('hello')
    expect(body.pair.ease).toBe(2.5)
    expect(body.pair.interval).toBe(0)
  })

  it('POST /api/vocab/save returns 400 with missing fields', async () => {
    const res = await callApp(
      'http://localhost/api/vocab/save',
      {
        method: 'POST',
        body: JSON.stringify({ source: 'en' }),
      },
      `auth_token=${jwt}`,
    )
    expect(res.status).toBe(400)
  })

  it('POST /api/review/grade applies SM-2 and updates pair', async () => {
    const savedRes = await callApp(
      'http://localhost/api/vocab/save',
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'en',
          target: 'vi',
          sourceText: 'world',
          targetText: 'thế giới',
        }),
      },
      `auth_token=${jwt}`,
    )
    const saved = (await savedRes.json()) as any
    const pairId = saved.pair.id

    const gradeRes = await callApp(
      'http://localhost/api/review/grade',
      {
        method: 'POST',
        body: JSON.stringify({ learnedPairId: pairId, quality: 4 }),
      },
      `auth_token=${jwt}`,
    )
    expect(gradeRes.status).toBe(200)
    const graded = (await gradeRes.json()) as any
    expect(graded.pair.interval).toBe(1)
    expect(graded.pair.repetitions).toBe(1)
  })

  it('POST /api/review/grade returns 400 for invalid quality', async () => {
    const res = await callApp(
      'http://localhost/api/review/grade',
      {
        method: 'POST',
        body: JSON.stringify({ learnedPairId: 'abc', quality: 6 }),
      },
      `auth_token=${jwt}`,
    )
    expect(res.status).toBe(400)
  })

  it('POST /api/review/grade returns 404 for unknown pair', async () => {
    const res = await callApp(
      'http://localhost/api/review/grade',
      {
        method: 'POST',
        body: JSON.stringify({ learnedPairId: 'nonexistent', quality: 4 }),
      },
      `auth_token=${jwt}`,
    )
    expect(res.status).toBe(404)
  })

  it('POST /api/vocab/reset resets a pair to learning', async () => {
    const savedRes = await callApp(
      'http://localhost/api/vocab/save',
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'en',
          target: 'vi',
          sourceText: 'reset',
          targetText: 'đặt lại',
        }),
      },
      `auth_token=${jwt}`,
    )
    const saved = (await savedRes.json()) as any
    const pairId = saved.pair.id

    // Grade it first
    await callApp(
      'http://localhost/api/review/grade',
      {
        method: 'POST',
        body: JSON.stringify({ learnedPairId: pairId, quality: 5 }),
      },
      `auth_token=${jwt}`,
    )

    // Reset it
    const resetRes = await callApp(
      'http://localhost/api/vocab/reset',
      {
        method: 'POST',
        body: JSON.stringify({ learnedPairId: pairId }),
      },
      `auth_token=${jwt}`,
    )
    expect(resetRes.status).toBe(200)
    const reset = (await resetRes.json()) as any
    expect(reset.pair.interval).toBe(0)
    expect(reset.pair.repetitions).toBe(0)
    expect(reset.pair.ease).toBe(2.5)
    expect(reset.pair.status).toBe('learning')
  })

  it('GET /api/review/due returns due cards', async () => {
    await callApp(
      'http://localhost/api/vocab/save',
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'en',
          target: 'vi',
          sourceText: 'apple',
          targetText: 'táo',
        }),
      },
      `auth_token=${jwt}`,
    )
    await callApp(
      'http://localhost/api/vocab/save',
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'en',
          target: 'vi',
          sourceText: 'banana',
          targetText: 'chuối',
        }),
      },
      `auth_token=${jwt}`,
    )

    const res = await callApp('http://localhost/api/review/due', {}, `auth_token=${jwt}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.pairs.length).toBe(2)
  })
})
