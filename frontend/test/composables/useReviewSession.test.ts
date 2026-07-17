import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fetchReviewStats, fetchDueCards, gradeCard, type LearnedPair } from '../../src/api/client'
import { useReviewSession } from '../../src/composables/useReviewSession'

vi.mock('../../src/api/client', () => ({
  fetchReviewStats: vi.fn(),
  fetchDueCards: vi.fn(),
  gradeCard: vi.fn(),
}))

const mockPair: LearnedPair = {
  id: 'pair-1',
  user_id: 'user-1',
  source: 'en',
  target: 'vi',
  source_text: 'hello',
  target_text: 'xin chào',
  is_phrase: 0,
  ipa: null,
  pos: null,
  example_source: null,
  example_target: null,
  ease: 250,
  interval: 0,
  repetitions: 0,
  next_review: null,
  last_seen: null,
  status: 'learning',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('useReviewSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts in dashboard phase with zero counts', () => {
    const session = useReviewSession()
    expect(session.phase.value).toBe('dashboard')
    expect(session.pairs.value).toEqual([])
    expect(session.currentIndex.value).toBe(0)
    expect(session.flipped.value).toBe(false)
    expect(session.isGrading.value).toBe(false)
    expect(session.stats.value.dueCount).toBe(0)
    expect(session.loading.value).toBe(false)
    expect(session.error.value).toBeNull()
  })

  describe('loadStats', () => {
    it('updates stats on success', async () => {
      vi.mocked(fetchReviewStats).mockResolvedValueOnce({
        dueCount: 5,
        learningCount: 3,
        masteredCount: 10,
        totalCount: 18,
      })
      const session = useReviewSession()
      await session.loadStats()
      expect(session.stats.value.dueCount).toBe(5)
      expect(session.stats.value.masteredCount).toBe(10)
    })

    it('sets error on failure', async () => {
      vi.mocked(fetchReviewStats).mockRejectedValueOnce(new Error('Network error'))
      const session = useReviewSession()
      await session.loadStats()
      expect(session.error.value).toBe('Network error')
    })
  })

  describe('startSession', () => {
    it('transitions to session phase with due cards', async () => {
      vi.mocked(fetchDueCards).mockResolvedValueOnce([mockPair, { ...mockPair, id: 'pair-2' }])
      const session = useReviewSession()
      await session.startSession()
      expect(session.phase.value).toBe('session')
      expect(session.pairs.value).toHaveLength(2)
      expect(session.currentIndex.value).toBe(0)
      expect(session.flipped.value).toBe(false)
      expect(session.loading.value).toBe(false)
    })

    it('stays in dashboard when no due cards', async () => {
      vi.mocked(fetchDueCards).mockResolvedValueOnce([])
      const session = useReviewSession()
      await session.startSession()
      expect(session.phase.value).toBe('dashboard')
    })

    it('sets error on failure', async () => {
      vi.mocked(fetchDueCards).mockRejectedValueOnce(new Error('API error'))
      const session = useReviewSession()
      await session.startSession()
      expect(session.error.value).toBe('API error')
      expect(session.loading.value).toBe(false)
    })

    it('sets loading during request', async () => {
      let resolve!: (v: unknown) => void
      vi.mocked(fetchDueCards).mockReturnValueOnce(
        new Promise((r) => {
          resolve = r
        }),
      )
      const session = useReviewSession()
      const promise = session.startSession()
      expect(session.loading.value).toBe(true)
      resolve([mockPair])
      await promise
      expect(session.loading.value).toBe(false)
    })
  })

  describe('grade', () => {
    it('advances to next card on success', async () => {
      vi.mocked(fetchDueCards).mockResolvedValueOnce([mockPair, { ...mockPair, id: 'pair-2' }])
      vi.mocked(gradeCard).mockResolvedValueOnce(mockPair)
      const session = useReviewSession()
      await session.startSession()
      await session.grade(4)
      expect(gradeCard).toHaveBeenCalledWith('pair-1', 4)
      expect(session.currentIndex.value).toBe(1)
      expect(session.flipped.value).toBe(false)
    })

    it('completes session on last card', async () => {
      vi.mocked(fetchDueCards).mockResolvedValueOnce([mockPair])
      vi.mocked(gradeCard).mockResolvedValueOnce(mockPair)
      const session = useReviewSession()
      await session.startSession()
      await session.grade(4)
      expect(session.phase.value).toBe('complete')
    })

    it('sets error on failure', async () => {
      vi.mocked(fetchDueCards).mockResolvedValueOnce([mockPair])
      vi.mocked(gradeCard).mockRejectedValueOnce(new Error('Grade failed'))
      const session = useReviewSession()
      await session.startSession()
      await session.grade(4)
      expect(session.error.value).toBe('Grade failed')
      expect(session.isGrading.value).toBe(false)
    })

    it('does nothing when no pair at current index', async () => {
      const session = useReviewSession()
      await session.grade(4)
      expect(gradeCard).not.toHaveBeenCalled()
    })

    it('ignores grade while already grading', async () => {
      vi.mocked(fetchDueCards).mockResolvedValueOnce([mockPair])
      vi.mocked(gradeCard).mockImplementationOnce(() => new Promise(() => {}))
      const session = useReviewSession()
      await session.startSession()
      session.grade(4)
      session.grade(3)
      expect(gradeCard).toHaveBeenCalledTimes(1)
    })
  })

  describe('resetSession', () => {
    it('resets to dashboard and reloads stats', async () => {
      vi.mocked(fetchReviewStats).mockResolvedValueOnce({
        dueCount: 2,
        learningCount: 1,
        masteredCount: 5,
        totalCount: 8,
      })
      const session = useReviewSession()
      session.phase.value = 'complete'
      session.pairs.value = [mockPair]
      session.currentIndex.value = 1
      session.flipped.value = true
      session.isGrading.value = true
      session.error.value = 'some error'
      await session.resetSession()
      expect(session.phase.value).toBe('dashboard')
      expect(session.pairs.value).toEqual([])
      expect(session.currentIndex.value).toBe(0)
      expect(session.flipped.value).toBe(false)
      expect(session.isGrading.value).toBe(false)
      expect(session.error.value).toBeNull()
      expect(session.stats.value.dueCount).toBe(2)
    })
  })
})
