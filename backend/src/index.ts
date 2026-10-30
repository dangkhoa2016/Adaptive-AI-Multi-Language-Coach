import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { payloadLimit } from './middleware/payloadLimit'
import { mutationSafety, trustedOrigin } from './middleware/httpSafety'
import { resolveLocale, type Locale } from '@vocab/shared'
import type { Bindings, Variables } from './env'
import { t } from './i18n'
import { securityHeaders } from './middleware/securityHeaders'
import { structuredLogger } from './middleware/structuredLogger'
import { healthRouter } from './routes/health'
import { localesRouter } from './routes/locales'
import { topicsRouter } from './routes/topics'
import { quizRouter } from './routes/quiz'
import { generateRouter } from './routes/generate'
import { adminRouter } from './routes/admin'
import { adminRateLimitRouter } from './routes/admin-rate-limit'
import { ttsRouter } from './routes/tts'
import { sttRouter } from './routes/stt'
import { authRouter } from './routes/auth'
import { userRouter } from './routes/user'
import { reviewRouter } from './routes/review'
import { streakRouter } from './routes/streak'
import { docsRouter } from './routes/docs'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Global middleware
app.use('*', structuredLogger())
app.use('/api/*', securityHeaders())
app.use('/api/*', payloadLimit)
app.use('/api/*', mutationSafety)
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => (origin === trustedOrigin(c.env) ? origin : undefined),
    credentials: true,
  }),
)
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
app.route('/api', generateRouter)
app.route('/api', adminRouter)
app.route('/api', adminRateLimitRouter)
app.route('/api', ttsRouter)
app.route('/api', sttRouter)
app.route('/api', authRouter)
app.route('/api', userRouter)
app.route('/api', reviewRouter)
app.route('/api', streakRouter)
app.route('/api/docs', docsRouter)

// Error handlers
app.notFound((c) => c.json({ error: 'not_found', message: t(c, 'errors.not_found') }, 404))
app.onError((_err, c) => {
  console.error(JSON.stringify({ event: 'request_failed', status: 500 }))
  return c.json({ error: 'internal_error', message: t(c, 'errors.internal_error') }, 500)
})

export default app
