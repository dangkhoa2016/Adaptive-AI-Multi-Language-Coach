import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import ReviewView from '../../src/views/ReviewView.vue'
import en from '../../src/i18n/messages/en.json'

vi.mock('../../src/composables/useReviewSession', () => ({
  useReviewSession: () => ({
    phase: ref('dashboard'),
    pairs: ref([]),
    currentIndex: ref(0),
    flipped: ref(false),
    isGrading: ref(false),
    stats: ref({ dueCount: 0, learningCount: 0, masteredCount: 0, totalCount: 0 }),
    loading: ref(true),
    error: ref(null),
    loadStats: vi.fn(),
    startSession: vi.fn(),
    grade: vi.fn(),
  }),
}))

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
})

function mountView() {
  return mount(ReviewView, {
    global: {
      plugins: [i18n],
      stubs: {
        Flashcard: { template: '<div />' },
        ProgressBar: { template: '<div />' },
        GradeButtons: { template: '<div />' },
        ReviewStatsCard: {
          template: '<div class="review-stats-card" />',
          props: ['label', 'count', 'color', 'icon'],
        },
      },
    },
  })
}

describe('ReviewView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows skeleton cards when loading in dashboard', async () => {
    const wrapper = mountView()
    await wrapper.vm.$nextTick()

    const skeletons = wrapper.findAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(4)
    expect(wrapper.find('.review-stats-card').exists()).toBe(false)
  })
})
