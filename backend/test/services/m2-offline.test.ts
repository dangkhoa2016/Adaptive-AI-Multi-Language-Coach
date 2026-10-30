import { describe, expect, it } from 'vitest'
import { parseAIResponse } from '../../src/services/ai'
import { generateRequestSchema, vocabPairSchema } from '../../src/services/schemas'
import { createQuizQuestions } from '../../src/services/quiz'
import { computeSimilarity } from '../../src/services/stt'

const pair = (source = 'hello', target = 'xin chào') => vocabPairSchema.parse({ source, target })

describe('M2 offline structural contracts (no semantic accuracy claim)', () => {
  it('distinguishes locale codes in requests from vocabulary text in responses', () => {
    const req = { source: 'en', target: 'vi', topic: 'travel', level: 'A1', count: 1 }
    expect(generateRequestSchema.safeParse(req).success).toBe(true)
    expect(generateRequestSchema.safeParse({ ...req, source: 'hello' }).success).toBe(false)
    expect(pair().source).toBe('hello')
    expect(pair().target).toBe('xin chào')
  })

  it.each(['', '  \n ', '(unknown)', '[placeholder]'])('rejects unusable pair text %j', (text) => {
    expect(vocabPairSchema.safeParse({ source: text, target: 'chào' }).success).toBe(false)
    expect(vocabPairSchema.safeParse({ source: 'hello', target: text }).success).toBe(false)
  })

  it('rejects overlong pair text', () => {
    expect(vocabPairSchema.safeParse({ source: 'x'.repeat(2001), target: 'chào' }).success).toBe(
      false,
    )
  })

  it('rejects NFC/case/space duplicate generated pairs', () => {
    const pairs = [pair('Hello', 'chào'), pair(' hello ', 'cha\u0300o')]
    expect(parseAIResponse(JSON.stringify({ pairs }))).toBeNull()
  })

  it('preserves Vietnamese tones and legitimate ambiguous vocabulary', () => {
    const pairs = [pair('ghost', 'ma'), pair('mother', 'má'), pair('unknown', 'không rõ')]
    expect(parseAIResponse(JSON.stringify({ pairs }))).toHaveLength(3)
  })

  it('rejects generated pair duplicates that differ only in internal whitespace', () => {
    const pairs = [pair('hello there', 'xin chào'), pair('hello\tthere', 'xin  chào')]
    expect(parseAIResponse(JSON.stringify({ pairs }))).toBeNull()
  })

  it('cannot use whitespace variants of the answer as quiz distractors', () => {
    expect(createQuizQuestions([pair()], ['xin  chào', 'xin\tchào', 'xin\nchào'])).toEqual([])
  })

  it('builds four distinct choices with exactly one canonical correct answer', () => {
    const answer = pair('hello', 'chào')
    const pool = [
      ' CHÀO ',
      'cha\u0300o',
      '',
      '(unknown)',
      'cảm ơn',
      'cảm ơn',
      'tạm biệt',
      'xin lỗi',
    ]
    const questions = createQuizQuestions([answer], pool)
    expect(questions).toHaveLength(1)
    const q = questions[0]
    const keys = q.options.map((s) => s.normalize('NFC').trim().toLowerCase())
    expect(q.options).toHaveLength(4)
    expect(new Set(keys).size).toBe(4)
    expect(keys.filter((s) => s === 'chào')).toHaveLength(1)
    expect(q.options[q.correctIndex]).toBe(q.pair.target)
    expect(q.options.every((s) => s.trim() && s !== '(unknown)')).toBe(true)
  })

  it('does not fabricate a quiz when four distinct choices are unavailable', () => {
    expect(createQuizQuestions([pair()], ['xin chào', 'tạm biệt'])).toEqual([])
  })

  it('uses the other supplied pairs as the default target-text pool', () => {
    const questions = createQuizQuestions([
      pair('one', 'một'),
      pair('two', 'hai'),
      pair('three', 'ba'),
      pair('four', 'bốn'),
    ])
    expect(questions).toHaveLength(4)
    for (const q of questions) {
      expect(new Set(q.options).size).toBe(4)
      expect(q.options).not.toContain('(unknown)')
    }
  })
})

describe('M2 transcript similarity is Unicode text distance, not pronunciation', () => {
  it.each([
    ['ma', 'má'],
    ['đi', 'i'],
    ['café', 'cafe'],
    ['猫', '犬'],
    ['가', '나'],
    ['ก', 'ข'],
    ['あ', 'い'],
  ])('retains meaning-bearing distinctions between %s and %s', (a, b) => {
    expect(computeSimilarity(a, b)).toBeLessThan(1)
  })
  it('treats canonically equivalent Vietnamese as equivalent', () => {
    expect(computeSimilarity('chào', 'cha\u0300o')).toBe(1)
  })
  it('does not award perfect similarity to empty normalized text', () => {
    expect(computeSimilarity('!?', '...')).toBe(0)
  })
})
