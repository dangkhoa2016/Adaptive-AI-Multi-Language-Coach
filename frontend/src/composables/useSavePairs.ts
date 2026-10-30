import { ref, type Ref } from 'vue'
import { saveVocabPair, type VocabPair } from '../api/client'
import { usePrefsStore } from '../stores/prefs'

export function useSavePairs(pairs: Ref<VocabPair[]>) {
  const prefs = usePrefsStore()
  const savedIndices = ref(new Set<number>())
  const savingIndices = ref(new Set<number>())
  const isSavingAll = ref(false)
  const error = ref<string | null>(null)

  async function savePair(index: number) {
    if (savedIndices.value.has(index)) return
    const pair = pairs.value[index]
    if (!pair) return
    savingIndices.value = new Set(savingIndices.value).add(index)
    error.value = null
    try {
      await saveVocabPair({
        source: prefs.source,
        target: prefs.target,
        sourceText: pair.source,
        targetText: pair.target,
        isPhrase: pair.isPhrase,
        ipa: pair.ipa || undefined,
        pos: pair.pos || undefined,
        exampleSource: pair.exampleSource || undefined,
        exampleTarget: pair.exampleTarget || undefined,
      })
      savedIndices.value = new Set(savedIndices.value).add(index)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'errors.generic'
    } finally {
      const next = new Set(savingIndices.value)
      next.delete(index)
      savingIndices.value = next
    }
  }

  async function saveAll() {
    isSavingAll.value = true
    error.value = null
    for (let i = 0; i < pairs.value.length; i++) {
      if (savedIndices.value.has(i)) continue
      await savePair(i)
    }
    isSavingAll.value = false
  }

  return { savedIndices, savingIndices, isSavingAll, error, savePair, saveAll }
}
