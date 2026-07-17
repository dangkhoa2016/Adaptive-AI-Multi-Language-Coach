import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import VocabularyView from '../../src/views/VocabularyView.vue'
import { fetchVocabList, deleteVocabPair } from '../../src/api/client'
import en from '../../src/i18n/messages/en.json'

const mockConfirm = vi.hoisted(() => vi.fn())

vi.mock('../../src/api/client', () => ({
  fetchVocabList: vi.fn(),
  deleteVocabPair: vi.fn(),
  updateVocabPair: vi.fn(),
}))

vi.mock('../../src/composables/useConfirm', () => ({
  useConfirm: () => ({
    confirm: mockConfirm,
    state: { value: null },
    resolveConfirm: vi.fn(),
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
  return mount(VocabularyView, {
    global: {
      plugins: [i18n],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

const mockPairs = [
  {
    id: 'pair-1',
    source_text: 'hello',
    target_text: 'hola',
    status: 'learning' as const,
    ease: 2.5,
    interval: 0,
    next_review: null,
  },
]

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

  describe('delete with confirm', () => {
    it('triggers confirm dialog when delete is clicked', async () => {
      mockConfirm.mockResolvedValueOnce(false)
      vi.mocked(fetchVocabList).mockResolvedValueOnce({
        pairs: mockPairs,
        total: 1,
        page: 1,
        limit: 20,
      })

      const wrapper = mountView()
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 0))

      const deleteBtn = wrapper.find('button[aria-label="Delete"]')
      await deleteBtn.trigger('click')

      expect(mockConfirm).toHaveBeenCalledWith({
        title: 'Delete vocabulary pair?',
        message: 'This cannot be undone.',
      })
    })

    it('calls deleteVocabPair when confirm resolves true', async () => {
      mockConfirm.mockResolvedValueOnce(true)
      vi.mocked(fetchVocabList).mockResolvedValueOnce({
        pairs: mockPairs,
        total: 1,
        page: 1,
        limit: 20,
      })
      vi.mocked(deleteVocabPair).mockResolvedValueOnce(undefined)

      const wrapper = mountView()
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 0))

      const deleteBtn = wrapper.find('button[aria-label="Delete"]')
      await deleteBtn.trigger('click')

      expect(deleteVocabPair).toHaveBeenCalledWith('pair-1')
    })

    it('does not call deleteVocabPair when confirm resolves false', async () => {
      mockConfirm.mockResolvedValueOnce(false)
      vi.mocked(fetchVocabList).mockResolvedValueOnce({
        pairs: mockPairs,
        total: 1,
        page: 1,
        limit: 20,
      })

      const wrapper = mountView()
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 0))

      const deleteBtn = wrapper.find('button[aria-label="Delete"]')
      await deleteBtn.trigger('click')

      expect(deleteVocabPair).not.toHaveBeenCalled()
    })
  })
})
