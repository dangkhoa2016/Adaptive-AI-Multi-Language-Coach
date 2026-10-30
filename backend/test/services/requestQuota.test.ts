import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import type { Bindings } from '../../src/env'
import { consumeQuota, consumeBudget } from '../../src/services/requestQuota'
const db = (env as unknown as Bindings).DB

describe('durable quota counter', () => {
  it('does not allocate new identities after global exhaustion and bounds concurrent global approvals', async () => {
    const global = 'synthetic-global-' + crypto.randomUUID()
    const attempts = await Promise.all(
      Array.from({ length: 12 }, (_, n) =>
        consumeBudget(db, global + '-p' + n, 10, global, 3, 3600),
      ),
    )
    expect(attempts.filter(Boolean)).toHaveLength(3)
    const before = await db
      .prepare('SELECT COUNT(*) AS n FROM quota_buckets')
      .first<{ n: number }>()
    expect(await consumeBudget(db, global + '-unseen', 10, global, 3, 3600)).toBe(false)
    expect(await db.prepare('SELECT COUNT(*) AS n FROM quota_buckets').first()).toEqual(before)
  })
  it('enforces a finite limit under concurrent calls across application instances', async () => {
    const key = 'synthetic-quota-' + crypto.randomUUID()
    const results = await Promise.all(
      Array.from({ length: 12 }, () => consumeQuota(db, key, 4, 3600)),
    )
    expect(results.filter(Boolean)).toHaveLength(4)
    expect(await consumeQuota(db, key, 4, 3600)).toBe(false)
    expect(await consumeQuota(db, key + '-other', 4, 3600)).toBe(true)
  })
})
