import { Hono } from 'hono'
import { LOCALE_LABELS, SUPPORTED_LOCALES } from '@vocab/shared'
import type { Bindings, Variables } from '../env'

export const localesRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

localesRouter.get('/locales', (c) =>
  c.json({
    locales: SUPPORTED_LOCALES.map((code) => ({ code, label: LOCALE_LABELS[code] })),
  }),
)
