import { Hono } from 'hono'
import { SUPPORTED_LOCALES } from '@vocab/shared'
import { z } from 'zod'
import type { Bindings, Variables } from '../env'
import { requireAuth } from '../middleware/auth'
import { sm2 } from '../services/spacedRepetition'
import { t } from '../i18n'

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// --- Stats ---

router.get('/review/stats', requireAuth(), async (c) => {
  const userId = c.get('userId')!

  const [dueRow, learningRow, masteredRow, totalRow] = await Promise.all([
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM learned_pairs WHERE user_id = ? AND (next_review IS NULL OR next_review <= date('now'))",
    )
      .bind(userId)
      .first<{ count: number }>(),
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM learned_pairs WHERE user_id = ? AND status = 'learning'",
    )
      .bind(userId)
      .first<{ count: number }>(),
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM learned_pairs WHERE user_id = ? AND status = 'mastered'",
    )
      .bind(userId)
      .first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM learned_pairs WHERE user_id = ?')
      .bind(userId)
      .first<{ count: number }>(),
  ])

  return c.json({
    dueCount: dueRow?.count ?? 0,
    learningCount: learningRow?.count ?? 0,
    masteredCount: masteredRow?.count ?? 0,
    totalCount: totalRow?.count ?? 0,
  })
})

// --- Due cards ---

router.get('/review/due', requireAuth(), async (c) => {
  const userId = c.get('userId')!

  const result = await c.env.DB.prepare(
    `SELECT id, user_id, source, target, source_text, target_text, is_phrase,
            ipa, pos, example_source, example_target,
            ease, interval, repetitions, next_review, last_seen, status, created_at, updated_at, review_version
     FROM learned_pairs
     WHERE user_id = ? AND (next_review IS NULL OR next_review <= date('now'))
     ORDER BY ease ASC
     LIMIT 20`,
  )
    .bind(userId)
    .all()

  return c.json({ pairs: result.results ?? [] })
})

// --- Grade a review ---

const gradeSchema = z.object({
  learnedPairId: z.string().min(1).max(128),
  quality: z.number().int().min(0).max(5),
  expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  idempotencyKey: z.string().min(1).max(128),
})

