import type { Ai } from '@cloudflare/workers-types'

export async function generateTtsAudio(
  text: string,
  locale: string,
  ai: Ai,
  model: string,
): Promise<{ body: ReadableStream | null; contentType: string }> {
  let deadline: ReturnType<typeof setTimeout> | undefined
  try {
    // The AI binding has no cancellation API. Bound our wait and never retry the call.
    const response = await Promise.race([
      ai.run(model as never, { text, lang: mapLocaleToMelo(locale) }),
      new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(new Error('TTS generation failed')), 10_000)
      }),
    ])

    if (!response || typeof response !== 'object' || !('audio' in response)) {
      throw new Error('TTS generation failed')
    }

    const audioBytes = (response as { audio: unknown }).audio
    if (
      !(audioBytes instanceof ArrayBuffer) ||
      audioBytes.byteLength === 0 ||
      audioBytes.byteLength > 5 * 1024 * 1024
    ) {
      throw new Error('TTS generation failed')
    }
    const contentType = 'audio/mpeg'

    return { body: new Response(audioBytes).body, contentType }
  } catch {
    throw new Error('TTS generation failed')
  } finally {
    if (deadline !== undefined) clearTimeout(deadline)
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
