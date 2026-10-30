import type { MiddlewareHandler } from 'hono'
import type { Bindings, Variables } from '../env'

// Count actual bytes even when Content-Length is absent or incorrect.
export const payloadLimit: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (
  c,
  next,
) => {
  if (!c.req.raw.body) return next()
  const maxSize = c.req.path === '/api/stt' ? 5 * 1024 * 1024 : 65_536
  const reader = c.req.raw.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxSize) {
        await reader.cancel().catch(() => {})
        return c.json({ error: 'payload_too_large' }, 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  c.req.raw = new Request(c.req.raw, { body })
  await next()
}
