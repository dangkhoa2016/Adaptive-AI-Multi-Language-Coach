import type { D1Database } from '@cloudflare/workers-types'
import { decrypt, encrypt, isEncrypted } from '../services/crypto'

/**
 * Keys stored in system_settings table.
 * Convention: env var `FOO_BAR` maps to settings key `env.FOO_BAR`.
 */
const ENV_PREFIX = 'env.'

const SENSITIVE_KEYS = new Set([
  'AI_KEY',
  'JWT_SECRET',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'POSTMARK_SERVER_TOKEN',
  'SENDPULSE_CLIENT_ID',
  'SENDPULSE_CLIENT_SECRET',
  'RESEND_API_KEY',
])

/**
 * Resolve an env var from D1 system_settings only. No fallback.
 * Sensitive keys are automatically decrypted.
 */
export async function resolveEnv(
  db: D1Database,
  encryptionKey: string,
  key: string,
): Promise<string | undefined> {
  const settingsKey = ENV_PREFIX + key
  const { results } = await db
    .prepare('SELECT value FROM system_settings WHERE key = ?')
    .bind(settingsKey)
    .all<{ value: string }>()

  const row = results?.[0]
  if (!row) return undefined

  const raw = row.value
  if (SENSITIVE_KEYS.has(key) && isEncrypted(raw)) {
    try {
      return await decrypt(raw, encryptionKey)
    } catch {
      return undefined
    }
  }

  return raw
}

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
  encryptionKey: string,
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

      if (looksEncrypted) {
        try {
          return {
            key: varKey,
            value: await decrypt(row.value, encryptionKey),
            encrypted: true,
          }
        } catch {
          return { key: varKey, value: '***decryption_failed***', encrypted: true }
        }
      }

      return { key: varKey, value: row.value, encrypted: false }
    }),
  )
}
