import { Hono } from 'hono'
import type { Bindings, Variables } from '../env'
import { requireAuth } from '../middleware/auth'

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>()

router.get('/review/streak', requireAuth(), async (c) => {
  const userId = c.get('userId')!

  const rows = await c.env.DB.prepare(
    `SELECT DATE(reviewed_at) as day, COUNT(*) as count FROM review_logs WHERE user_id = ? AND reviewed_at >= datetime('now', '-60 days') GROUP BY day ORDER BY day`,
  )
    .bind(userId)
    .all<{ day: string; count: number }>()

  const dailyActivity = rows.results ?? []

  const activityMap = new Map<string, number>()
  for (const r of dailyActivity) {
    activityMap.set(r.day, r.count)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)
  const todayCount = activityMap.get(todayStr) ?? 0

  let currentStreak = 0
  const cursor = new Date(today)
  while (true) {
    const dayStr = cursor.toISOString().slice(0, 10)
    const count = activityMap.get(dayStr) ?? 0
    if (count === 0) break
    currentStreak++
    cursor.setDate(cursor.getDate() - 1)
  }

  let longestStreak = 0
  let running = 0
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 60)
  const check = new Date(startDate)
  while (check <= today) {
    const dayStr = check.toISOString().slice(0, 10)
    const count = activityMap.get(dayStr) ?? 0
    if (count > 0) {
      running++
      if (running > longestStreak) longestStreak = running
    } else {
      running = 0
    }
    check.setDate(check.getDate() + 1)
  }

  return c.json({
    currentStreak,
    longestStreak,
    todayCount,
    dailyActivity: dailyActivity.map((r) => ({ day: r.day, count: r.count })),
  })
})

export { router as streakRouter }
