import { Hono } from 'hono'
import type { Bindings, Variables } from '../env'

export const healthRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>()

healthRouter.get('/', (c) =>
  c.json({ message: 'Welcome to the Adaptive AI Multi-Language Coach API!' }),
)

healthRouter.get('/health', (c) => c.json({ ok: true, ts: Date.now() }))
