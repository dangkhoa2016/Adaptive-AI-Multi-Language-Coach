import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import VocabularyView from '../../src/views/VocabularyView.vue'
import { fetchVocabList } from '../../src/api/client'
import en from '../../src/i18n/messages/en.json'

vi.mock('../../src/api/client', () => ({
  fetchVocabList: vi.fn(),
  deleteVocabPair: vi.fn(),
  updateVocabPair: vi.fn(),
}))

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
})

function mountView() {
  return mount(VocabularyView, {
    global: {
      plugins: [i18n],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

describe('VocabularyView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows skeleton rows while loading', async () => {
    vi.mocked(fetchVocabList).mockReturnValueOnce(new Promise(() => {}))

    const wrapper = mountView()
    await wrapper.vm.$nextTick()

    const skeletons = wrapper.findAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(5)
  })

  it('shows content when not loading', async () => {
    vi.mocked(fetchVocabList).mockResolvedValueOnce({
      pairs: [],
      total: 0,
      page: 1,
      limit: 20,
    })

    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))

    expect(wrapper.find('.animate-pulse').exists()).toBe(false)
  })
})
