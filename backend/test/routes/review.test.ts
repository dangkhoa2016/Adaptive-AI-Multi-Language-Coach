import { describe, expect, it, beforeEach } from 'vitest'
import { env as cloudflareEnv } from 'cloudflare:test'
import type { Bindings } from '../../src/env'
const workerEnv = cloudflareEnv as unknown as Bindings

async function callApp(url: string, init?: RequestInit, cookie?: string): Promise<Response> {
  const { default: app } = await import('../../src/index')
  const env = {
    ...workerEnv,
    DB: workerEnv.DB,
    PUBLIC_APP_ORIGIN: 'http://localhost',
    ENVIRONMENT: 'local',
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
  headers.set('origin', 'http://localhost')
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
    await workerEnv.DB.prepare('DELETE FROM review_logs').run()
    await workerEnv.DB.prepare('DELETE FROM learned_pairs').run()
    await workerEnv.DB.prepare('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)')
      .bind(userId, 'review@test.com')
      .run()
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
        body: JSON.stringify({
          learnedPairId: pairId,
          quality: 4,
          expectedVersion: 0,
          idempotencyKey: crypto.randomUUID(),
        }),
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
        body: JSON.stringify({
          learnedPairId: 'nonexistent',
          quality: 4,
          expectedVersion: 0,
          idempotencyKey: crypto.randomUUID(),
        }),
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
        body: JSON.stringify({
          learnedPairId: pairId,
          quality: 5,
          expectedVersion: 0,
          idempotencyKey: crypto.randomUUID(),
        }),
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
        body: JSON.stringify({
          learnedPairId: pairId,
          quality: 4,
          expectedVersion: 0,
          idempotencyKey: crypto.randomUUID(),
        }),
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
        body: JSON.stringify({
          learnedPairId: pairId,
          quality: 5,
          expectedVersion: 0,
          idempotencyKey: crypto.randomUUID(),
        }),
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

  it("DELETE /api/vocab/:id returns 404 for other user's pair", async () => {
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
    expect(res.status).toBe(404)
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

  it("PUT /api/vocab/:id returns 404 for other user's pair", async () => {
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
    expect(res.status).toBe(404)
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
