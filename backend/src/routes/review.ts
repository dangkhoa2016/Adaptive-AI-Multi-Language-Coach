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

  const [
    { count: dueCount },
    { count: learningCount },
    { count: masteredCount },
    { count: totalCount },
  ] = await Promise.all([
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
    dueCount: dueCount ?? 0,
    learningCount: learningCount ?? 0,
    masteredCount: masteredCount ?? 0,
    totalCount: totalCount ?? 0,
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
    'SELECT id, ease, interval, repetitions, user_id FROM learned_pairs WHERE id = ?',
  )
    .bind(learnedPairId)
    .first<{ id: string; ease: number; interval: number; repetitions: number; user_id: string }>()

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

export { router as reviewRouter }
