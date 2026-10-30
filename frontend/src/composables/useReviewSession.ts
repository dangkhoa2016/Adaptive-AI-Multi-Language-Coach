import { ref } from 'vue'
import {
  fetchReviewStats,
  fetchDueCards,
  gradeCard,
  type LearnedPair,
  type ReviewStats,
} from '../api/client'

export function useReviewSession() {
  const phase = ref<'dashboard' | 'session' | 'complete'>('dashboard')
  const pairs = ref<LearnedPair[]>([])
  const currentIndex = ref(0)
  const flipped = ref(false)
  const isGrading = ref(false)
  const stats = ref<ReviewStats>({ dueCount: 0, learningCount: 0, masteredCount: 0, totalCount: 0 })
  const loading = ref(false)
  const error = ref<string | null>(null)
  let pendingGrade: { id: string; quality: number; version: number; key: string } | null = null

  async function loadStats() {
    loading.value = true
    try {
      stats.value = await fetchReviewStats()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'errors.generic'
    } finally {
      loading.value = false
    }
  }

  async function startSession() {
    loading.value = true
    error.value = null
    try {
      const due = await fetchDueCards()
      if (due.length === 0) {
        phase.value = 'dashboard'
        return
      }
      pendingGrade = null
      pairs.value = due
      currentIndex.value = 0
      flipped.value = false
      phase.value = 'session'
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'errors.generic'
    } finally {
      loading.value = false
    }
  }

  async function grade(quality: number) {
    const pair = pairs.value[currentIndex.value]
    if (!pair || isGrading.value) return
    isGrading.value = true
    error.value = null
    try {
      pendingGrade ??= {
        id: pair.id,
        quality,
        version: pair.review_version,
        key: crypto.randomUUID(),
      }
      await gradeCard(pendingGrade.id, pendingGrade.quality, pendingGrade.version, pendingGrade.key)
      pendingGrade = null
      if (currentIndex.value < pairs.value.length - 1) {
        currentIndex.value++
        flipped.value = false
      } else {
        phase.value = 'complete'
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'errors.generic'
      const status = (e as { status?: number })?.status
      if (status === 409 || status === 404) {
        pendingGrade = null
        try {
          pairs.value = await fetchDueCards()
          currentIndex.value = 0
          flipped.value = false
          if (pairs.value.length === 0) phase.value = 'dashboard'
        } catch {
          // Keep the conflict visible; a new session can retry loading cards.
          pairs.value = []
          phase.value = 'dashboard'
        }
      }
    } finally {
      isGrading.value = false
    }
  }

  function resetSession() {
    pendingGrade = null
    phase.value = 'dashboard'
    pairs.value = []
    currentIndex.value = 0
    flipped.value = false
    isGrading.value = false
    error.value = null
    loadStats()
  }

  return {
    phase,
    pairs,
    currentIndex,
    flipped,
    isGrading,
    stats,
    loading,
    error,
    loadStats,
    startSession,
    grade,
    resetSession,
  }
}
