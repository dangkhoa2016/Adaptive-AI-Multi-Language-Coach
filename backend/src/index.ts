import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { resolveLocale, type Locale } from '@vocab/shared'
import type { Bindings, Variables } from './env'
import { t } from './i18n'
import { healthRouter } from './routes/health'
import { localesRouter } from './routes/locales'
import { topicsRouter } from './routes/topics'
import { quizRouter } from './routes/quiz'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Global middleware
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

// Mount sub-routers
app.route('/', healthRouter)
app.route('/api', localesRouter)
app.route('/api', topicsRouter)
app.route('/api', quizRouter)

// Error handlers
app.notFound((c) => c.json({ error: 'not_found', message: t(c, 'errors.not_found') }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'internal_error', message: t(c, 'errors.internal_error') }, 500)
})

export default app
