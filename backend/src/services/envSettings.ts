import type { D1Database } from '@cloudflare/workers-types'
import { decrypt, encrypt, isEncrypted } from './crypto'
import { isSettingKey, SETTING_POLICIES, validateSetting } from './settingPolicy'

const ENV_PREFIX = 'env.'
const CIPHERTEXT_PREFIX = 'enc:v1:'

export async function getEnvSetting(
  db: D1Database,
  key: string,
  fallback?: string,
): Promise<string | undefined> {
  const { results } = await db
    .prepare('SELECT value FROM system_settings WHERE key = ?')
    .bind(ENV_PREFIX + key)
    .all<{ value: string }>()
  return results?.[0]?.value ?? fallback
}

/** Secret rows must authenticate as ciphertext. Legacy plaintext requires an explicit admin rewrite. */
export async function getEnvSettingDecrypted(
  db: D1Database,
  encryptionKey: string,
  key: string,
  fallback?: string,
): Promise<string | undefined> {
  const raw = await getEnvSetting(db, key)
  if (raw === undefined) return fallback
  if (!isSettingKey(key)) throw new Error('Unsupported setting')
  if (!SETTING_POLICIES[key].secret) return raw
  try {
    if (!raw.startsWith(CIPHERTEXT_PREFIX) && !isEncrypted(raw)) throw new Error('plaintext')
    const value = await decrypt(
      raw.startsWith(CIPHERTEXT_PREFIX) ? raw.slice(CIPHERTEXT_PREFIX.length) : raw,
      encryptionKey,
    )
    validateSetting(key, value)
    return value
  } catch {
    throw new Error('Stored secret is unavailable; replace it through the admin settings API')
  }
}

/** Build the write so callers can atomically batch it together with audit metadata. */
export async function prepareEnvSetting(
  db: D1Database,
  encryptionKey: string,
  key: string,
  value: string,
) {
  validateSetting(key, value)
  if (!isSettingKey(key)) throw new Error('invalid_key')
  const encrypted = SETTING_POLICIES[key].secret
  const storedValue = encrypted ? CIPHERTEXT_PREFIX + (await encrypt(value, encryptionKey)) : value
  return {
    encrypted,
    statement: db
      .prepare(
        `INSERT INTO system_settings (key, value, description, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        ENV_PREFIX + key,
        storedValue,
        `Environment variable: ${key}${encrypted ? ' (encrypted)' : ''}`,
      ),
  }
}

export async function setEnvSetting(
  db: D1Database,
  encryptionKey: string,
  key: string,
  value: string,
  _encrypted = false,
): Promise<void> {
  const write = await prepareEnvSetting(db, encryptionKey, key, value)
  await write.statement.run()
}

/** Administrative reads never decrypt or return stored values, including unknown historical keys. */
export async function listEnvSettings(db: D1Database, _encryptionKey?: string) {
  const { results } = await db
    .prepare('SELECT key, value, updated_at FROM system_settings WHERE key LIKE ? ORDER BY key')
    .bind(ENV_PREFIX + '%')
    .all<{ key: string; value: string; updated_at: string }>()
  return (results ?? []).map((row) => ({
    key: row.key.slice(ENV_PREFIX.length),
    configured: row.value.length > 0,
    masked: row.value.length > 0 ? '********' : '',
    encrypted: row.value.startsWith(CIPHERTEXT_PREFIX) || isEncrypted(row.value),
    updatedAt: row.updated_at,
  }))
}
