import { Hono } from 'hono'
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
            ease, interval, repetitions, next_review, last_seen, status, created_at, updated_at
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
  learnedPairId: z.string().min(1),
  quality: z.number().int().min(0).max(5),
})

router.post('/review/grade', requireAuth(), async (c) => {
  const userId = c.get('userId')!
  const body = await c.req.json()
  const parsed = gradeSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'validation_error', message: t(c, 'errors.invalid_quality') }, 400)
  }

  const { learnedPairId, quality } = parsed.data

  const pair = await c.env.DB.prepare(
    'SELECT id, ease, interval, repetitions, user_id, source_text, target_text FROM learned_pairs WHERE id = ?',
  )
    .bind(learnedPairId)
    .first<{
      id: string
      ease: number
      interval: number
      repetitions: number
      user_id: string
      source_text: string
      target_text: string
    }>()

  if (!pair) {
    return c.json({ error: 'not_found', message: t(c, 'errors.pair_not_found') }, 404)
  }
  if (pair.user_id !== userId) {
    return c.json({ error: 'forbidden', message: t(c, 'errors.forbidden') }, 403)
  }

  const result = sm2(quality, {
    ease: pair.ease,
    interval: pair.interval,
    repetitions: pair.repetitions,
  })
  const now = new Date().toISOString()

  await c.env.DB.prepare(
    `UPDATE learned_pairs
     SET ease = ?, interval = ?, repetitions = ?, next_review = ?, last_seen = ?, status = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      result.ease,
      result.interval,
      result.repetitions,
      result.nextReview,
      now,
      result.status,
      now,
      learnedPairId,
    )
    .run()

  const logId = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO review_logs (id, user_id, learned_pair_id, source_text, target_text, quality, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(logId, userId, learnedPairId, pair.source_text, pair.target_text, quality, now)
    .run()

  const updated = await c.env.DB.prepare(
    'SELECT id, user_id, source, target, source_text, target_text, is_phrase, ipa, pos, example_source, example_target, ease, interval, repetitions, next_review, last_seen, status, created_at, updated_at FROM learned_pairs WHERE id = ?',
  )
    .bind(learnedPairId)
    .first()

  return c.json({ pair: updated })
})

// --- Save a new pair ---

const saveSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  sourceText: z.string().min(1),
  targetText: z.string().min(1),
  isPhrase: z.boolean().optional().default(false),
  ipa: z.string().optional(),
  pos: z.string().optional(),
  exampleSource: z.string().optional(),
  exampleTarget: z.string().optional(),
})

router.post('/vocab/save', requireAuth(), async (c) => {
  const userId = c.get('userId')!
  const body = await c.req.json()
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
    'SELECT id, user_id, source, target, source_text, target_text, is_phrase, ipa, pos, example_source, example_target, ease, interval, repetitions, next_review, last_seen, status, created_at, updated_at FROM learned_pairs WHERE id = ?',
  )
    .bind(id)
    .first()

  return c.json({ pair })
})

// --- Reset a pair ---

router.post('/vocab/reset', requireAuth(), async (c) => {
  const userId = c.get('userId')!
  const body = (await c.req.json()) as { learnedPairId?: string }
  if (!body.learnedPairId) {
    return c.json({ error: 'validation_error', message: t(c, 'errors.validation_error') }, 400)
  }

  const pair = await c.env.DB.prepare('SELECT id, user_id FROM learned_pairs WHERE id = ?')
    .bind(body.learnedPairId)
    .first<{ id: string; user_id: string }>()

  if (!pair) {
    return c.json({ error: 'not_found', message: t(c, 'errors.pair_not_found') }, 404)
  }
  if (pair.user_id !== userId) {
    return c.json({ error: 'forbidden', message: t(c, 'errors.forbidden') }, 403)
  }

  const now = new Date().toISOString()
  await c.env.DB.prepare(
    `UPDATE learned_pairs SET ease = 2.5, interval = 0, repetitions = 0, next_review = NULL, status = 'learning', updated_at = ? WHERE id = ?`,
  )
    .bind(now, body.learnedPairId)
    .run()

  const updated = await c.env.DB.prepare(
    'SELECT id, user_id, source, target, source_text, target_text, is_phrase, ipa, pos, example_source, example_target, ease, interval, repetitions, next_review, last_seen, status, created_at, updated_at FROM learned_pairs WHERE id = ?',
  )
    .bind(body.learnedPairId)
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
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20')))
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
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20')))
  const offset = (page - 1) * limit

  let countSql = 'SELECT COUNT(*) as count FROM learned_pairs WHERE user_id = ?'
  let listSql = `SELECT id, user_id, source, target, source_text, target_text, is_phrase,
            ipa, pos, example_source, example_target,
            ease, interval, repetitions, next_review, last_seen, status, created_at, updated_at
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

  const pair = await c.env.DB.prepare('SELECT id, user_id FROM learned_pairs WHERE id = ?')
    .bind(pairId)
    .first<{ id: string; user_id: string }>()

  if (!pair) {
    return c.json({ error: 'not_found', message: t(c, 'errors.pair_not_found') }, 404)
  }
  if (pair.user_id !== userId) {
    return c.json({ error: 'forbidden', message: t(c, 'errors.forbidden') }, 403)
  }

  // Delete associated review logs first
  await c.env.DB.prepare('DELETE FROM review_logs WHERE learned_pair_id = ?').bind(pairId).run()
  await c.env.DB.prepare('DELETE FROM learned_pairs WHERE id = ?').bind(pairId).run()

  return c.json({ success: true })
})

// --- Edit a vocabulary pair ---

const editSchema = z.object({
  sourceText: z.string().min(1),
  targetText: z.string().min(1),
  ipa: z.string().optional(),
  pos: z.string().optional(),
  exampleSource: z.string().optional(),
  exampleTarget: z.string().optional(),
})

router.put('/vocab/:id', requireAuth(), async (c) => {
  const userId = c.get('userId')!
  const pairId = c.req.param('id')
  const body = await c.req.json()
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'validation_error', message: t(c, 'errors.validation_error') }, 400)
  }

  const pair = await c.env.DB.prepare('SELECT id, user_id FROM learned_pairs WHERE id = ?')
    .bind(pairId)
    .first<{ id: string; user_id: string }>()

  if (!pair) {
    return c.json({ error: 'not_found', message: t(c, 'errors.pair_not_found') }, 404)
  }
  if (pair.user_id !== userId) {
    return c.json({ error: 'forbidden', message: t(c, 'errors.forbidden') }, 403)
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
  setClauses.push('updated_at = ?')
  bindValues.push(now, pairId)

  await c.env.DB.prepare(`UPDATE learned_pairs SET ${setClauses.join(', ')} WHERE id = ?`)
    .bind(...bindValues)
    .run()

  const updated = await c.env.DB.prepare(
    'SELECT id, user_id, source, target, source_text, target_text, is_phrase, ipa, pos, example_source, example_target, ease, interval, repetitions, next_review, last_seen, status, created_at, updated_at FROM learned_pairs WHERE id = ?',
  )
    .bind(pairId)
    .first()

  return c.json({ pair: updated })
})

export { router as reviewRouter }
