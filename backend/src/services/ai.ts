import { buildCacheKey } from './cache'
import { buildGeneratePrompt } from './prompts'
import { generateResponseSchema, type GenerateRequest, type VocabPair } from './schemas'
import { getAppSettings } from './appSettings'
import type { Bindings } from '../env'
import { getEnvSettingDecrypted } from './envSettings'

const AI_KEYS_SETTING = 'AI_KEYS'

/**
 * Reads the list of AI API keys from D1 system_settings (encrypted JSON array).
 */
async function getAiKeys(db: D1Database, encryptionKey: string): Promise<string[]> {
  const raw = await getEnvSettingDecrypted(db, encryptionKey, AI_KEYS_SETTING)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((k): k is string => typeof k === 'string' && k.length > 0)
    }
  } catch {
    // Not valid JSON, treat as single key
    return raw.length > 0 ? [raw] : []
  }

  return []
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
  } catch (err) {
    console.error('Failed to save AI-generated content to DB:', err)
  }
}

/**
 * Calls the AI model to generate vocabulary pairs.
 * Reads AI_KEYS (JSON array) from D1 system_settings and rotates through them on failure.
 */
export async function callAI(env: Bindings, req: GenerateRequest): Promise<VocabPair[] | null> {
  const prompt = buildGeneratePrompt(req)
  const settings = await getAppSettings(env.DB)
  const keys = await getAiKeys(env.DB, env.ENCRYPTION_KEY)
  if (keys.length === 0) return null

  const cacheKey = buildCacheKey(req.source, req.target, req.topic, req.level, req.count, req.mode)

  for (const key of keys) {
    try {
      const res = await fetch(settings.aiEndpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: settings.aiModelName,
          input: prompt,
          ...settings.aiModelOptions,
        }),
      })

      if (!res.ok) {
        console.error(`AI call failed with HTTP ${res.status}`)
        continue
      }

      const data = (await res.json()) as {
        output?: Array<{
          type?: string
          content?: Array<{ type?: string; text?: string }>
        }>
      }
      const text =
        data.output
          ?.find((item) => item.type === 'message')
          ?.content?.find((c) => c.type === 'output_text')?.text ?? ''

      const pairs = parseAIResponse(text)
      if (pairs) {
        await saveGeneratedContent(env.DB, req, pairs, cacheKey)
        return pairs
      }

      console.error('AI parse failed, raw text:', text.slice(0, 500))
    } catch (err) {
      console.error('AI call error:', err instanceof Error ? err.message : String(err))
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
