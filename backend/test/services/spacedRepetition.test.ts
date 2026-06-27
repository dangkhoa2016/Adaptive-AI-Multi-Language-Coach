import { describe, expect, it } from 'vitest'
import { sm2 } from '../../src/services/spacedRepetition'

describe('sm2', () => {
  it('resets on quality < 3', () => {
    const result = sm2(2, { ease: 2.5, interval: 10, repetitions: 5 })
    expect(result.interval).toBe(0)
    expect(result.repetitions).toBe(0)
    expect(result.status).toBe('learning')
  })

  it('sets interval to 1 day on first pass', () => {
    const result = sm2(4, { ease: 2.5, interval: 0, repetitions: 0 })
    expect(result.interval).toBe(1)
    expect(result.repetitions).toBe(1)
  })

  it('sets interval to 6 days on second pass', () => {
    const result = sm2(4, { ease: 2.5, interval: 1, repetitions: 1 })
    expect(result.interval).toBe(6)
    expect(result.repetitions).toBe(2)
  })

  it('multiplies interval by ease on subsequent passes', () => {
    const result = sm2(4, { ease: 2.5, interval: 6, repetitions: 2 })
    expect(result.interval).toBe(15)
    expect(result.repetitions).toBe(3)
  })

  it('decreases ease on poor but passing grade', () => {
    const result = sm2(3, { ease: 2.5, interval: 6, repetitions: 2 })
    expect(result.ease).toBeLessThan(2.5)
    expect(result.ease).toBeGreaterThanOrEqual(1.3)
  })

  it('increases ease on perfect grade', () => {
    const result = sm2(5, { ease: 2.5, interval: 6, repetitions: 2 })
    expect(result.ease).toBeGreaterThan(2.5)
  })

  it('clamps ease to minimum 1.3', () => {
    const result = sm2(3, { ease: 1.3, interval: 1, repetitions: 1 })
    expect(result.ease).toBeGreaterThanOrEqual(1.3)
  })

  it('sets status to mastered when interval >= 365', () => {
    const result = sm2(4, { ease: 2.5, interval: 180, repetitions: 10 })
    expect(result.interval).toBeGreaterThanOrEqual(365)
    expect(result.status).toBe('mastered')
  })

  it('returns valid nextReview date string', () => {
    const result = sm2(4, { ease: 2.5, interval: 0, repetitions: 0 })
    expect(result.nextReview).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
