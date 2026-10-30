import { Hono } from 'hono'
import { SUPPORTED_LOCALES } from '@vocab/shared'
import { enforceCostQuota } from '../middleware/costQuota'
import type { Bindings, Variables } from '../env'
import { t } from '../i18n'
import { generateTtsAudio } from '../services/tts'
import { getTtsModel } from '../services/aiModels'
import { createRateLimitMiddleware } from '../middleware/rateLimit'

export const ttsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

ttsRouter.post('/tts', createRateLimitMiddleware(), async (c) => {
  try {
    const body = await c.req.json().catch(() => null)
    if (!body || typeof body !== 'object') return c.json({ error: 'invalid_payload' }, 400)
    const { text, locale } = body as { text?: string; locale?: string }

    if (
      !text ||
      typeof text !== 'string' ||
      text.trim().length === 0 ||
      text.length > 2000 ||
      (locale !== undefined && !SUPPORTED_LOCALES.includes(locale as never))
    ) {
      return c.json({ error: 'invalid_payload', message: t(c, 'errors.invalid_payload') }, 400)
    }

    if (!c.env.AI?.run) return c.json({ error: 'service_unavailable' }, 503)
    const quotaError = await enforceCostQuota(c)
    if (quotaError) return quotaError
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
    c.header('Cache-Control', 'private, no-store')
    return c.body(audioBody)
  } catch {
    console.error('[tts] provider_failed')
    return c.json({ error: 'service_unavailable', message: t(c, 'errors.internal_error') }, 503)
  }
})