router.post('/review/grade', requireAuth(), async (c) => {
  const userId = c.get('userId')!
  const parsed = gradeSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'validation_error', message: t(c, 'errors.invalid_quality') }, 400)
  }
  const { learnedPairId, quality, expectedVersion, idempotencyKey } = parsed.data
  const canonical = JSON.stringify([learnedPairId, quality, expectedVersion])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const requestHash = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
  const findReplay = () =>
    c.env.DB.prepare(
      'SELECT request_hash, result_json FROM review_logs WHERE user_id = ? AND idempotency_key = ?',
    )
      .bind(userId, idempotencyKey)
      .first<{ request_hash: string; result_json: string }>()
  const conflict = () =>
    c.json(
      { error: 'review_conflict', message: 'Review changed. Reload the card and try again.' },
      409,
    )
  const replayResponse = (replay: { request_hash: string; result_json: string }) =>
    replay.request_hash === requestHash ? c.json(JSON.parse(replay.result_json)) : conflict()
  const replay = await findReplay()
  if (replay) return replayResponse(replay)

  const pair = await c.env.DB.prepare(
    'SELECT id, user_id, source, target, source_text, target_text, is_phrase, ipa, pos, example_source, example_target, ease, interval, repetitions, next_review, last_seen, status, created_at, updated_at, review_version FROM learned_pairs WHERE id = ? AND user_id = ?',
  )
    .bind(learnedPairId, userId)
    .first<{
      id: string
      ease: number
      interval: number
      repetitions: number
      review_version: number
      source_text: string
      target_text: string
    }>()
  if (!pair) return c.json({ error: 'not_found', message: t(c, 'errors.pair_not_found') }, 404)
  if (pair.review_version !== expectedVersion) {
    // A concurrent duplicate may have committed after the initial replay lookup.
    const committed = await findReplay()
    return committed ? replayResponse(committed) : conflict()
  }

  const result = sm2(quality, pair)
  const now = new Date().toISOString()
  const logId = crypto.randomUUID()
  const response = {
    pair: {
      ...pair,
      ease: result.ease,
      interval: result.interval,
      repetitions: result.repetitions,
      next_review: result.nextReview,
      last_seen: now,
      status: result.status,
      updated_at: now,
      review_version: expectedVersion + 1,
    },
  }
  // D1 batches execute transactionally. The operation marker ensures only the CAS winner
  // can insert a log. A failed insert rolls back the preceding pair update.
  const batch = await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE learned_pairs SET ease = ?, interval = ?, repetitions = ?,
      next_review = ?, last_seen = ?, status = ?, updated_at = ?,
      review_version = review_version + 1, last_review_id = ?
      WHERE id = ? AND user_id = ? AND review_version = ?
      AND NOT EXISTS (SELECT 1 FROM review_logs WHERE user_id = ? AND idempotency_key = ?)`,
    ).bind(
      result.ease,
      result.interval,
      result.repetitions,
      result.nextReview,
      now,
      result.status,
      now,
      logId,
      learnedPairId,
      userId,
      expectedVersion,
      userId,
      idempotencyKey,
    ),
    c.env.DB.prepare(
      `INSERT INTO review_logs
      (id, user_id, learned_pair_id, source_text, target_text, quality, reviewed_at,
       idempotency_key, request_hash, result_json)
      SELECT ?, user_id, id, source_text, target_text, ?, ?, ?, ?, ? FROM learned_pairs
      WHERE id = ? AND user_id = ? AND last_review_id = ? AND review_version = ?`,
    ).bind(
      logId,
      quality,
      now,
      idempotencyKey,
      requestHash,
      JSON.stringify(response),
      learnedPairId,
      userId,
      logId,
      expectedVersion + 1,
    ),
  ])
  if (batch[0].meta.changes === 1 && batch[1].meta.changes === 1) return c.json(response)
  const committed = await findReplay()
  return committed ? replayResponse(committed) : conflict()
})

// --- Save a new pair ---

const saveSchema = z.object({
  source: z.enum(SUPPORTED_LOCALES),
  target: z.enum(SUPPORTED_LOCALES),
  sourceText: z.string().min(1).max(2000),
  targetText: z.string().min(1).max(2000),
  isPhrase: z.boolean().optional().default(false),
  ipa: z.string().max(2000).optional(),
  pos: z.string().max(2000).optional(),
  exampleSource: z.string().max(2000).optional(),
  exampleTarget: z.string().max(2000).optional(),
})

router.post('/vocab/save', requireAuth(), async (c) => {
  const userId = c.get('userId')!
  const body = await c.req.json().catch(() => null)
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'validation_error', message: t(c, 'errors.validation_error') }, 400)
  }

  const {
    source,
    target,
    sourceText,
    targetText,
    isPhrase,
    ipa,
    pos,
    exampleSource,
    exampleTarget,
  } = parsed.data
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await c.env.DB.prepare(
    `INSERT INTO learned_pairs (id, user_id, source, target, source_text, target_text, is_phrase, ipa, pos, example_source, example_target, ease, interval, repetitions, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2.5, 0, 0, 'learning', ?, ?)`,
  )
    .bind(
      id,
      userId,
      source,
      target,
      sourceText,
      targetText,
      isPhrase ? 1 : 0,
      ipa ?? null,
      pos ?? null,
      exampleSource ?? null,
      exampleTarget ?? null,
      now,
      now,
    )
    .run()

  const pair = await c.env.DB.prepare(
    'SELECT id, user_id, source, target, source_text, target_text, is_phrase, ipa, pos, example_source, example_target, ease, interval, repetitions, next_review, last_seen, status, created_at, updated_at, review_version FROM learned_pairs WHERE id = ? AND user_id = ?',
  )
    .bind(id, userId)
    .first()

  return c.json({ pair })
})

// --- Reset a pair ---

router.post('/vocab/reset', requireAuth(), async (c) => {
  const userId = c.get('userId')!
  const parsed = z
    .object({ learnedPairId: z.string().min(1).max(128) })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'validation_error', message: t(c, 'errors.validation_error') }, 400)
  }

  const body = parsed.data
  const pair = await c.env.DB.prepare(
    'SELECT id, user_id FROM learned_pairs WHERE id = ? AND user_id = ?',
  )
    .bind(body.learnedPairId, userId)
    .first<{ id: string; user_id: string }>()

  if (!pair) {
    return c.json({ error: 'not_found', message: t(c, 'errors.pair_not_found') }, 404)
  }

  const now = new Date().toISOString()
  await c.env.DB.prepare(
    `UPDATE learned_pairs SET ease = 2.5, interval = 0, repetitions = 0, next_review = NULL, status = 'learning', updated_at = ?, review_version = review_version + 1, last_review_id = NULL WHERE id = ? AND user_id = ?`,
  )
    .bind(now, body.learnedPairId, userId)
    .run()

  const updated = await c.env.DB.prepare(
    'SELECT id, user_id, source, target, source_text, target_text, is_phrase, ipa, pos, example_source, example_target, ease, interval, repetitions, next_review, last_seen, status, created_at, updated_at, review_version FROM learned_pairs WHERE id = ? AND user_id = ?',
  )
    .bind(body.learnedPairId, userId)
    .first()

  return c.json({ pair: updated })
})

// --- Review history ---

router.get('/review/history/stats', requireAuth(), async (c) => {
  const userId = c.get('userId')!

  const [totalResult, todayResult, weekResult, avgResult] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM review_logs WHERE user_id = ?')
      .bind(userId)
      .first<{ count: number }>(),
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM review_logs WHERE user_id = ? AND reviewed_at >= date('now')",
    )
      .bind(userId)
      .first<{ count: number }>(),
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM review_logs WHERE user_id = ? AND reviewed_at >= datetime('now', '-7 days')",
    )
      .bind(userId)
      .first<{ count: number }>(),
    c.env.DB.prepare('SELECT COALESCE(AVG(quality), 0) as avg FROM review_logs WHERE user_id = ?')
      .bind(userId)
      .first<{ avg: number }>(),
  ])

  return c.json({
    totalReviews: totalResult?.count ?? 0,
    todayReviews: todayResult?.count ?? 0,
    thisWeek: weekResult?.count ?? 0,
    avgQuality: Math.round((avgResult?.avg ?? 0) * 10) / 10,
  })
})

router.get('/review/history', requireAuth(), async (c) => {
  const userId = c.get('userId')!
  const page = Math.min(100000, Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10) || 20))
  const offset = (page - 1) * limit

  const countResult = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM review_logs WHERE user_id = ?',
  )
    .bind(userId)
    .first<{ count: number }>()

  const logsResult = await c.env.DB.prepare(
    'SELECT id, learned_pair_id, source_text, target_text, quality, reviewed_at FROM review_logs WHERE user_id = ? ORDER BY reviewed_at DESC LIMIT ? OFFSET ?',
  )
    .bind(userId, limit, offset)
    .all()

  const logs = (logsResult.results ?? []).map((row: any) => ({
    id: row.id,
    learnedPairId: row.learned_pair_id,
    source: row.source_text,
    target: row.target_text,
    quality: row.quality,
    reviewedAt: row.reviewed_at,
  }))

  return c.json({
    logs,
    total: countResult?.count ?? 0,
    page,
    limit,
  })
})

// --- Vocabulary list ---

router.get('/vocab', requireAuth(), async (c) => {
  const userId = c.get('userId')!
  const search = c.req.query('search') ?? ''
  if (search.length > 2000) return c.json({ error: 'invalid_payload' }, 400)
  const page = Math.min(100000, Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10) || 20))
  const offset = (page - 1) * limit

  let countSql = 'SELECT COUNT(*) as count FROM learned_pairs WHERE user_id = ?'
  let listSql = `SELECT id, user_id, source, target, source_text, target_text, is_phrase,
            ipa, pos, example_source, example_target,
            ease, interval, repetitions, next_review, last_seen, status, created_at, updated_at, review_version
     FROM learned_pairs
     WHERE user_id = ?`
  const countParams: unknown[] = [userId]
  const listParams: unknown[] = [userId]

  if (search) {
    const searchClause = ' AND (source_text LIKE ? OR target_text LIKE ?)'
    const searchPattern = `%${search}%`
    countSql += searchClause
    listSql += searchClause
    countParams.push(searchPattern, searchPattern)
    listParams.push(searchPattern, searchPattern)
  }

  listSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  listParams.push(limit, offset)

  const [countRow, pairsResult] = await Promise.all([
    c.env.DB.prepare(countSql)
      .bind(...countParams)
      .first<{ count: number }>(),
    c.env.DB.prepare(listSql)
      .bind(...listParams)
      .all<Record<string, unknown>>(),
  ])

  return c.json({
    pairs: pairsResult.results ?? [],
    total: countRow?.count ?? 0,
    page,
    limit,
  })
})

// --- Delete a vocabulary pair ---

router.delete('/vocab/:id', requireAuth(), async (c) => {
  const userId = c.get('userId')!
  const pairId = c.req.param('id')

  const pair = await c.env.DB.prepare(
    'SELECT id, user_id FROM learned_pairs WHERE id = ? AND user_id = ?',
  )
    .bind(pairId, userId)
    .first<{ id: string; user_id: string }>()

  if (!pair) {
    return c.json({ error: 'not_found', message: t(c, 'errors.pair_not_found') }, 404)
  }

  // Preserve the existing explicit deletion policy, with both deletions atomic.
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM review_logs WHERE learned_pair_id = ? AND user_id = ?').bind(
      pairId,
      userId,
    ),
    c.env.DB.prepare('DELETE FROM learned_pairs WHERE id = ? AND user_id = ?').bind(pairId, userId),
  ])

  return c.json({ success: true })
})

// --- Edit a vocabulary pair ---

const editSchema = z.object({
  sourceText: z.string().min(1).max(2000),
  targetText: z.string().min(1).max(2000),
  ipa: z.string().max(2000).optional(),
  pos: z.string().max(2000).optional(),
  exampleSource: z.string().max(2000).optional(),
  exampleTarget: z.string().max(2000).optional(),
})

router.put('/vocab/:id', requireAuth(), async (c) => {
  const userId = c.get('userId')!
  const pairId = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'validation_error', message: t(c, 'errors.validation_error') }, 400)
  }

  const pair = await c.env.DB.prepare(
    'SELECT id, user_id FROM learned_pairs WHERE id = ? AND user_id = ?',
  )
    .bind(pairId, userId)
    .first<{ id: string; user_id: string }>()

  if (!pair) {
    return c.json({ error: 'not_found', message: t(c, 'errors.pair_not_found') }, 404)
  }

  const { sourceText, targetText, ipa, pos, exampleSource, exampleTarget } = parsed.data
  const now = new Date().toISOString()

  const setClauses: string[] = ['source_text = ?', 'target_text = ?']
  const bindValues: unknown[] = [sourceText, targetText]
  const optionalFields: [string, string | undefined][] = [
    ['ipa', ipa],
    ['pos', pos],
    ['example_source', exampleSource],
    ['example_target', exampleTarget],
  ]
  for (const [col, val] of optionalFields) {
    if (val !== undefined) {
      setClauses.push(`${col} = ?`)
      bindValues.push(val)
    }
  }
  setClauses.push('updated_at = ?', 'review_version = review_version + 1', 'last_review_id = NULL')
  bindValues.push(now, pairId, userId)

  await c.env.DB.prepare(
    `UPDATE learned_pairs SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
  )
    .bind(...bindValues)
    .run()

  const updated = await c.env.DB.prepare(
    'SELECT id, user_id, source, target, source_text, target_text, is_phrase, ipa, pos, example_source, example_target, ease, interval, repetitions, next_review, last_seen, status, created_at, updated_at, review_version FROM learned_pairs WHERE id = ? AND user_id = ?',
  )
    .bind(pairId, userId)
    .first()

  return c.json({ pair: updated })
})

export { router as reviewRouter }
