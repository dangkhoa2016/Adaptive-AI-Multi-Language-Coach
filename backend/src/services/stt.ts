import type { Ai } from '@cloudflare/workers-types'

export async function transcribeAudio(
  audioBuffer: ArrayBuffer,
  ai: Ai,
  model: string,
): Promise<string> {
  try {
    const response = await ai.run(model as never, {
      audio: Array.from(new Uint8Array(audioBuffer)),
    })

    if (!response || typeof response !== 'object' || !('text' in response)) {
      throw new Error('STT model returned no transcription')
    }

    return (response as { text: string }).text.trim()
  } catch (err) {
    console.error('STT transcription failed:', err)
    throw err
  }
}

export function computeSimilarity(reference: string, hypothesis: string): number {
  const a = normalizeString(reference)
  const b = normalizeString(hypothesis)

  if (a === b) return 1.0
  if (a.length === 0 || b.length === 0) return 0.0

  const dist = levenshteinDistance(a, b)
  const maxLen = Math.max(a.length, b.length)
  return 1 - dist / maxLen
}

function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [i])
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }

  return matrix[b.length][a.length]
}
