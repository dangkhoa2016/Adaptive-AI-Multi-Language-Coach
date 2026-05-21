import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { LOCALE_LABELS, SUPPORTED_LOCALES, resolveLocale, type Locale } from '@vocab/shared'
import type { Bindings, Variables } from './env'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', logger())
app.use('/api/*', cors())

app.use('/api/*', async (c, next) => {
  const header = c.req.header('accept-language')
  const query = c.req.query('lang')
  const locale: Locale = resolveLocale(query ?? header ?? null)
  c.set('locale', locale)
  c.header('Content-Language', locale)
  await next()
})

app.use('/', async (c, next) => {
  c.json({ message: 'Welcome to the Adaptive AI Multi-Language Coach API!' })
})

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }))

app.get('/api/locales', (c) =>
  c.json({
    locales: SUPPORTED_LOCALES.map((code) => ({ code, label: LOCALE_LABELS[code] })),
  }),
)

app.notFound((c) => c.json({ error: 'not_found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'internal_error', message: err.message }, 500)
})

export default app
