import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fetchTtsAudio } from '../../src/api/client'
import { useListeningDrill } from '../../src/composables/useListeningDrill'

vi.mock('../../src/api/client', () => ({
  fetchTtsAudio: vi.fn(),
}))

describe('useListeningDrill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with default state', () => {
    const drill = useListeningDrill()
    expect(drill.isPlaying.value).toBe(false)
    expect(drill.userAnswer.value).toBe('')
    expect(drill.result.value).toBeNull()
    expect(drill.showHint.value).toBe(false)
    expect(drill.error.value).toBeNull()
  })

  describe('getHint', () => {
    it('hides all but first letter of each word', () => {
      const drill = useListeningDrill()
      const hint = drill.getHint('hello world')
      const parts = hint.split(' ')
      expect(parts).toHaveLength(2)
      expect(parts[0][0]).toBe('h')
      expect(parts[1][0]).toBe('w')
    })

    it('handles single word', () => {
      const drill = useListeningDrill()
      expect(drill.getHint('xin chào')[0]).toBe('x')
    })
  })

  // computeLevenshtein is internal (not exported); tested indirectly via checkAnswer

  describe('checkAnswer', () => {
    it('marks as correct when score >= 0.9', () => {
      const drill = useListeningDrill()
      drill.userAnswer.value = 'hello'
      drill.checkAnswer('hello')
      expect(drill.result.value?.feedback).toBe('correct')
      expect(drill.result.value?.score).toBe(1.0)
    })

    it('marks as close when 0.6 <= score < 0.9', () => {
      const drill = useListeningDrill()
      drill.userAnswer.value = 'hallo'
      drill.checkAnswer('hello')
      expect(drill.result.value?.feedback).toBe('close')
      expect(drill.result.value!.score).toBeGreaterThanOrEqual(0.6)
      expect(drill.result.value!.score).toBeLessThan(0.9)
    })

    it('marks as wrong when score < 0.6', () => {
      const drill = useListeningDrill()
      drill.userAnswer.value = 'goodbye'
      drill.checkAnswer('hello')
      expect(drill.result.value?.feedback).toBe('wrong')
    })
  })

  describe('playAudio', () => {
    beforeEach(() => {
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:url')
      window.URL.revokeObjectURL = vi.fn()
    })

    it('fetches TTS audio and plays it', async () => {
      const mockBlob = new Blob(['audio-data'], { type: 'audio/mpeg' })
      vi.mocked(fetchTtsAudio).mockResolvedValueOnce(mockBlob)
      const play = vi.fn()
      window.Audio = vi.fn().mockImplementation(function () {
        return { play, onended: null, onerror: null }
      })

      const drill = useListeningDrill()
      await drill.playAudio('hello', 'en')
      expect(fetchTtsAudio).toHaveBeenCalledWith('hello', 'en')
      expect(drill.isPlaying.value).toBe(true)
      expect(play).toHaveBeenCalled()
    })

    it('sets error when audio fetch fails', async () => {
      vi.mocked(fetchTtsAudio).mockRejectedValueOnce(new Error('Network error'))
      const drill = useListeningDrill()
      await drill.playAudio('hello', 'en')
      expect(drill.error.value).toBe('tts.audio_error')
      expect(drill.isPlaying.value).toBe(false)
    })
  })

  describe('reset', () => {
    it('clears all state', () => {
      const drill = useListeningDrill()
      drill.userAnswer.value = 'hello'
      drill.result.value = { score: 1.0, feedback: 'correct' }
      drill.showHint.value = true
      drill.error.value = 'some error'
      drill.reset()
      expect(drill.userAnswer.value).toBe('')
      expect(drill.result.value).toBeNull()
      expect(drill.showHint.value).toBe(false)
      expect(drill.error.value).toBeNull()
    })
  })
})
