import { Hono } from 'hono'
import { getTopicsFromDB } from '../i18n/topics'
import type { Bindings, Variables } from '../env'

export const topicsRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

topicsRouter.get('/topics', async (c) => {
  const locale = c.get('locale')
  const topics = await getTopicsFromDB(c.env.DB, locale)
  return c.json({ topics })
})
