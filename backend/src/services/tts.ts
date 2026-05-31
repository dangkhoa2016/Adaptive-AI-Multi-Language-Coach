import type { Ai } from '@cloudflare/workers-types'

export async function generateTtsAudio(
  text: string,
  locale: string,
  ai: Ai,
  model: string,
): Promise<{ body: ReadableStream | null; contentType: string }> {
  try {
    const response = await ai.run(model as never, { text, lang: mapLocaleToMelo(locale) })

    if (!response || typeof response !== 'object' || !('audio' in response)) {
      throw new Error('TTS model returned no audio')
    }

    const audioBytes = (response as { audio: ArrayBuffer }).audio
    const contentType = 'audio/mpeg'

    return { body: new Response(audioBytes).body, contentType }
  } catch (aiErr) {
    console.error('TTS generation failed:', aiErr)
    throw aiErr
  }
}

function mapLocaleToMelo(locale: string): string {
  const map: Record<string, string> = {
    en: 'en',
    zh: 'zh',
    ja: 'ja',
    ko: 'ko',
    fr: 'en',
    vi: 'en',
    th: 'en',
    de: 'en',
  }
  return map[locale] ?? 'en'
}
