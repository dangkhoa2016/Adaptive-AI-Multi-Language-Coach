import { isSettingKey, validateSetting } from '../services/settingPolicy'
import { Hono } from 'hono'
import type { Bindings, Variables } from '../env'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { listEnvSettings, prepareEnvSetting } from '../services/envSettings'

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * GET /api/admin/settings
 * List setting metadata without exposing stored values.
 */
router.get('/admin/settings', requireAuth(), requireAdmin(), async (c) => {
  const settings = await listEnvSettings(c.env.DB)
  return c.json({ settings })
})

/**
 * PATCH /api/admin/settings/:key
 * Update a single env var in system_settings.
 * Body: { value: string, encrypted?: boolean }
 */
router.patch('/admin/settings/:key', requireAuth(), requireAdmin(), async (c) => {
  const { ENCRYPTION_KEY, DB } = c.env
  const key = c.req.param('key')

  if (!isSettingKey(key)) return c.json({ error: 'invalid_key' }, 400)
  let body: { value?: unknown }
  try {
    body = await c.req.json()
    validateSetting(key, body?.value)
  } catch {
    return c.json({ error: 'invalid_value' }, 400)
  }

  const write = await prepareEnvSetting(DB, ENCRYPTION_KEY, key, body.value as string)
  const userId = c.var.userId!
  const details = JSON.stringify({
    actor: userId,
    action: 'update_setting',
    key,
    result: 'success',
  })
  await DB.batch([
    write.statement,
    DB.prepare(
      'INSERT INTO audit_log (id, user_id, action, target, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), userId, 'update_setting', key, details, new Date().toISOString()),
  ])
  return c.json({ success: true, key, encrypted: write.encrypted })
})

/**
 * GET /api/admin/audit-log
 * Paginated audit log entries.
 */
router.get('/admin/audit-log', requireAuth(), requireAdmin(), async (c) => {
  const { DB } = c.env
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '50', 10) || 50))
  const offset = (page - 1) * limit

  const countResult = await DB.prepare('SELECT COUNT(*) as total FROM audit_log').first<{
    total: number
  }>()
  const total = countResult?.total ?? 0

  const { results: entries } = await DB.prepare(
    'SELECT id, user_id, action, target, details, created_at FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?',
  )
    .bind(limit, offset)
    .all()

  // Historical audit rows may contain plaintext credentials. Return only trusted metadata;
  // retain their original storage for a separately approved remediation procedure.
  const sanitized = (entries ?? []).map((entry) => ({
    id: entry.id,
    user_id: entry.user_id,
    action: entry.action,
    target: entry.target,
    created_at: entry.created_at,
    details: JSON.stringify({
      actor: entry.user_id,
      action: entry.action,
      key: entry.target,
      result: 'recorded',
    }),
  }))
  return c.json({ entries: sanitized, total, page, limit })
})

export { router as adminRouter }
