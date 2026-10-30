import { describe, expect, it } from 'vitest'
import { computeSimilarity } from '../../src/services/stt'

describe('computeSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(computeSimilarity('hello world', 'hello world')).toBe(1.0)
  })

  it('returns 0.0 for empty strings', () => {
    expect(computeSimilarity('', 'hello')).toBe(0.0)
    expect(computeSimilarity('hello', '')).toBe(0.0)
  })

  it('ignores case differences', () => {
    expect(computeSimilarity('Hello World', 'hello world')).toBe(1.0)
  })

  it('preserves diacritics in transcript text comparison', () => {
    expect(computeSimilarity('café', 'cafe')).toBeLessThan(1.0)
  })

  it('ignores punctuation', () => {
    expect(computeSimilarity('hello, world!', 'hello world')).toBe(1.0)
  })

  it('handles partial matches with reasonable score', () => {
    const score = computeSimilarity('hello world', 'hello there')
    expect(score).toBeGreaterThan(0.4)
    expect(score).toBeLessThan(1.0)
  })

  it('returns low score for completely different strings', () => {
    const score = computeSimilarity('abcdefgh', 'xyz')
    expect(score).toBeLessThan(0.5)
  })
})
