import { Hono } from 'hono'
import type { Bindings, Variables } from '../env'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { listEnvSettings, setEnvSetting } from '../services/envSettings'

const router = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * GET /api/admin/settings
 * List all env-prefixed system_settings (decrypted).
 */
router.get('/admin/settings', requireAuth(), requireAdmin(), async (c) => {
  const { ENCRYPTION_KEY, DB } = c.env
  const settings = await listEnvSettings(DB, ENCRYPTION_KEY)
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

  // Reject keys that could break the system
  if (key.startsWith('env.')) {
    return c.json({ error: 'invalid_key', message: 'Do not include env. prefix' }, 400)
  }

  const body = await c.req.json<{ value: string; encrypted?: boolean }>()
  if (!body.value) {
    return c.json({ error: 'missing_value', message: 'value is required' }, 400)
  }

  // Read old value before overwriting
  const settingsKey = 'env.' + key
  const oldRow = await DB.prepare('SELECT value FROM system_settings WHERE key = ?')
    .bind(settingsKey)
    .first<{ value: string }>()

  await setEnvSetting(DB, ENCRYPTION_KEY, key, body.value, body.encrypted ?? false)

  // Audit log (redact secrets when encrypted)
  const userId = c.var.userId!
  const isEncrypted = body.encrypted ?? false
  const details = JSON.stringify({
    oldValue: isEncrypted ? '[REDACTED]' : (oldRow?.value ?? null),
    newValue: isEncrypted ? '[REDACTED]' : body.value,
    encrypted: isEncrypted,
  })
  await DB.prepare(
    'INSERT INTO audit_log (id, user_id, action, target, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(crypto.randomUUID(), userId, 'update_setting', key, details, new Date().toISOString())
    .run()

  return c.json({ success: true, key, encrypted: body.encrypted ?? false })
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

  return c.json({ entries, total, page, limit })
})

export { router as adminRouter }
