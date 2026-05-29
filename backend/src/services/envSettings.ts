import type { D1Database } from '@cloudflare/workers-types'
import { decrypt, encrypt, isEncrypted } from './crypto'

/**
 * Keys stored in system_settings table.
 * Convention: env var `FOO_BAR` maps to settings key `env.FOO_BAR`.
 */
const ENV_PREFIX = 'env.'

/**
 * Read a raw (possibly encrypted) value from system_settings.
 */
export async function getEnvSetting(
  db: D1Database,
  key: string,
  fallback?: string,
): Promise<string | undefined> {
  const settingsKey = ENV_PREFIX + key
  const { results } = await db
    .prepare('SELECT value FROM system_settings WHERE key = ?')
    .bind(settingsKey)
    .all<{ value: string }>()

  const row = results?.[0]
  if (!row) return fallback
  return row.value
}

/**
 * Read and decrypt a sensitive env var from system_settings.
 * If the value is not encrypted, returns it as-is.
 */
export async function getEnvSettingDecrypted(
  db: D1Database,
  encryptionKey: string,
  key: string,
  fallback?: string,
): Promise<string | undefined> {
  const raw = await getEnvSetting(db, key, fallback)
  if (!raw) return fallback

  if (isEncrypted(raw)) {
    try {
      return await decrypt(raw, encryptionKey)
    } catch {
      // If decryption fails, return fallback
      return fallback
    }
  }

  return raw
}

/**
 * Set an env var in system_settings, optionally encrypting it.
 */
export async function setEnvSetting(
  db: D1Database,
  encryptionKey: string,
  key: string,
  value: string,
  encrypted = false,
): Promise<void> {
  const settingsKey = ENV_PREFIX + key
  const storedValue = encrypted ? await encrypt(value, encryptionKey) : value

  await db
    .prepare(
      `INSERT INTO system_settings (key, value, description, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      settingsKey,
      storedValue,
      `Environment variable: ${key}${encrypted ? ' (encrypted)' : ''}`,
    )
    .run()
}

/**
 * List all env-prefixed settings from system_settings.
 * Returns decrypted values if encryptionKey is provided.
 */
export async function listEnvSettings(
  db: D1Database,
  encryptionKey?: string,
): Promise<Array<{ key: string; value: string; encrypted: boolean }>> {
  const { results } = await db
    .prepare('SELECT key, value FROM system_settings WHERE key LIKE ? ORDER BY key')
    .bind(ENV_PREFIX + '%')
    .all<{ key: string; value: string }>()

  if (!results) return []

  return Promise.all(
    results.map(async (row) => {
      const varKey = row.key.replace(ENV_PREFIX, '')
      const looksEncrypted = isEncrypted(row.value)

      if (looksEncrypted && encryptionKey) {
        try {
          return {
            key: varKey,
            value: await decrypt(row.value, encryptionKey),
            encrypted: true,
          }
        } catch {
          // If decryption fails, show placeholder
          return { key: varKey, value: '***encrypted***', encrypted: true }
        }
      }

      return { key: varKey, value: row.value, encrypted: false }
    }),
  )
}
