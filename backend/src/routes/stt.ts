import { Hono } from 'hono'
import type { Bindings, Variables } from '../env'
import { t } from '../i18n'
import { transcribeAudio, computeSimilarity } from '../services/stt'
import { getSttModel } from '../services/aiModels'
import { createRateLimitMiddleware } from '../middleware/rateLimit'

export const sttRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

sttRouter.use('*', createRateLimitMiddleware())

sttRouter.post('/stt', async (c) => {
  try {
    const contentType = c.req.header('Content-Type') ?? ''
    const reference = c.req.query('reference') ?? ''

    if (!contentType.includes('audio') && !contentType.includes('octet-stream')) {
      return c.json({ error: 'invalid_payload', message: t(c, 'errors.invalid_payload') }, 400)
    }

    const audioBuffer = await c.req.arrayBuffer()
    if (audioBuffer.byteLength === 0) {
      return c.json({ error: 'invalid_payload', message: t(c, 'errors.invalid_payload') }, 400)
    }

    const model = await getSttModel(c.env.DB)
    const transcript = await transcribeAudio(audioBuffer, c.env.AI, model)
    const similarity = reference ? computeSimilarity(reference, transcript) : null

    return c.json({ transcript, similarity })
  } catch (err) {
    console.error('STT error:', err)
    return c.json({ error: 'internal_error', message: t(c, 'errors.internal_error') }, 500)
  }
})
