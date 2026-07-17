import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import HomeView from '../../src/views/HomeView.vue'
import { fetchVocabList, fetchReviewStats, fetchTopics, fetchStreak } from '../../src/api/client'
import en from '../../src/i18n/messages/en.json'

vi.mock('../../src/api/client', () => ({
  fetchVocabList: vi.fn(),
  fetchReviewStats: vi.fn(),
  fetchTopics: vi.fn(),
  fetchStreak: vi.fn(),
}))

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
})

function mountView() {
  return mount(HomeView, {
    global: {
      plugins: [i18n],
      stubs: {
        LanguageSwitcher: { template: '<div />' },
        StatCard: {
          template: '<div class="stat-card">{{ label }}: {{ value }}</div>',
          props: ['label', 'value'],
        },
      },
    },
  })
}

describe('HomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders stat cards with values when user is logged in', async () => {
    vi.mocked(fetchVocabList).mockResolvedValueOnce({ total: 42, pairs: [], page: 1, limit: 1 })
    vi.mocked(fetchReviewStats).mockResolvedValueOnce({
      dueCount: 5,
      learningCount: 3,
      masteredCount: 34,
      totalCount: 42,
    })
    vi.mocked(fetchTopics).mockResolvedValueOnce([])
    vi.mocked(fetchStreak).mockResolvedValueOnce({
      currentStreak: 1,
      longestStreak: 3,
      todayCount: 5,
      dailyActivity: [],
    })
    vi.mocked(fetchStreak).mockResolvedValueOnce({
      currentStreak: 1,
      longestStreak: 3,
      todayCount: 5,
      dailyActivity: [],
    })

    const wrapper = mountView()
    const auth = (await import('../../src/stores/auth')).useAuthStore()
    auth.user = {
      id: 'u1',
      email: 'a@b.com',
      emailVerified: true,
      activatedDate: null,
      activationMethod: null,
      timezone: 'UTC',
      createdAt: '',
    }

    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))

    const stats = wrapper.findAll('.stat-card')
    expect(stats).toHaveLength(4)
    expect(stats[0].text()).toContain('42')
    expect(stats[1].text()).toContain('5')
    expect(stats[2].text()).toContain('3')
    expect(stats[3].text()).toContain('34')
  })

  it('hides stat cards when no user', async () => {
    vi.mocked(fetchTopics).mockResolvedValueOnce([])

    const wrapper = mountView()

    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))

    expect(wrapper.find('.stat-card').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Your Progress')
    expect(wrapper.text()).toContain('AI Vocab Coach')
  })
})
