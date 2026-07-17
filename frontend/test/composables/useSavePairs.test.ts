import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { saveVocabPair, type VocabPair } from '../../src/api/client'
import { useSavePairs } from '../../src/composables/useSavePairs'

vi.mock('../../src/api/client', () => ({
  saveVocabPair: vi.fn(),
}))

const mockPairs: VocabPair[] = [
  {
    source: 'hello',
    target: 'xin chào',
    exampleSource: '',
    exampleTarget: '',
    ipa: '',
    pos: '',
    isPhrase: false,
  },
  {
    source: 'thank you',
    target: 'cảm ơn',
    exampleSource: '',
    exampleTarget: '',
    ipa: '',
    pos: '',
    isPhrase: true,
  },
]

describe('useSavePairs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with empty state', () => {
    const pairs = ref(mockPairs)
    const sp = useSavePairs(pairs)
    expect(sp.savedIndices.value.size).toBe(0)
    expect(sp.savingIndices.value.size).toBe(0)
    expect(sp.isSavingAll.value).toBe(false)
    expect(sp.error.value).toBeNull()
  })

  describe('savePair', () => {
    it('saves a pair and marks it as saved', async () => {
      vi.mocked(saveVocabPair).mockResolvedValueOnce({ id: 'new-1' } as never)
      const pairs = ref(mockPairs)
      const sp = useSavePairs(pairs)
      await sp.savePair(0)
      expect(saveVocabPair).toHaveBeenCalled()
      expect(sp.savedIndices.value.has(0)).toBe(true)
      expect(sp.error.value).toBeNull()
    })

    it('skips already saved indices', async () => {
      const pairs = ref(mockPairs)
      const sp = useSavePairs(pairs)
      await sp.savePair(0)
      await sp.savePair(0)
      expect(saveVocabPair).toHaveBeenCalledTimes(1)
    })

    it('skips out-of-range index', async () => {
      const pairs = ref(mockPairs)
      const sp = useSavePairs(pairs)
      await sp.savePair(99)
      expect(saveVocabPair).not.toHaveBeenCalled()
    })

    it('sets error on failure', async () => {
      vi.mocked(saveVocabPair).mockRejectedValueOnce(new Error('Save failed'))
      const pairs = ref(mockPairs)
      const sp = useSavePairs(pairs)
      await sp.savePair(0)
      expect(sp.error.value).toBe('Save failed')
      expect(sp.savedIndices.value.has(0)).toBe(false)
    })
  })

  describe('saveAll', () => {
    it('saves all unsaved pairs', async () => {
      vi.mocked(saveVocabPair).mockResolvedValue({ id: 'new' } as never)
      const pairs = ref(mockPairs)
      const sp = useSavePairs(pairs)
      await sp.saveAll()
      expect(saveVocabPair).toHaveBeenCalledTimes(2)
      expect(sp.savedIndices.value.has(0)).toBe(true)
      expect(sp.savedIndices.value.has(1)).toBe(true)
      expect(sp.isSavingAll.value).toBe(false)
    })

    it('skips already saved pairs', async () => {
      vi.mocked(saveVocabPair).mockResolvedValue({ id: 'new' } as never)
      const pairs = ref(mockPairs)
      const sp = useSavePairs(pairs)
      await sp.savePair(0)
      vi.clearAllMocks()
      vi.mocked(saveVocabPair).mockResolvedValue({ id: 'new' } as never)
      await sp.saveAll()
      expect(saveVocabPair).toHaveBeenCalledTimes(1)
    })
  })
})
