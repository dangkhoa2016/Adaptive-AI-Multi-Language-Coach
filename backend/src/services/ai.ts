import { buildCacheKey } from './cache'
import { buildGeneratePrompt } from './prompts'
import { generateResponseSchema, type GenerateRequest, type VocabPair } from './schemas'
import { getAppSettings, type AppSettings } from './appSettings'
import { validateSetting } from './settingPolicy'
import type { Bindings } from '../env'
import { getEnvSettingDecrypted } from './envSettings'
import {
  fetchProviderJson,
  ProviderRejectionError,
  requireTrustedAiEndpoint,
  PROVIDER_ATTEMPT_TIMEOUT_MS,
  PROVIDER_TOTAL_TIMEOUT_MS,
  PROVIDER_MAX_ATTEMPTS,
} from './providerSafety'

const AI_KEYS_SETTING = 'AI_KEYS'

/**
 * Reads the list of AI API keys from D1 system_settings (encrypted JSON array).
 */
async function getAiKeys(db: D1Database, encryptionKey: string): Promise<string[]> {
  const raw = await getEnvSettingDecrypted(db, encryptionKey, AI_KEYS_SETTING)
  if (!raw) return []

  // The settings service already validates the decrypted JSON array.
  return JSON.parse(raw) as string[]
}

/**
 * Saves successfully parsed AI-generated pairs into the ai_generated_content table.
 * Called only after parseAIResponse returns a valid result.
 */
async function saveGeneratedContent(
  db: D1Database,
  req: GenerateRequest,
  pairs: VocabPair[],
  cacheKey: string,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO ai_generated_content
         (source_lang, target_lang, topic, level, mode, count, pairs_json, cache_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        req.source,
        req.target,
        req.topic,
        req.level,
        req.mode,
        req.count,
        JSON.stringify(pairs),
        cacheKey,
      )
      .run()
  } catch {
    console.error('[ai] persistence_unavailable')
  }
}

/**
 * Calls the AI model to generate vocabulary pairs.
 * Rotates keys only after explicit credential/quota rejection; ambiguous outcomes never retry.
 */
export async function callAI(
  env: Bindings,
  req: GenerateRequest,
  persistedCacheKey?: string,
  settingsSnapshot?: AppSettings,
): Promise<VocabPair[] | null> {
  const deadline = Date.now() + PROVIDER_TOTAL_TIMEOUT_MS
  let settings: Awaited<ReturnType<typeof getAppSettings>>
  let keys: string[]
  try {
    settings = settingsSnapshot ?? (await getAppSettings(env.DB))
    validateSetting('AI_ENDPOINT_URL', settings.aiEndpointUrl)
    validateSetting('AI_MODEL_NAME', settings.aiModelName)
    validateSetting('AI_MODEL_OPTIONS', JSON.stringify(settings.aiModelOptions))
    requireTrustedAiEndpoint(settings.aiEndpointUrl, env.AI_PROVIDER_ORIGINS)
    keys = await getAiKeys(env.DB, env.ENCRYPTION_KEY)
  } catch {
    console.error('[ai] configuration_unavailable')
    return null
  }
  if (keys.length === 0) return null
  const prompt = buildGeneratePrompt(req)
  const cacheKey =
    persistedCacheKey ??
    buildCacheKey(req.source, req.target, req.topic, req.level, req.count, req.mode)

  for (const key of keys.slice(0, PROVIDER_MAX_ATTEMPTS)) {
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) break
    try {
      const data = (await fetchProviderJson(
        settings.aiEndpointUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            ...settings.aiModelOptions,
            model: settings.aiModelName,
            input: prompt,
          }),
        },
        Math.min(PROVIDER_ATTEMPT_TIMEOUT_MS, remainingMs),
      )) as {
        output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
      }
      const text = data.output
        ?.find((item) => item.type === 'message')
        ?.content?.find((content) => content.type === 'output_text')?.text
      const pairs = typeof text === 'string' ? parseAIResponse(text) : null
      if (pairs) {
        await saveGeneratedContent(env.DB, req, pairs, cacheKey)
        return pairs
      }
      console.error('[ai] provider_unavailable')
      return null
    } catch (error) {
      console.error('[ai] provider_unavailable')
      if (!(error instanceof ProviderRejectionError)) return null
    }
  }
  return null
}

/**
 * Attempts to parse AI response text into VocabPair array.
 * Extracts JSON from the response and validates against schema.
 */
export function parseAIResponse(text: string): VocabPair[] | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    const result = generateResponseSchema.safeParse(parsed)
    if (result.success) {
      return result.data.pairs
    }
  } catch {
    // Invalid JSON
  }

  return null
}
