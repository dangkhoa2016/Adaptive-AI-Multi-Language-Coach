<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { usePrefsStore } from '../stores/prefs'
import { useReviewSession } from '../composables/useReviewSession'
import Flashcard from '../components/Flashcard.vue'
import ProgressBar from '../components/ProgressBar.vue'
import GradeButtons from '../components/GradeButtons.vue'
import ReviewStatsCard from '../components/ReviewStatsCard.vue'

const router = useRouter()
const { t } = useI18n()
const prefs = usePrefsStore()
const {
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
} = useReviewSession()

const currentPair = computed(() => pairs.value[currentIndex.value] ?? null)

const statCards = computed(() => [
  { label: t('review.due_count'), count: stats.value.dueCount, color: 'amber', icon: '📝' },
  {
    label: t('review.learning_count'),
    count: stats.value.learningCount,
    color: 'blue',
    icon: '📖',
  },
  {
    label: t('review.mastered_count'),
    count: stats.value.masteredCount,
    color: 'emerald',
    icon: '✅',
  },
  { label: t('review.total_count'), count: stats.value.totalCount, color: 'slate', icon: '📚' },
])

onMounted(() => {
  loadStats()
})

async function reviewAgain() {
  await loadStats()
  await startSession()
}
</script>

<template>
  <section class="mx-auto max-w-2xl px-6 py-8">
    <!-- Dashboard -->
    <template v-if="phase === 'dashboard'">
      <h1 class="text-2xl font-bold tracking-tight">{{ t('review.dashboard_title') }}</h1>

      <div v-if="loading" class="mt-8 text-center text-sm text-slate-400">
        {{ t('common.loading') }}
      </div>

      <template v-else>
        <div class="mt-6 grid grid-cols-2 gap-4">
          <ReviewStatsCard
            v-for="card in statCards"
            :key="card.color"
            :label="card.label"
            :count="card.count"
            :color="card.color"
            :icon="card.icon"
          />
        </div>

        <div v-if="error" class="mt-4 text-center text-sm text-red-600">
          {{ error }}
        </div>

        <div class="mt-8 text-center">
          <button
            :disabled="stats.dueCount === 0"
            class="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="startSession()"
          >
            {{ stats.dueCount === 0 ? t('review.no_due_cards') : t('review.start_review') }}
          </button>
        </div>
      </template>
    </template>

    <!-- Session -->
    <template v-if="phase === 'session' && currentPair">
      <div class="mb-6">
        <ProgressBar :current="currentIndex + 1" :total="pairs.length" />
      </div>

      <Flashcard
        :pair="currentPair"
        :flipped="flipped"
        :source-lang="prefs.source"
        @flip="flipped = !flipped"
      />

      <div v-if="error" class="mt-4 text-center text-sm text-red-600">
        {{ error }}
      </div>

      <div v-if="flipped" class="mt-6">
        <GradeButtons :disabled="isGrading" @grade="grade($event)" />
      </div>
    </template>

    <!-- Complete -->
    <template v-if="phase === 'complete'">
      <div class="flex flex-col items-center justify-center py-16">
        <h1 class="text-3xl font-bold tracking-tight">{{ t('review.session_complete') }}</h1>
        <p class="mt-2 text-lg text-slate-500 dark:text-slate-400">
          {{ pairs.length }} {{ t('review.cards_reviewed') }}
        </p>

        <div class="mt-10 flex gap-4">
          <button
            class="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            @click="reviewAgain()"
          >
            {{ t('review.review_again') }}
          </button>
          <button
            class="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="router.push({ name: 'home' })"
          >
            {{ t('common.back') }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>
