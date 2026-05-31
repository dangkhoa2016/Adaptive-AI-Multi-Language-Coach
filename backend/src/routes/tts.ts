import { Hono } from 'hono'
import type { Bindings, Variables } from '../env'
import { t } from '../i18n'
import { generateTtsAudio } from '../services/tts'
import { getTtsModel } from '../services/aiModels'
import { createRateLimitMiddleware } from '../middleware/rateLimit'

export const ttsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

ttsRouter.use('*', createRateLimitMiddleware())

ttsRouter.post('/tts', async (c) => {
  try {
    const body = await c.req.json()
    const { text, locale } = body as { text?: string; locale?: string }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return c.json({ error: 'invalid_payload', message: t(c, 'errors.invalid_payload') }, 400)
    }

    const uiLocale = c.get('locale')
    const textLocale = locale ?? uiLocale
    const model = await getTtsModel(c.env.DB)

    const { body: audioBody, contentType } = await generateTtsAudio(
      text.trim(),
      textLocale,
      c.env.AI,
      model,
    )

    if (!audioBody) {
      return c.json({ error: 'internal_error', message: t(c, 'errors.internal_error') }, 500)
    }

    c.header('Content-Type', contentType)
    c.header('Cache-Control', 'public, max-age=86400')
    return c.body(audioBody)
  } catch (err) {
    console.error('TTS error:', err)
    return c.json({ error: 'internal_error', message: t(c, 'errors.internal_error') }, 500)
  }
})
