import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import ReviewHistoryView from '../../src/views/ReviewHistoryView.vue'
import { fetchReviewHistory, fetchReviewHistoryStats } from '../../src/api/client'
import en from '../../src/i18n/messages/en.json'

vi.mock('../../src/api/client', () => ({
  fetchReviewHistory: vi.fn(),
  fetchReviewHistoryStats: vi.fn(),
}))

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
})

function mountView() {
  return mount(ReviewHistoryView, {
    global: {
      plugins: [i18n],
      stubs: {
        ReviewStatsCard: {
          template: '<div class="review-stats-card" />',
          props: ['label', 'count', 'color', 'icon'],
        },
      },
    },
  })
}

describe('ReviewHistoryView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows skeleton cards and table rows while loading', async () => {
    vi.mocked(fetchReviewHistory).mockReturnValueOnce(new Promise(() => {}))
    vi.mocked(fetchReviewHistoryStats).mockReturnValueOnce(new Promise(() => {}))

    const wrapper = mountView()
    await wrapper.vm.$nextTick()

    const skeletons = wrapper.findAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(4)
    expect(wrapper.find('.review-stats-card').exists()).toBe(false)
  })

  it('shows content when not loading', async () => {
    vi.mocked(fetchReviewHistory).mockResolvedValueOnce({
      logs: [],
      total: 0,
      page: 1,
    })
    vi.mocked(fetchReviewHistoryStats).mockResolvedValueOnce({
      totalReviews: 10,
      todayReviews: 2,
      thisWeek: 5,
      avgQuality: 3.5,
    })

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))

    expect(wrapper.find('.animate-pulse').exists()).toBe(false)
    expect(wrapper.find('.review-stats-card').exists()).toBe(true)
  })
})
