import { Hono } from 'hono'
import { t } from '../i18n'
import { vocabPairSchema, type VocabPair } from '../services/schemas'
import { createQuizQuestions } from '../services/quiz'
import { createRateLimitMiddleware } from '../middleware/rateLimit'
import type { Bindings, Variables } from '../env'

export const quizRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

quizRouter.use('*', createRateLimitMiddleware())

quizRouter.post('/quiz', async (c) => {
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

  if (validated.length === 0) {
    return c.json({ error: 'invalid_payload', message: t(c, 'errors.invalid_payload') }, 400)
  }

  const distractorPool = validated.map((p) => p.target)
  const questions = createQuizQuestions(validated, distractorPool)

  return c.json({ questions })
})
