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

  await setEnvSetting(DB, ENCRYPTION_KEY, key, body.value, body.encrypted ?? false)

  return c.json({ success: true, key, encrypted: body.encrypted ?? false })
})

export { router as adminRouter }
