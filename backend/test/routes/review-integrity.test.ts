import { beforeEach, describe, expect, it } from 'vitest'
import { env as workerEnv } from 'cloudflare:test'
import type { Bindings } from '../../src/env'
const env = workerEnv as unknown as Bindings
import { Hono } from 'hono'
import { reviewRouter } from '../../src/routes/review'
const app = new Hono().route('/api', reviewRouter)
import { createJwt } from '../../src/services/auth'

const uid = 'review-integrity-owner'
const secret = 'synthetic-review-integrity-secret-32'
let jwt: string
let pairId: string
async function request(path: string, body?: unknown, token = jwt, method = 'POST') {
  return app.fetch(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost',
        Cookie: `auth_token=${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    {
      ...env,
      JWT_SECRET: secret,
      PUBLIC_APP_ORIGIN: 'http://localhost',
      ENVIRONMENT: 'local',
      RATE_LIMITER_API: { limit: async () => ({ success: true }) },
      RATE_LIMITER_AUTH: { limit: async () => ({ success: true }) },
    } as never,
    { waitUntil() {}, passThroughOnException() {}, props: {} },
  )
}
function grade(key = crypto.randomUUID(), expectedVersion = 0, quality = 4) {
  return { learnedPairId: pairId, quality, expectedVersion, idempotencyKey: key }
}
async function state() {
  return env.DB.prepare('SELECT * FROM learned_pairs WHERE id = ? AND user_id = ?')
    .bind(pairId, uid)
    .first()
}
async function logs() {
  return env.DB.prepare('SELECT * FROM review_logs WHERE user_id = ?').bind(uid).all()
}
beforeEach(async () => {
  await env.DB.prepare('DROP TRIGGER IF EXISTS fail_review_log').run()
  await env.DB.prepare('DELETE FROM review_logs WHERE user_id = ?').bind(uid).run()
  await env.DB.prepare('DELETE FROM learned_pairs WHERE user_id = ?').bind(uid).run()
  await env.DB.prepare('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)')
    .bind(uid, 'integrity@synthetic.test')
    .run()
  jwt = await createJwt(uid, secret)
  const saved = await request('/vocab/save', {
    source: 'en',
    target: 'vi',
    sourceText: 'test',
    targetText: 'thử',
  })
  expect(saved.status).toBe(200)
  pairId = ((await saved.json()) as { pair: { id: string } }).pair.id
})
describe('review integrity using real D1', () => {
  it.each(['/review/grade', '/vocab/save', '/vocab/reset'])(
    'rejects malformed and null JSON at %s with400',
    async (path) => {
      for (const body of ['{', 'null']) {
        const response = await app.fetch(
          new Request('http://localhost/api' + path, {
            method: 'POST',
            headers: { Cookie: `auth_token=${jwt}`, 'Content-Type': 'application/json' },
            body,
          }),
          { ...env, JWT_SECRET: secret },
        )
        expect(response.status).toBe(400)
      }
    },
  )
  it('rejects invalid vocabulary locales and oversized text', async () => {
    for (const body of [
      { source: 'airport', target: 'vi', sourceText: 'airport', targetText: 'sân bay' },
      { source: 'en', target: 'vi', sourceText: 'x'.repeat(2001), targetText: 'thử' },
    ])
      expect((await request('/vocab/save', body)).status).toBe(400)
  })
  it('requires an explicit version and idempotency key', async () => {
    const res = await request('/review/grade', { learnedPairId: pairId, quality: 4 })
    expect(res.status).toBe(400)
    expect((await state())?.repetitions).toBe(0)
  })
  it('rolls back the pair update when log insertion fails', async () => {
    const before = await state()
    await env.DB.prepare(
      "CREATE TRIGGER fail_review_log BEFORE INSERT ON review_logs BEGIN SELECT RAISE(ABORT, 'synthetic log failure'); END",
    ).run()
    try {
      expect((await request('/review/grade', grade())).status).toBe(500)
      expect(await state()).toEqual(before)
      expect((await logs()).results).toHaveLength(0)
    } finally {
      await env.DB.prepare('DROP TRIGGER fail_review_log').run()
    }
  })
  it('allows exactly one of two concurrent grades from the same version', async () => {
    const responses = await Promise.all([
      request('/review/grade', grade()),
      request('/review/grade', grade()),
    ])
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409])
    expect((await state())?.review_version).toBe(1)
    expect((await logs()).results).toHaveLength(1)
  })
  it('replays the same key without advancing twice and rejects a changed payload', async () => {
    const body = grade()
    const first = await request('/review/grade', body)
    expect(first.status).toBe(200)
    const result = await first.json()
    const replay = await request('/review/grade', body)
    expect(replay.status).toBe(200)
    expect(await replay.json()).toEqual(result)
    expect((await request('/review/grade', { ...body, quality: 5 })).status).toBe(409)
    expect((await logs()).results).toHaveLength(1)
  })
  it('handles concurrent duplicate requests as one operation', async () => {
    const body = grade()
    const responses = await Promise.all([
      request('/review/grade', body),
      request('/review/grade', body),
    ])
    expect(responses.map((r) => r.status)).toEqual([200, 200])
    expect(await responses[0].json()).toEqual(await responses[1].json())
    expect((await logs()).results).toHaveLength(1)
  })
  it('rejects stale grades after a grade, reset, or edit', async () => {
    expect((await request('/review/grade', grade())).status).toBe(200)
    expect((await request('/review/grade', grade())).status).toBe(409)
    expect((await request('/vocab/reset', { learnedPairId: pairId })).status).toBe(200)
    expect((await request('/review/grade', grade(crypto.randomUUID(), 1))).status).toBe(409)
    expect(
      (await request(`/vocab/${pairId}`, { sourceText: 'changed', targetText: 'đổi' }, jwt, 'PUT'))
        .status,
    ).toBe(200)
    expect((await request('/review/grade', grade(crypto.randomUUID(), 2))).status).toBe(409)
  })
  it('hides another user’s pair on grade, reset, edit, and delete', async () => {
    const other = await createJwt('review-integrity-other', secret)
    const before = await state()
    expect((await request('/review/grade', grade(), other)).status).toBe(404)
    expect((await request('/vocab/reset', { learnedPairId: pairId }, other)).status).toBe(404)
    expect(
      (await request(`/vocab/${pairId}`, { sourceText: 'x', targetText: 'y' }, other, 'PUT'))
        .status,
    ).toBe(404)
    expect((await request(`/vocab/${pairId}`, undefined, other, 'DELETE')).status).toBe(404)
    expect(await state()).toEqual(before)
  })
  it('keeps replay snapshots stable after a later grade and scopes keys per user', async () => {
    const body = grade('shared-synthetic-key')
    const first = await request('/review/grade', body)
    const snapshot = await first.json()
    expect((await request('/review/grade', grade(crypto.randomUUID(), 1))).status).toBe(200)
    const replay = await request('/review/grade', body)
    expect(replay.status).toBe(200)
    expect(await replay.json()).toEqual(snapshot)
    const otherId = 'review-integrity-second'
    await env.DB.prepare('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)')
      .bind(otherId, 'second@synthetic.test')
      .run()
    const other = await createJwt(otherId, secret)
    const saved = await request(
      '/vocab/save',
      { source: 'en', target: 'vi', sourceText: 'second', targetText: 'hai' },
      other,
    )
    const otherPair = ((await saved.json()) as { pair: { id: string } }).pair.id
    expect(
      (await request('/review/grade', { ...body, learnedPairId: otherPair }, other)).status,
    ).toBe(200)
  })
  it('rejects reuse of one key for a different pair without changing that pair', async () => {
    const body = grade()
    expect((await request('/review/grade', body)).status).toBe(200)
    const saved = await request('/vocab/save', {
      source: 'en',
      target: 'vi',
      sourceText: 'another',
      targetText: 'khác',
    })
    const pair = ((await saved.json()) as { pair: { id: string } }).pair
    expect((await request('/review/grade', { ...body, learnedPairId: pair.id })).status).toBe(409)
    const other = await env.DB.prepare(
      'SELECT repetitions FROM learned_pairs WHERE id = ? AND user_id = ?',
    )
      .bind(pair.id, uid)
      .first()
    expect(other?.repetitions).toBe(0)
  })
  it('preserves the existing deletion policy and cannot replay a deleted pair', async () => {
    const body = grade()
    expect((await request('/review/grade', body)).status).toBe(200)
    expect((await request(`/vocab/${pairId}`, undefined, jwt, 'DELETE')).status).toBe(200)
    expect(await state()).toBeNull()
    expect((await logs()).results).toHaveLength(0)
    expect((await request('/review/grade', body)).status).toBe(404)
  })
})
