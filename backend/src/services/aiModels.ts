const DEFAULT_TTS_MODEL = '@cf/myshell-ai/melotts'
const DEFAULT_STT_MODEL = '@cf/openai/whisper'

async function getModel(db: D1Database, key: string, fallback: string): Promise<string> {
  try {
    const { results } = await db
      .prepare('SELECT model_id FROM ai_models WHERE key = ? AND is_active = 1')
      .bind(key)
      .all<{ model_id: string }>()

    return results?.[0]?.model_id ?? fallback
  } catch {
    return fallback
  }
}

export async function getTtsModel(db: D1Database): Promise<string> {
  return getModel(db, 'tts_model', DEFAULT_TTS_MODEL)
}

export async function getSttModel(db: D1Database): Promise<string> {
  return getModel(db, 'stt_model', DEFAULT_STT_MODEL)
}
