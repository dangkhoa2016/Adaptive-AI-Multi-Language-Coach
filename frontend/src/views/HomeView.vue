<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { usePrefsStore } from '../stores/prefs'
import { useSessionStore } from '../stores/session'
import { useAuthStore } from '../stores/auth'
import { useLocale } from '../composables/useLocale'
import {
  generateVocab,
  fetchTopics,
  fetchVocabList,
  fetchReviewStats,
  type Topic,
  type ReviewStats,
} from '../api/client'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import StatCard from '../components/StatCard.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const { t } = useI18n()
const prefs = usePrefsStore()
const session = useSessionStore()
const auth = useAuthStore()
const { setLocale } = useLocale()

const topics = ref<Topic[]>([])
const level = ref<'A1' | 'A2' | 'B1' | 'B2'>('A1')
const count = ref(10)
const isGenerating = ref(false)
const error = ref<string | null>(null)

const vocabCount = ref(0)
const reviewStats = ref<ReviewStats>({
  dueCount: 0,
  learningCount: 0,
  masteredCount: 0,
  totalCount: 0,
})
const statsLoading = ref(true)
const statsError = ref(false)

async function fetchStats() {
  statsLoading.value = true
  statsError.value = false
  try {
    const [vocab, stats] = await Promise.all([fetchVocabList(1, 1), fetchReviewStats()])
    vocabCount.value = vocab.total
    reviewStats.value = stats
  } catch {
    statsError.value = true
  } finally {
    statsLoading.value = false
  }
}

const canStart = computed(() => {
  return prefs.source !== prefs.target
})

onMounted(async () => {
  try {
    topics.value = await fetchTopics(prefs.uiLocale)
  } catch {
    topics.value = []
  }
  fetchStats()
})

watch(
  () => prefs.uiLocale,
  async (locale) => {
    await setLocale(locale)
    try {
      topics.value = await fetchTopics(locale)
    } catch {
      topics.value = []
    }
  },
)

async function start() {
  if (!canStart.value) return
  isGenerating.value = true
  error.value = null

  const topicKey = topics.value[0]?.key ?? 'travel'

  try {
    const res = await generateVocab({
      source: prefs.source,
      target: prefs.target,
      topic: topicKey,
      level: level.value,
      count: count.value,
      uiLocale: prefs.uiLocale,
      mode: prefs.learningMode,
    })
    session.setPairs(res.pairs)
    router.push({ name: 'flashcard' })
  } catch (err) {
    if (err instanceof Error && (err as { status?: number }).status === 429) {
      error.value = 'errors.rate_limited'
    } else {
      error.value = 'errors.generation_failed'
    }
  } finally {
    isGenerating.value = false
  }
}

const levels: Array<{ value: 'A1' | 'A2' | 'B1' | 'B2'; labelKey: string }> = [
  { value: 'A1', labelKey: 'home.beginner' },
  { value: 'A2', labelKey: 'home.elementary' },
  { value: 'B1', labelKey: 'home.intermediate' },
  { value: 'B2', labelKey: 'home.upper_intermediate' },
]
</script>

<template>
  <section class="mx-auto max-w-3xl px-6 py-12" aria-label="Vocabulary generator form">
    <h1 class="text-3xl font-bold tracking-tight">{{ t('home.title') }}</h1>
    <p class="mt-3 text-slate-600 dark:text-slate-300">{{ t('home.tagline') }}</p>

    <!-- Stats Section -->
    <div
      v-if="auth.user"
      class="mb-10 mt-8 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
    >
      <h2 class="mb-4 text-lg font-semibold">{{ t('home.stats_title') }}</h2>
      <template v-if="statsLoading">
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div v-for="i in 4" :key="i">
            <SkeletonLoader variant="card" height="5rem" />
          </div>
        </div>
      </template>
      <template v-else-if="statsError">
        <EmptyState :title="t('home.stats_error')" />
        <div class="mt-4 text-center">
          <button
            class="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            @click="fetchStats"
          >
            {{ t('home.stats_retry') }}
          </button>
        </div>
      </template>
      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard :label="t('home.stats_vocab')" :value="vocabCount" />
        <StatCard :label="t('home.stats_due')" :value="reviewStats.dueCount" />
        <StatCard :label="t('home.stats_learning')" :value="reviewStats.learningCount" />
        <StatCard :label="t('home.stats_mastered')" :value="reviewStats.masteredCount" />
      </div>
    </div>

    <!-- UI Language -->
    <div class="mt-8">
      <label for="ui-locale" class="block text-sm font-medium">{{ t('home.ui_language') }}</label>
      <LanguageSwitcher v-model="prefs.uiLocale" class="mt-2" />
    </div>

    <!-- Source / Target -->
    <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label for="source" class="block text-sm font-medium">{{
          t('home.source_language')
        }}</label>
        <LanguageSwitcher v-model="prefs.source" class="mt-2" />
      </div>
      <div>
        <label for="target" class="block text-sm font-medium">{{
          t('home.target_language')
        }}</label>
        <LanguageSwitcher v-model="prefs.target" class="mt-2" />
      </div>
    </div>

    <!-- Learning Mode -->
    <div class="mt-6">
      <label for="mode" class="block text-sm font-medium">{{ t('home.learning_mode') }}</label>
      <select
        id="mode"
        v-model="prefs.learningMode"
        class="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="word">{{ t('home.mode_word') }}</option>
        <option value="phrase">{{ t('home.mode_phrase') }}</option>
        <option value="mix">{{ t('home.mode_mix') }}</option>
      </select>
    </div>

    <!-- Level -->
    <div class="mt-6">
      <span id="level-label" class="block text-sm font-medium">{{ t('home.level') }}</span>
      <div class="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="level-label">
        <label
          v-for="l in levels"
          :key="l.value"
          class="rounded-lg border px-4 py-2 text-sm font-medium transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-700 dark:has-[:checked]:border-indigo-400 dark:has-[:checked]:bg-indigo-900/30 dark:has-[:checked]:text-indigo-300"
        >
          <input v-model="level" type="radio" :value="l.value" class="sr-only" />
          {{ t(l.labelKey) }} ({{ l.value }})
        </label>
      </div>
    </div>

    <!-- Count Slider -->
    <div class="mt-6">
      <label for="count" class="block text-sm font-medium">
        {{ t('home.count') }}: {{ count }}
      </label>
      <input
        id="count"
        v-model.number="count"
        type="range"
        min="5"
        max="20"
        step="1"
        class="mt-2 w-full accent-indigo-600"
      />
    </div>

    <!-- Error -->
    <div
      v-if="error"
      role="alert"
      aria-live="assertive"
      class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
    >
      {{ t(error) }}
    </div>

    <!-- Start Button -->
    <div class="mt-8">
      <button
        role="button"
        class="w-full rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canStart || isGenerating"
        @click="start()"
      >
        <span v-if="isGenerating">{{ t('common.loading') }}</span>
        <span v-else>{{ t('home.start') }}</span>
      </button>
    </div>
  </section>
</template>
