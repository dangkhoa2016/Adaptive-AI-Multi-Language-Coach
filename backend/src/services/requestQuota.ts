async function quotaHash(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Atomic D1 counter shared across isolates/PoPs. No recipient/IP/plain user data at rest. */
export async function consumeQuota(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !Number.isSafeInteger(windowSeconds) ||
    windowSeconds < 1
  ) {
    throw new Error('Invalid quota configuration')
  }
  const hashed = await quotaHash(key)
  const now = Math.floor(Date.now() / 1000)
  const bucket = Math.floor(now / windowSeconds)
  await db.prepare('DELETE FROM quota_buckets WHERE expires_at <= ?').bind(now).run()
  const row = await db
    .prepare(
      `INSERT INTO quota_buckets (key, bucket, used, expires_at) VALUES (?, ?, 1, ?)
     ON CONFLICT(key, bucket) DO UPDATE SET used = quota_buckets.used + 1
     WHERE quota_buckets.used < ? RETURNING used`,
    )
    .bind(hashed, bucket, (bucket + 1) * windowSeconds, limit)
    .first<{ used: number }>()
  return typeof row?.used === 'number'
}

/**
 * Check global capacity before allocating principal rows. Only approved principals debit global.
 * Each reservation is atomic. A concurrent global exhaustion can conservatively consume a
 * principal slot, but cannot start extra work or let denied principals drain the global budget.
 */
export async function consumeBudget(
  db: D1Database,
  principal: string,
  principalLimit: number,
  global: string,
  globalLimit: number,
  windowSeconds: number,
): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds)
  const current = await db
    .prepare('SELECT used FROM quota_buckets WHERE key = ? AND bucket = ?')
    .bind(await quotaHash(global), bucket)
    .first<{ used: number }>()
  if (current && current.used >= globalLimit) return false
  if (!(await consumeQuota(db, principal, principalLimit, windowSeconds))) return false
  return consumeQuota(db, global, globalLimit, windowSeconds)
}
