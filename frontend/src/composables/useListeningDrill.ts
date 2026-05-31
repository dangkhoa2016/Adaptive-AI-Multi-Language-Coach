import { ref } from 'vue'
import { fetchTtsAudio } from '../api/client'

export function useListeningDrill() {
  const isPlaying = ref(false)
  const userAnswer = ref('')
  const result = ref<{ score: number; feedback: 'correct' | 'close' | 'wrong' } | null>(null)
  const showHint = ref(false)
  const error = ref<string | null>(null)

  function getHint(text: string): string {
    return text
      .split(' ')
      .map((word) => word[0] + '\u200B'.repeat(word.length - 1))
      .join(' ')
  }

  function computeLevenshtein(a: string, b: string): number {
    const sa = normalize(a)
    const sb = normalize(b)
    if (sa === sb) return 1.0
    if (sa.length === 0 || sb.length === 0) return 0.0

    const matrix: number[][] = Array.from({ length: sb.length + 1 }, (_, i) => [i])
    for (let j = 0; j <= sa.length; j++) matrix[0][j] = j

    for (let i = 1; i <= sb.length; i++) {
      for (let j = 1; j <= sa.length; j++) {
        const cost = sb[i - 1] === sa[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        )
      }
    }

    const dist = matrix[sb.length][sa.length]
    return 1 - dist / Math.max(sa.length, sb.length)
  }

  function normalize(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  async function playAudio(text: string, locale: string) {
    isPlaying.value = true
    error.value = null
    try {
      const blob = await fetchTtsAudio(text, locale)
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => {
        URL.revokeObjectURL(url)
        isPlaying.value = false
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        isPlaying.value = false
        error.value = 'tts.audio_error'
      }
      audio.play()
    } catch {
      isPlaying.value = false
      error.value = 'tts.audio_error'
    }
  }

  function checkAnswer(reference: string) {
    const score = computeLevenshtein(reference, userAnswer.value)
    if (score >= 0.9) {
      result.value = { score, feedback: 'correct' }
    } else if (score >= 0.6) {
      result.value = { score, feedback: 'close' }
    } else {
      result.value = { score, feedback: 'wrong' }
    }
  }

  function reset() {
    userAnswer.value = ''
    result.value = null
    showHint.value = false
    error.value = null
  }

  return {
    isPlaying,
    userAnswer,
    result,
    showHint,
    error,
    getHint,
    playAudio,
    checkAnswer,
    reset,
  }
}
