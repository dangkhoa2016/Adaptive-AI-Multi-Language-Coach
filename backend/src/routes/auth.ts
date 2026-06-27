import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import type { Bindings, Variables } from '../env'
import { t } from '../i18n'
import { createJwt, generateMagicToken, hashToken } from '../services/auth'
import { requireAuth } from '../middleware/auth'
import { createRateLimitMiddleware } from '../middleware/rateLimit'
import { sendEmail } from '../services/mail'

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Apply rate limiting to all auth routes (3 req / 15 min by default per wrangler config)
router.use('*', createRateLimitMiddleware('RATE_LIMITER_AUTH'))

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

router.post('/auth/request', async (c) => {
  const { email } = await c.req.json<{ email: string }>()
  if (!email || !validateEmail(email)) {
    return c.json({ error: 'invalid_email', message: t(c, 'errors.invalid_email') }, 400)
  }

  const raw = generateMagicToken()
  const tokenHash = await hashToken(raw)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  const normalizedEmail = email.toLowerCase()

  await c.env.DB.prepare(
    `INSERT INTO magic_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)`,
  )
    .bind(tokenHash, normalizedEmail, expiresAt)
    .run()

  const origin = c.req.header('origin') ?? 'http://localhost:5173'
  const magicLink = `${origin}/auth/verify?token=${raw}`

  const sent = await sendEmail(c.env.DB, {
    to: normalizedEmail,
    subject: 'Your AI Vocab Coach magic sign-in link',
    html: `<p>Click the link below to sign in to AI Vocab Coach:</p><p><a href="${magicLink}">${magicLink}</a></p><p>This link expires in 15 minutes.</p>`,
    from: 'noreply@vocab.app',
  }).catch((err) => {
    console.log(`[auth] Email send failed: ${err}`)
    return false
  })

  if (!sent) {
    console.log(`[auth] Magic link for ${normalizedEmail}: ${raw}`)
  }

  return c.json({ success: true, message: t(c, 'auth.link_sent') })
})

router.post('/auth/verify', async (c) => {
  const { token } = await c.req.json<{ token: string }>()
  if (!token) {
    return c.json({ error: 'invalid_token', message: t(c, 'errors.invalid_token') }, 400)
  }

  const tokenHash = await hashToken(token)
  const row = await c.env.DB.prepare(
    `SELECT token_hash, email, expires_at, used FROM magic_tokens WHERE token_hash = ?`,
  )
    .bind(tokenHash)
    .first<{ token_hash: string; email: string; expires_at: string; used: number }>()

  if (!row) {
    return c.json({ error: 'invalid_token', message: t(c, 'errors.invalid_token') }, 401)
  }

  if (row.used) {
    return c.json({ error: 'token_used', message: t(c, 'errors.token_used') }, 401)
  }

  if (new Date(row.expires_at) < new Date()) {
    return c.json({ error: 'token_expired', message: t(c, 'errors.token_expired') }, 401)
  }

  // Mark token as used
  await c.env.DB.prepare(`UPDATE magic_tokens SET used = 1 WHERE token_hash = ?`)
    .bind(tokenHash)
    .run()

  // Upsert user
  const email = row.email
  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
    .bind(email)
    .first<{ id: string }>()

  let userId: string
  if (existing) {
    userId = existing.id
    await c.env.DB.prepare(
      `UPDATE users SET email_verified = 1, activation_method = 'open_email', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
      .bind(userId)
      .run()
  } else {
    userId = crypto.randomUUID()
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, email_verified, activated_date, activation_method) VALUES (?, ?, 1, CURRENT_TIMESTAMP, 'open_email')`,
    )
      .bind(userId, email)
      .run()
  }

  // Issue JWT cookie
  const jwt = await createJwt(userId, c.env.JWT_SECRET)
  setCookie(c, 'auth_token', jwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 86400,
  })

  return c.json({ success: true, user: { id: userId, email } })
})

router.post('/auth/logout', (_c) => {
  deleteCookie(_c, 'auth_token', { path: '/' })
  return _c.json({ success: true })
})

router.get('/auth/me', requireAuth(), async (c) => {
  const userId = c.get('userId')!
  const user = await c.env.DB.prepare(
    `SELECT id, email, email_verified, activated_date, activation_method, timezone, created_at FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first<{
      id: string
      email: string
      email_verified: number
      activated_date: string | null
      activation_method: string | null
      timezone: string
      created_at: string
    }>()

  if (!user) {
    return c.json({ error: 'user_not_found', message: t(c, 'errors.user_not_found') }, 404)
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      emailVerified: !!user.email_verified,
      activatedDate: user.activated_date,
      activationMethod: user.activation_method,
      timezone: user.timezone,
      createdAt: user.created_at,
    },
  })
})

export { router as authRouter }
