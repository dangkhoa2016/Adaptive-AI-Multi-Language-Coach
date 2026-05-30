import { describe, expect, it } from 'vitest'
import { vocabPairSchema } from '../src/services/schemas'

describe('vocabPairSchema', () => {
  it('accepts boolean isPhrase', () => {
    const result = vocabPairSchema.safeParse({
      source: 'hello',
      target: 'xin chào',
      isPhrase: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isPhrase).toBe(true)
    }
  })

  it('accepts number isPhrase (from D1 CAST)', () => {
    const result = vocabPairSchema.safeParse({
      source: 'hello',
      target: 'xin chào',
      isPhrase: 1,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isPhrase).toBe(true)
    }
  })

  it('converts number 0 to false', () => {
    const result = vocabPairSchema.safeParse({
      source: 'hello',
      target: 'xin chào',
      isPhrase: 0,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isPhrase).toBe(false)
    }
  })

  it('defaults isPhrase to false when missing', () => {
    const result = vocabPairSchema.safeParse({
      source: 'hello',
      target: 'xin chào',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isPhrase).toBe(false)
    }
  })

  it('rejects missing source', () => {
    const result = vocabPairSchema.safeParse({
      target: 'xin chào',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing target', () => {
    const result = vocabPairSchema.safeParse({
      source: 'hello',
    })
    expect(result.success).toBe(false)
  })
})
