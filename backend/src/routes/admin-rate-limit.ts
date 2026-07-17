import { Hono } from 'hono'
import type { Bindings, Variables } from '../env'
import { requireAuth, requireAdmin } from '../middleware/auth'

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>()

router.get('/admin/rate-limit-stats', requireAuth(), requireAdmin(), async (c) => {
  const { DB } = c.env

  const total = await DB.prepare('SELECT COUNT(*) as count FROM rate_limit_events').first<{
    count: number
  }>()
  const topIps = await DB.prepare(
    'SELECT ip, COUNT(*) as count FROM rate_limit_events GROUP BY ip ORDER BY count DESC LIMIT 10',
  ).all()
  const recent = await DB.prepare(
    'SELECT * FROM rate_limit_events ORDER BY timestamp DESC LIMIT 50',
  ).all()

  return c.json({
    total: total?.count ?? 0,
    topIps: topIps.results,
    recent: recent.results,
  })
})

export { router as adminRateLimitRouter }
