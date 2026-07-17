import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useStudyReminder } from '../../src/composables/useStudyReminder'

const mockNotify = vi.fn()

vi.mock('../../src/api/client', () => ({
  fetchReviewStats: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'Notification',
    Object.assign(mockNotify, {
      permission: 'granted',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    }),
  )
})

describe('useStudyReminder', () => {
  it("doesn't notify if no due cards", async () => {
    const { fetchReviewStats } = await import('../../src/api/client')
    vi.mocked(fetchReviewStats).mockResolvedValueOnce({
      dueCount: 0,
      learningCount: 0,
      masteredCount: 0,
      totalCount: 10,
    })

    const { checkAndNotify } = useStudyReminder()
    await checkAndNotify()

    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('notifies when dueCards > 0', async () => {
    const { fetchReviewStats } = await import('../../src/api/client')
    vi.mocked(fetchReviewStats).mockResolvedValueOnce({
      dueCount: 3,
      learningCount: 2,
      masteredCount: 5,
      totalCount: 10,
    })

    const { checkAndNotify } = useStudyReminder()
    await checkAndNotify()

    expect(mockNotify).toHaveBeenCalledWith('AI Vocab Coach', {
      body: 'You have 3 card(s) due for review!',
      icon: '/favicon.svg',
    })
  })

  it("doesn't notify if permission denied", async () => {
    vi.stubGlobal(
      'Notification',
      Object.assign(mockNotify, {
        permission: 'denied',
        requestPermission: vi.fn().mockResolvedValue('denied'),
      }),
    )

    const { checkAndNotify } = useStudyReminder()
    await checkAndNotify()

    expect(mockNotify).not.toHaveBeenCalled()
  })

  it('requests permission if default', async () => {
    const requestPermission = vi.fn().mockResolvedValue('denied')

    vi.stubGlobal(
      'Notification',
      Object.assign(mockNotify, {
        permission: 'default',
        requestPermission,
      }),
    )

    const { checkAndNotify } = useStudyReminder()
    await checkAndNotify()

    expect(requestPermission).toHaveBeenCalled()
    expect(mockNotify).not.toHaveBeenCalled()
  })
})
