import { Hono } from 'hono'
import { t } from '../i18n'
import { enforceCostQuota } from '../middleware/costQuota'
import { vocabPairSchema, type VocabPair } from '../services/schemas'
import { createQuizQuestions } from '../services/quiz'
import { createRateLimitMiddleware } from '../middleware/rateLimit'
import type { Bindings, Variables } from '../env'

export const quizRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

quizRouter.post('/quiz', createRateLimitMiddleware(), async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_payload', message: t(c, 'errors.invalid_payload') }, 400)
  }

  const pairList = Array.isArray((body as Record<string, unknown>)?.pairs)
    ? ((body as Record<string, unknown>).pairs as unknown[])
    : []
  const validated = pairList
    .map((p: unknown) => {
      const result = vocabPairSchema.safeParse(p)
      return result.success ? result.data : null
    })
    .filter(Boolean) as VocabPair[]

  if (pairList.length > 50 || validated.length === 0 || validated.length !== pairList.length) {
    return c.json({ error: 'invalid_payload', message: t(c, 'errors.invalid_payload') }, 400)
  }

  const quotaError = await enforceCostQuota(c)
  if (quotaError) return quotaError
  const distractorPool = validated.map((p) => p.target)
  const questions = createQuizQuestions(validated, distractorPool)

  return c.json({ questions })
})
