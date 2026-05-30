import { describe, expect, it, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '../src/stores/session'
import type { VocabPair, QuizQuestion } from '../src/api/client'

describe('session store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const mockPairs: VocabPair[] = [
    {
      source: 'hello',
      target: 'xin chào',
      exampleSource: '',
      exampleTarget: '',
      ipa: '',
      pos: '',
      isPhrase: false,
    },
    {
      source: 'thank you',
      target: 'cảm ơn',
      exampleSource: '',
      exampleTarget: '',
      ipa: '',
      pos: '',
      isPhrase: true,
    },
    {
      source: 'goodbye',
      target: 'tạm biệt',
      exampleSource: '',
      exampleTarget: '',
      ipa: '',
      pos: '',
      isPhrase: false,
    },
  ]

  const mockQuestions: QuizQuestion[] = [
    { pair: mockPairs[0], options: ['xin chào', 'cảm ơn', 'tạm biệt', 'xin lỗi'], correctIndex: 0 },
    { pair: mockPairs[1], options: ['xin chào', 'cảm ơn', 'tạm biệt', 'xin lỗi'], correctIndex: 1 },
    { pair: mockPairs[2], options: ['xin chào', 'cảm ơn', 'tạm biệt', 'xin lỗi'], correctIndex: 2 },
  ]

  describe('setPairs', () => {
    it('sets pairs and resets state', () => {
      const store = useSessionStore()
      store.setPairs(mockPairs)
      expect(store.pairs).toHaveLength(3)
      expect(store.currentCardIndex).toBe(0)
      expect(store.flipped).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('card navigation', () => {
    it('nextCard increments index', () => {
      const store = useSessionStore()
      store.setPairs(mockPairs)
      store.nextCard()
      expect(store.currentCardIndex).toBe(1)
      expect(store.flipped).toBe(false)
    })

    it('nextCard does not go past last card', () => {
      const store = useSessionStore()
      store.setPairs(mockPairs)
      store.currentCardIndex = 2
      store.nextCard()
      expect(store.currentCardIndex).toBe(2)
    })

    it('prevCard decrements index', () => {
      const store = useSessionStore()
      store.setPairs(mockPairs)
      store.currentCardIndex = 2
      store.prevCard()
      expect(store.currentCardIndex).toBe(1)
    })

    it('prevCard does not go below 0', () => {
      const store = useSessionStore()
      store.setPairs(mockPairs)
      store.prevCard()
      expect(store.currentCardIndex).toBe(0)
    })

    it('toggleFlip flips state', () => {
      const store = useSessionStore()
      store.setPairs(mockPairs)
      store.toggleFlip()
      expect(store.flipped).toBe(true)
      store.toggleFlip()
      expect(store.flipped).toBe(false)
    })
  })

  describe('quiz', () => {
    it('setQuizQuestions initializes quiz state', () => {
      const store = useSessionStore()
      store.setQuizQuestions(mockQuestions)
      expect(store.quizQuestions).toHaveLength(3)
      expect(store.currentQuestionIndex).toBe(0)
      expect(store.answers).toEqual([null, null, null])
      expect(store.score).toBe(0)
      expect(store.isQuizComplete).toBe(false)
    })

    it('recordAnswer records correct answer and increments score', () => {
      const store = useSessionStore()
      store.setQuizQuestions(mockQuestions)
      store.recordAnswer(0)
      expect(store.answers[0]).toBe(0)
      expect(store.score).toBe(1)
    })

    it('recordAnswer records wrong answer without incrementing score', () => {
      const store = useSessionStore()
      store.setQuizQuestions(mockQuestions)
      store.recordAnswer(2)
      expect(store.answers[0]).toBe(2)
      expect(store.score).toBe(0)
    })

    it('recordAnswer does not allow re-answering', () => {
      const store = useSessionStore()
      store.setQuizQuestions(mockQuestions)
      store.recordAnswer(0)
      store.recordAnswer(1)
      expect(store.answers[0]).toBe(0)
      expect(store.score).toBe(1)
    })

    it('completes quiz on last question', () => {
      const store = useSessionStore()
      store.setQuizQuestions(mockQuestions)
      store.currentQuestionIndex = 2
      store.recordAnswer(2)
      expect(store.isQuizComplete).toBe(true)
    })

    it('nextQuestion advances to next question', () => {
      const store = useSessionStore()
      store.setQuizQuestions(mockQuestions)
      store.nextQuestion()
      expect(store.currentQuestionIndex).toBe(1)
    })

    it('nextQuestion completes quiz on last question', () => {
      const store = useSessionStore()
      store.setQuizQuestions(mockQuestions)
      store.currentQuestionIndex = 2
      store.nextQuestion()
      expect(store.isQuizComplete).toBe(true)
    })
  })

  describe('resetSession', () => {
    it('clears all session state', () => {
      const store = useSessionStore()
      store.setPairs(mockPairs)
      store.setQuizQuestions(mockQuestions)
      store.error = 'some error'
      store.resetSession()
      expect(store.pairs).toEqual([])
      expect(store.quizQuestions).toEqual([])
      expect(store.answers).toEqual([])
      expect(store.score).toBe(0)
      expect(store.isQuizComplete).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('error handling', () => {
    it('setError sets error message', () => {
      const store = useSessionStore()
      store.setError('test error')
      expect(store.error).toBe('test error')
    })

    it('clearError clears error message', () => {
      const store = useSessionStore()
      store.setError('test error')
      store.clearError()
      expect(store.error).toBeNull()
    })
  })
})
