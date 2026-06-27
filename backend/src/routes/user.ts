import { Hono } from 'hono'
import type { Bindings, Variables } from '../env'
import { requireAuth } from '../middleware/auth'

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>()

router.get('/user/export', requireAuth(), async (c) => {
  const userId = c.get('userId')!

  const user = await c.env.DB.prepare(
    'SELECT id, email, email_verified, activation_method, activated_date, timezone, created_at FROM users WHERE id = ?',
  )
    .bind(userId)
    .first<{
      id: string
      email: string
      email_verified: number
      activation_method: string | null
      activated_date: string | null
      timezone: string
      created_at: string
    }>()

  if (!user) {
    return c.json({ error: 'user_not_found' }, 404)
  }

  const pairs = await c.env.DB.prepare(
    'SELECT source, target, source_text, target_text, is_phrase, ipa, pos, example_source, example_target, ease, interval AS interval_days, next_review AS due_date, repetitions, status, created_at FROM learned_pairs WHERE user_id = ?',
  )
    .bind(userId)
    .all()

  const data = {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      emailVerified: !!user.email_verified,
      activationMethod: user.activation_method,
      activatedDate: user.activated_date,
      timezone: user.timezone,
      createdAt: user.created_at,
    },
    learnedPairs: pairs.results ?? [],
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': 'attachment; filename="user-data.json"',
    },
  })
})

export { router as userRouter }
