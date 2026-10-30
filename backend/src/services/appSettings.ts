import { validateSetting } from './settingPolicy'

const APP_SETTING_KEYS: Record<string, string> = {
  aiEndpointUrl: 'env.AI_ENDPOINT_URL',
  aiModelName: 'env.AI_MODEL_NAME',
  aiModelOptions: 'env.AI_MODEL_OPTIONS',
}

export interface AppSettings {
  aiEndpointUrl: string
  aiModelName: string
  aiModelOptions: Record<string, unknown>
}

const DEFAULT_SETTINGS: AppSettings = {
  aiEndpointUrl: 'https://api.openai.com/v1/responses',
  aiModelName: 'gpt-5.4-mini',
  aiModelOptions: {
    max_output_tokens: 4096,
    temperature: 0.7,
  },
}

/**
 * Reads a single setting from system_settings with fallback.
 */
async function getSetting(db: D1Database, key: string, fallback: string): Promise<string> {
  const { results } = await db
    .prepare('SELECT value FROM system_settings WHERE key = ?')
    .bind(key)
    .all<{ value: string }>()

  return results?.[0]?.value ?? fallback
}

/**
 * Reads validated app settings; defaults apply only to missing keys. Unsafe legacy rows fail closed.
 */
export async function getAppSettings(db: D1Database): Promise<AppSettings> {
  const [aiEndpointUrl, aiModelName, aiModelOptionsRaw] = await Promise.all([
    getSetting(db, APP_SETTING_KEYS.aiEndpointUrl, DEFAULT_SETTINGS.aiEndpointUrl),
    getSetting(db, APP_SETTING_KEYS.aiModelName, DEFAULT_SETTINGS.aiModelName),
    getSetting(
      db,
      APP_SETTING_KEYS.aiModelOptions,
      JSON.stringify(DEFAULT_SETTINGS.aiModelOptions),
    ),
  ])

  // Apply current policy to legacy stored settings before they enter provider requests.
  validateSetting('AI_ENDPOINT_URL', aiEndpointUrl)
  validateSetting('AI_MODEL_NAME', aiModelName)
  validateSetting('AI_MODEL_OPTIONS', aiModelOptionsRaw)
  const aiModelOptions = JSON.parse(aiModelOptionsRaw) as Record<string, unknown>

  return {
    aiEndpointUrl,
    aiModelName,
    aiModelOptions,
  }
}
