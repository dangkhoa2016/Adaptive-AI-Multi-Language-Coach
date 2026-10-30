import { Hono } from 'hono'
import { enforceCostQuota } from '../middleware/costQuota'
import type { Bindings, Variables } from '../env'
import { t } from '../i18n'
import { transcribeAudio, computeSimilarity } from '../services/stt'
import { getSttModel } from '../services/aiModels'
import { createRateLimitMiddleware } from '../middleware/rateLimit'

export const sttRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

sttRouter.post('/stt', createRateLimitMiddleware(), async (c) => {
  try {
    const contentType = c.req.header('Content-Type') ?? ''
    const reference = c.req.query('reference') ?? ''

    if (reference.length > 2000) return c.json({ error: 'invalid_payload' }, 400)
    if (!contentType.includes('audio') && !contentType.includes('octet-stream')) {
      return c.json({ error: 'invalid_payload', message: t(c, 'errors.invalid_payload') }, 400)
    }

    const audioBuffer = await c.req.arrayBuffer()
    if (audioBuffer.byteLength === 0) {
      return c.json({ error: 'invalid_payload', message: t(c, 'errors.invalid_payload') }, 400)
    }

    if (!c.env.AI?.run) return c.json({ error: 'service_unavailable' }, 503)
    const quotaError = await enforceCostQuota(c)
    if (quotaError) return quotaError
    const model = await getSttModel(c.env.DB)
    const transcript = await transcribeAudio(audioBuffer, c.env.AI, model)
    const similarity = reference ? computeSimilarity(reference, transcript) : null

    return c.json({ transcript, similarity })
  } catch {
    console.error('[stt] provider_failed')
    return c.json({ error: 'service_unavailable', message: t(c, 'errors.internal_error') }, 503)
  }
})
