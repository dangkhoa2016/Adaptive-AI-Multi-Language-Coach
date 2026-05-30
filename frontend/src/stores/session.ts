import { defineStore } from 'pinia'
import type { VocabPair, QuizQuestion } from '../api/client'

interface SessionState {
  pairs: VocabPair[]
  currentCardIndex: number
  flipped: boolean
  quizQuestions: QuizQuestion[]
  currentQuestionIndex: number
  answers: (number | null)[]
  score: number
  isQuizComplete: boolean
  isGenerating: boolean
  isQuizLoading: boolean
  error: string | null
}

export const useSessionStore = defineStore('session', {
  state: (): SessionState => ({
    pairs: [],
    currentCardIndex: 0,
    flipped: false,
    quizQuestions: [],
    currentQuestionIndex: 0,
    answers: [],
    score: 0,
    isQuizComplete: false,
    isGenerating: false,
    isQuizLoading: false,
    error: null,
  }),
  actions: {
    setPairs(pairs: VocabPair[]) {
      this.pairs = pairs
      this.currentCardIndex = 0
      this.flipped = false
      this.error = null
    },
    nextCard() {
      if (this.currentCardIndex < this.pairs.length - 1) {
        this.currentCardIndex++
        this.flipped = false
      }
    },
    prevCard() {
      if (this.currentCardIndex > 0) {
        this.currentCardIndex--
        this.flipped = false
      }
    },
    toggleFlip() {
      this.flipped = !this.flipped
    },
    setQuizQuestions(questions: QuizQuestion[]) {
      this.quizQuestions = questions
      this.currentQuestionIndex = 0
      this.answers = new Array(questions.length).fill(null)
      this.score = 0
      this.isQuizComplete = false
      this.error = null
    },
    recordAnswer(optionIndex: number) {
      if (this.answers[this.currentQuestionIndex] !== null) return
      this.answers[this.currentQuestionIndex] = optionIndex
      if (optionIndex === this.quizQuestions[this.currentQuestionIndex].correctIndex) {
        this.score++
      }
      if (this.currentQuestionIndex >= this.quizQuestions.length - 1) {
        this.isQuizComplete = true
      }
    },
    nextQuestion() {
      if (this.currentQuestionIndex < this.quizQuestions.length - 1) {
        this.currentQuestionIndex++
      } else {
        this.isQuizComplete = true
      }
    },
    resetSession() {
      this.pairs = []
      this.currentCardIndex = 0
      this.flipped = false
      this.quizQuestions = []
      this.currentQuestionIndex = 0
      this.answers = []
      this.score = 0
      this.isQuizComplete = false
      this.error = null
    },
    setError(message: string) {
      this.error = message
    },
    clearError() {
      this.error = null
    },
  },
})
