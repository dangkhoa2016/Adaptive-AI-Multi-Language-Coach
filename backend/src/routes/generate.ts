import { Hono } from 'hono'
import { t } from '../i18n'
import { generateRequestSchema, type VocabPair } from '../services/schemas'
import { buildCacheKey, readCache, writeCache } from '../services/cache'
import { getFallbackPairsFromDB } from '../services/fallback'
import { callAI } from '../services/ai'
import { createRateLimitMiddleware } from '../middleware/rateLimit'
import type { Bindings, Variables } from '../env'

export const generateRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

generateRouter.post('/generate', createRateLimitMiddleware(), async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_payload', message: t(c, 'errors.invalid_payload') }, 400)
  }

  const parsed = generateRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      {
        error: 'invalid_payload',
        message: t(c, 'errors.invalid_payload'),
        details: parsed.error.flatten(),
      },
      400,
    )
  }

  const req = parsed.data

  // Try cache first
  const cacheKey = buildCacheKey(req.source, req.target, req.topic, req.level, req.count, req.mode)
  const cached = await readCache(c.env.CACHE, cacheKey)
  if (cached) {
    return c.json({ pairs: cached, cacheHit: true })
  }

  // Try AI generation
  let pairs: VocabPair[] | null = null
  try {
    pairs = await callAI(c.env, req)
  } catch (err) {
    console.error('AI generation error:', err)
  }

  // Fallback if AI failed
  let isFallback = false
  if (!pairs) {
    isFallback = true
    pairs = await getFallbackPairsFromDB(c.env.DB, req)
    pairs = pairs.slice(0, req.count)
  }

  if (pairs.length === 0) {
    return c.json({ error: 'fallback_unavailable', message: t(c, 'errors.internal_error') }, 503)
  }

  // Write to cache
  await writeCache(c.env.CACHE, cacheKey, pairs)

  return c.json({ pairs, isFallback, cacheHit: false })
})
