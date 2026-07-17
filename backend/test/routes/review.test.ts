import { describe, expect, it, beforeEach } from 'vitest'

const users = new Map<string, { id: string; email: string }>()
const learnedPairs = new Map<string, Array<Record<string, unknown>>>()
const reviewLogs = new Map<string, Array<Record<string, unknown>>>()

function createMockDB(): D1Database {
  return {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        all: async <T>() => {
          if (sql.includes('FROM learned_pairs') && sql.includes('WHERE user_id =')) {
            const uid = values[0] as string
            let pairs = learnedPairs.get(uid) ?? []
            if (sql.includes('next_review IS NULL OR next_review <= date')) {
              const today = new Date().toISOString().split('T')[0]
              return {
                results: pairs.filter(
                  (p: any) => !p.next_review || p.next_review <= today,
                ) as unknown as T[],
                success: true,
              }
            }
            // Apply search filter for vocab list
            if (sql.includes('LIKE')) {
              const pattern = (values[1] as string).replace(/%/g, '')
              pairs = pairs.filter(
                (p: any) =>
                  (p.source_text && String(p.source_text).includes(pattern)) ||
                  (p.target_text && String(p.target_text).includes(pattern)),
              )
            }
            // Apply pagination
            if (sql.includes('LIMIT') && sql.includes('OFFSET')) {
              const limitIdx = values.length - 2
              const offsetIdx = values.length - 1
              const l = values[limitIdx] as number
              const o = values[offsetIdx] as number
              return { results: pairs.slice(o, o + l) as unknown as T[], success: true }
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
          if (sql.includes('FROM review_logs') && sql.includes('WHERE user_id =')) {
            const uid = values[0] as string
            const logs = reviewLogs.get(uid) ?? []
            const limit = values[1] as number
            const offset = values[2] as number
            return {
              results: logs.slice(offset, offset + limit) as unknown as T[],
              success: true,
            }
          }
          return { results: [] as unknown as T[], success: true }
        },
        first: async <T>() => {
          const uid = values[0] as string
          if (sql.includes('SELECT COUNT')) {
            let pairs = learnedPairs.get(uid) ?? []
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
            // Handle search filter for vocab count
            if (sql.includes('LIKE')) {
              const pattern = (values[1] as string).replace(/%/g, '')
              pairs = pairs.filter(
                (p: any) =>
                  (p.source_text && String(p.source_text).includes(pattern)) ||
                  (p.target_text && String(p.target_text).includes(pattern)),
              )
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
          // Review logs COUNT/AVG
          if (sql.includes('FROM review_logs') && (sql.includes('COUNT') || sql.includes('AVG'))) {
            const uid = values[0] as string
            const logs = reviewLogs.get(uid) ?? []
            if (sql.includes('AVG(quality)')) {
              if (logs.length === 0) return { avg: 0 } as unknown as T
              const avg = logs.reduce((s: number, l: any) => s + l.quality, 0) / logs.length
              return { avg } as unknown as T
            }
            if (sql.includes("reviewed_at >= date('now')")) {
              const today = new Date().toISOString().split('T')[0]
              return {
                count: logs.filter((l: any) => l.reviewed_at >= today).length,
              } as unknown as T
            }
            if (sql.includes("reviewed_at >= datetime('now', '-7 days')")) {
              const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
              return {
                count: logs.filter((l: any) => l.reviewed_at >= weekAgo).length,
              } as unknown as T
            }
            return { count: logs.length } as unknown as T
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
          } else if (sql.includes('INSERT INTO review_logs')) {
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
                  let lit = valsRaw[i]
                  if (lit.startsWith("'") && lit.endsWith("'")) {
                    record[col] = lit.slice(1, -1)
                  } else if (lit === 'NULL') {
                    record[col] = null
                  } else if (/^\d+$/.test(lit)) {
                    record[col] = Number(lit)
                  } else {
                    record[col] = lit
                  }
                }
              })
              const uid = record.user_id as string
              if (!reviewLogs.has(uid)) {
                reviewLogs.set(uid, [])
              }
              reviewLogs.get(uid)!.push(record)
            }
          } else if (sql.includes('UPDATE learned_pairs')) {
            const pairId = values[values.length - 1] as string
            for (const [, pairs] of learnedPairs) {
              const idx = pairs.findIndex((p: any) => p.id === pairId)
              if (idx !== -1) {
                const existing = pairs[idx] as Record<string, unknown>
                if (values.length <= 3) {
                  // Reset: ease = 2.5, interval = 0, repetitions = 0, next_review = NULL, status = 'learning', updated_at = ?
                  existing.ease = 2.5
                  existing.interval = 0
                  existing.repetitions = 0
                  existing.next_review = null
                  existing.status = 'learning'
                  existing.updated_at = values[0]
                } else if (typeof values[0] === 'number') {
                  // Grade update
                  const gradeClauses = [
                    'ease',
                    'interval',
                    'repetitions',
                    'next_review',
                    'last_seen',
                    'status',
                    'updated_at',
                  ]
                  gradeClauses.forEach((col, i) => {
                    existing[col] = values[i]
                  })
                } else {
                  // Edit update — parse SET column names from SQL
                  const setMatch = sql.match(/SET (.+?) WHERE/i)
                  if (setMatch) {
                    const setCols = setMatch[1].split(',').map((s) => s.trim().split('=')[0].trim())
                    setCols.forEach((col, i) => {
                      existing[col] = values[i]
                    })
                  }
                }
              }
            }
          } else if (sql.includes('DELETE FROM review_logs')) {
            const lpId = values[0] as string
            for (const [, logs] of reviewLogs) {
              const idx = logs.findIndex((l: any) => l.learned_pair_id === lpId)
              if (idx !== -1) logs.splice(idx, 1)
            }
          } else if (sql.includes('DELETE FROM learned_pairs')) {
            const pid = values[0] as string
            for (const [, pairs] of learnedPairs) {
              const idx = pairs.findIndex((p: any) => p.id === pid)
              if (idx !== -1) pairs.splice(idx, 1)
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
    reviewLogs.clear()
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

  it('GET /api/review/history returns empty list initially', async () => {
    const res = await callApp('http://localhost/api/review/history', {}, `auth_token=${jwt}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.logs).toEqual([])
    expect(body.total).toBe(0)
  })

  it('GET /api/review/history returns logged grades', async () => {
    const savedRes = await callApp(
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
    const saved = (await savedRes.json()) as any
    const pairId = saved.pair.id

    await callApp(
      'http://localhost/api/review/grade',
      {
        method: 'POST',
        body: JSON.stringify({ learnedPairId: pairId, quality: 4 }),
      },
      `auth_token=${jwt}`,
    )

    const res = await callApp('http://localhost/api/review/history', {}, `auth_token=${jwt}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.logs.length).toBe(1)
    expect(body.logs[0].quality).toBe(4)
    expect(body.logs[0].source).toBe('hello')
    expect(body.logs[0].target).toBe('xin chào')
    expect(body.total).toBe(1)
  })

  it('GET /api/review/history/stats returns correct counts', async () => {
    const savedRes = await callApp(
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
    const saved = (await savedRes.json()) as any
    const pairId = saved.pair.id

    await callApp(
      'http://localhost/api/review/grade',
      {
        method: 'POST',
        body: JSON.stringify({ learnedPairId: pairId, quality: 5 }),
      },
      `auth_token=${jwt}`,
    )

    const statsRes = await callApp(
      'http://localhost/api/review/history/stats',
      {},
      `auth_token=${jwt}`,
    )
    expect(statsRes.status).toBe(200)
    const stats = (await statsRes.json()) as any
    expect(stats.totalReviews).toBe(1)
    expect(stats.todayReviews).toBe(1)
    expect(stats.thisWeek).toBe(1)
    expect(stats.avgQuality).toBe(5)
  })

  it('GET /api/review/history returns 401 without auth', async () => {
    const res = await callApp('http://localhost/api/review/history')
    expect(res.status).toBe(401)
  })

  it('GET /api/review/history/stats returns 401 without auth', async () => {
    const res = await callApp('http://localhost/api/review/history/stats')
    expect(res.status).toBe(401)
  })

  // --- Vocabulary management ---

  it('GET /api/vocab returns empty list for new user', async () => {
    const res = await callApp('http://localhost/api/vocab', {}, `auth_token=${jwt}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.pairs).toEqual([])
    expect(body.total).toBe(0)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it('GET /api/vocab returns saved pairs', async () => {
    await callApp(
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
    await callApp(
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

    const res = await callApp('http://localhost/api/vocab', {}, `auth_token=${jwt}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.pairs.length).toBe(2)
    expect(body.total).toBe(2)
  })

  it('GET /api/vocab?search= filters correctly', async () => {
    await callApp(
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
    await callApp(
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

    const res = await callApp('http://localhost/api/vocab?search=world', {}, `auth_token=${jwt}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.pairs.length).toBe(1)
    expect(body.pairs[0].source_text).toBe('world')
    expect(body.total).toBe(1)
  })

  it('GET /api/vocab paginates correctly', async () => {
    for (let i = 0; i < 5; i++) {
      await callApp(
        'http://localhost/api/vocab/save',
        {
          method: 'POST',
          body: JSON.stringify({
            source: 'en',
            target: 'vi',
            sourceText: `word${i}`,
            targetText: `từ${i}`,
          }),
        },
        `auth_token=${jwt}`,
      )
    }

    const page1 = await callApp(
      'http://localhost/api/vocab?page=1&limit=2',
      {},
      `auth_token=${jwt}`,
    )
    const body1 = (await page1.json()) as any
    expect(body1.pairs.length).toBe(2)
    expect(body1.total).toBe(5)
    expect(body1.page).toBe(1)

    const page2 = await callApp(
      'http://localhost/api/vocab?page=2&limit=2',
      {},
      `auth_token=${jwt}`,
    )
    const body2 = (await page2.json()) as any
    expect(body2.pairs.length).toBe(2)
    expect(body2.page).toBe(2)
  })

  it('DELETE /api/vocab/:id deletes and returns success', async () => {
    const saved = await callApp(
      'http://localhost/api/vocab/save',
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'en',
          target: 'vi',
          sourceText: 'delete',
          targetText: 'xóa',
        }),
      },
      `auth_token=${jwt}`,
    )
    const pair = (await saved.json()) as any
    const pairId = pair.pair.id

    const del = await callApp(
      `http://localhost/api/vocab/${pairId}`,
      { method: 'DELETE' },
      `auth_token=${jwt}`,
    )
    expect(del.status).toBe(200)
    const delBody = (await del.json()) as any
    expect(delBody.success).toBe(true)

    // verify it's gone
    const list = await callApp('http://localhost/api/vocab', {}, `auth_token=${jwt}`)
    const listBody = (await list.json()) as any
    expect(listBody.pairs.length).toBe(0)
  })

  it('DELETE /api/vocab/:id returns 404 for unknown id', async () => {
    const res = await callApp(
      'http://localhost/api/vocab/nonexistent',
      { method: 'DELETE' },
      `auth_token=${jwt}`,
    )
    expect(res.status).toBe(404)
  })

  it("DELETE /api/vocab/:id returns 403 for other user's pair", async () => {
    const otherUserId = 'other-user'
    const { createJwt } = await import('../../src/services/auth')
    const otherJwt = await createJwt(otherUserId, 'test-jwt-secret-32-chars-long!!')

    const saved = await callApp(
      'http://localhost/api/vocab/save',
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'en',
          target: 'vi',
          sourceText: 'other',
          targetText: 'khác',
        }),
      },
      `auth_token=${jwt}`,
    )
    const pair = (await saved.json()) as any
    const pairId = pair.pair.id

    const res = await callApp(
      `http://localhost/api/vocab/${pairId}`,
      { method: 'DELETE' },
      `auth_token=${otherJwt}`,
    )
    expect(res.status).toBe(403)
  })

  it('GET /api/vocab returns 401 without auth', async () => {
    const res = await callApp('http://localhost/api/vocab')
    expect(res.status).toBe(401)
  })

  it('DELETE /api/vocab/:id returns 401 without auth', async () => {
    const res = await callApp('http://localhost/api/vocab/some-id', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })

  // --- Edit vocabulary pair ---

  it('PUT /api/vocab/:id updates fields and returns updated pair', async () => {
    const saved = await callApp(
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
    const pair = (await saved.json()) as any
    const pairId = pair.pair.id

    const res = await callApp(
      `http://localhost/api/vocab/${pairId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          sourceText: 'hi',
          targetText: 'chào',
          ipa: '/haɪ/',
          pos: 'interjection',
          exampleSource: 'Hi there!',
          exampleTarget: 'Chào bạn!',
        }),
      },
      `auth_token=${jwt}`,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.pair.source_text).toBe('hi')
    expect(body.pair.target_text).toBe('chào')
    expect(body.pair.ipa).toBe('/haɪ/')
    expect(body.pair.pos).toBe('interjection')
    expect(body.pair.example_source).toBe('Hi there!')
    expect(body.pair.example_target).toBe('Chào bạn!')
  })

  it('PUT /api/vocab/:id returns 404 for unknown id', async () => {
    const res = await callApp(
      'http://localhost/api/vocab/nonexistent',
      { method: 'PUT', body: JSON.stringify({ sourceText: 'a', targetText: 'b' }) },
      `auth_token=${jwt}`,
    )
    expect(res.status).toBe(404)
  })

  it("PUT /api/vocab/:id returns 403 for other user's pair", async () => {
    const otherUserId = 'other-user-edit'
    const { createJwt } = await import('../../src/services/auth')
    const otherJwt = await createJwt(otherUserId, 'test-jwt-secret-32-chars-long!!')

    const saved = await callApp(
      'http://localhost/api/vocab/save',
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'en',
          target: 'vi',
          sourceText: 'owned',
          targetText: 'của tôi',
        }),
      },
      `auth_token=${jwt}`,
    )
    const pair = (await saved.json()) as any

    const res = await callApp(
      `http://localhost/api/vocab/${pair.pair.id}`,
      { method: 'PUT', body: JSON.stringify({ sourceText: 'a', targetText: 'b' }) },
      `auth_token=${otherJwt}`,
    )
    expect(res.status).toBe(403)
  })

  it('PUT /api/vocab/:id returns 400 with missing sourceText', async () => {
    const saved = await callApp(
      'http://localhost/api/vocab/save',
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'en',
          target: 'vi',
          sourceText: 'test',
          targetText: 'kiểm tra',
        }),
      },
      `auth_token=${jwt}`,
    )
    const pair = (await saved.json()) as any

    const res = await callApp(
      `http://localhost/api/vocab/${pair.pair.id}`,
      { method: 'PUT', body: JSON.stringify({ targetText: 'b' }) },
      `auth_token=${jwt}`,
    )
    expect(res.status).toBe(400)
  })

  it('PUT /api/vocab/:id optional fields not sent keep existing values', async () => {
    const saved = await callApp(
      'http://localhost/api/vocab/save',
      {
        method: 'POST',
        body: JSON.stringify({
          source: 'en',
          target: 'vi',
          sourceText: 'keep',
          targetText: 'giữ',
          ipa: '/kiːp/',
          pos: 'verb',
          exampleSource: 'Keep it',
          exampleTarget: 'Giữ nó',
        }),
      },
      `auth_token=${jwt}`,
    )
    const pair = (await saved.json()) as any

    // Only update sourceText
    const res = await callApp(
      `http://localhost/api/vocab/${pair.pair.id}`,
      { method: 'PUT', body: JSON.stringify({ sourceText: 'kept', targetText: 'đã giữ' }) },
      `auth_token=${jwt}`,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.pair.source_text).toBe('kept')
    expect(body.pair.target_text).toBe('đã giữ')
    expect(body.pair.ipa).toBe('/kiːp/') // unchanged
    expect(body.pair.pos).toBe('verb') // unchanged
    expect(body.pair.example_source).toBe('Keep it') // unchanged
    expect(body.pair.example_target).toBe('Giữ nó') // unchanged
  })

  it('PUT /api/vocab/:id returns 401 without auth', async () => {
    const res = await callApp('http://localhost/api/vocab/some-id', {
      method: 'PUT',
      body: JSON.stringify({ sourceText: 'a', targetText: 'b' }),
    })
    expect(res.status).toBe(401)
  })
})
