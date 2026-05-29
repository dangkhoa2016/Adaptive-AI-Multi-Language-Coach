import { buildGeneratePrompt } from './prompts'
import { generateResponseSchema, type GenerateRequest, type VocabPair } from './schemas'
import { getAppSettings } from './appSettings'
import type { Bindings } from '../env'
import { getEnvSettingDecrypted } from './envSettings'

/**
 * Reads the list of AI API keys from D1 system_settings (encrypted JSON array).
 */
async function getAiKeys(db: D1Database, encryptionKey: string): Promise<string[]> {
  const raw = await getEnvSettingDecrypted(db, encryptionKey, 'AI_KEYS')
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((k): k is string => typeof k === 'string' && k.length > 0)
    }
  } catch {
    return raw.length > 0 ? [raw] : []
  }

  return []
}

/**
 * Calls the AI model to generate vocabulary pairs.
 * Reads endpoint URL, model name, and options from app settings (D1 system_settings).
 * AI_KEYS must be stored in D1 system_settings (encrypted JSON array).
 */
export async function callAI(env: Bindings, req: GenerateRequest): Promise<VocabPair[] | null> {
  const prompt = buildGeneratePrompt(req)
  const settings = await getAppSettings(env.DB)
  const keys = await getAiKeys(env.DB, env.ENCRYPTION_KEY)
  if (keys.length === 0) return null

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

      if (!res.ok) continue
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
      if (pairs) return pairs
    } catch {
      // try next key
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
