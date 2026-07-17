import { describe, expect, it } from 'vitest'
import { createQuizQuestions } from '../../src/services/quiz'
import type { VocabPair } from '../../src/services/schemas'

const pairs: VocabPair[] = [
  {
    source: 'hello',
    target: 'xin chào',
    isPhrase: false,
    exampleSource: '',
    exampleTarget: '',
    ipa: '',
    pos: '',
  },
  {
    source: 'thank you',
    target: 'cảm ơn',
    isPhrase: true,
    exampleSource: '',
    exampleTarget: '',
    ipa: '',
    pos: '',
  },
  {
    source: 'goodbye',
    target: 'tạm biệt',
    isPhrase: false,
    exampleSource: '',
    exampleTarget: '',
    ipa: '',
    pos: '',
  },
  {
    source: 'sorry',
    target: 'xin lỗi',
    isPhrase: false,
    exampleSource: '',
    exampleTarget: '',
    ipa: '',
    pos: '',
  },
]

describe('createQuizQuestions', () => {
  it('returns same number of questions as input pairs', () => {
    const questions = createQuizQuestions(pairs)
    expect(questions).toHaveLength(4)
  })

  it('each question has 4 options and a valid correctIndex', () => {
    const questions = createQuizQuestions(pairs)
    for (const q of questions) {
      expect(q.options).toHaveLength(4)
      expect(q.correctIndex).toBeGreaterThanOrEqual(0)
      expect(q.correctIndex).toBeLessThan(4)
      expect(q.options[q.correctIndex]).toBe(q.pair.target)
    }
  })

  it('shuffles question order across multiple calls', () => {
    const results = Array.from({ length: 50 }, () => {
      const qs = createQuizQuestions(pairs)
      return qs.map((q) => q.pair.target).join(',')
    })
    const unique = new Set(results)
    expect(unique.size).toBeGreaterThan(1)
  })

  it('pads with (unknown) when distractor pool is too small', () => {
    const singlePair: VocabPair[] = [
      {
        source: 'hello',
        target: 'xin chào',
        isPhrase: false,
        exampleSource: '',
        exampleTarget: '',
        ipa: '',
        pos: '',
      },
    ]
    const questions = createQuizQuestions(singlePair)
    expect(questions).toHaveLength(1)
    expect(questions[0].options).toHaveLength(4)
    const unknownCount = questions[0].options.filter((o) => o === '(unknown)').length
    expect(unknownCount).toBe(3)
  })

  it('uses provided distractor pool', () => {
    const singlePair: VocabPair[] = [
      {
        source: 'hello',
        target: 'xin chào',
        isPhrase: false,
        exampleSource: '',
        exampleTarget: '',
        ipa: '',
        pos: '',
      },
    ]
    const pool = ['tạm biệt', 'cảm ơn', 'xin lỗi', 'bạn']
    const questions = createQuizQuestions(singlePair, pool)
    expect(questions).toHaveLength(1)
    for (const o of questions[0].options) {
      expect(o === 'xin chào' || pool.includes(o) || o === '(unknown)').toBe(true)
    }
  })

  it('excludes correct answer from distractors', () => {
    const pool = ['xin chào', 'tạm biệt', 'cảm ơn', 'bạn']
    const questions = createQuizQuestions(pairs, pool)
    for (const q of questions) {
      const distractors = q.options.filter((_, i) => i !== q.correctIndex)
      expect(distractors).not.toContain(q.pair.target)
    }
  })

  it('works with empty distractor pool', () => {
    const questions = createQuizQuestions(pairs, [])
    expect(questions).toHaveLength(4)
    for (const q of questions) {
      expect(q.options).toHaveLength(4)
      expect(q.options[q.correctIndex]).toBe(q.pair.target)
    }
  })
})
