<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  fetchReviewHistory,
  fetchReviewHistoryStats,
  type ReviewLogEntry,
  type ReviewHistoryStats,
} from '../api/client'
import ReviewStatsCard from '../components/ReviewStatsCard.vue'

const { t } = useI18n()

const logs = ref<ReviewLogEntry[]>([])
const total = ref(0)
const page = ref(1)
const limit = 20
const loading = ref(true)
const error = ref<string | null>(null)
const stats = ref<ReviewHistoryStats>({
  totalReviews: 0,
  todayReviews: 0,
  thisWeek: 0,
  avgQuality: 0,
})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))
const hasPrev = computed(() => page.value > 1)
const hasNext = computed(() => page.value < totalPages.value)

function qualityLabel(q: number): string {
  if (q === 0) return t('reviewHistory.again')
  if (q === 3) return t('reviewHistory.hard')
  if (q === 4) return t('reviewHistory.good')
  if (q === 5) return t('reviewHistory.easy')
  return ''
}

function qualityColor(q: number): string {
  if (q === 0) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (q === 3) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
  if (q === 4) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (q === 5) return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
  return ''
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statCards = computed(() => [
  {
    label: t('reviewHistory.stats_total'),
    count: stats.value.totalReviews,
    color: 'slate',
    icon: '📚',
  },
  {
    label: t('reviewHistory.stats_today'),
    count: stats.value.todayReviews,
    color: 'blue',
    icon: '📝',
  },
  { label: t('reviewHistory.stats_week'), count: stats.value.thisWeek, color: 'amber', icon: '📊' },
  {
    label: t('reviewHistory.stats_avg'),
    count: stats.value.avgQuality,
    color: 'emerald',
    icon: '⭐',
  },
])

async function loadPage(p: number) {
  loading.value = true
  error.value = null
  try {
    const res = await fetchReviewHistory(p, limit)
    logs.value = res.logs
    total.value = res.total
    page.value = res.page
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'errors.generic'
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    stats.value = await fetchReviewHistoryStats()
  } catch {
    // Non-critical
  }
}

onMounted(async () => {
  await Promise.all([loadPage(1), loadStats()])
})
</script>

<template>
  <section class="mx-auto max-w-2xl px-6 py-8">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('reviewHistory.title') }}</h1>

    <div class="mt-6 grid grid-cols-4 gap-4">
      <ReviewStatsCard
        v-for="card in statCards"
        :key="card.color"
        :label="card.label"
        :count="card.count"
        :color="card.color"
        :icon="card.icon"
      />
    </div>

    <div v-if="loading" class="mt-8 text-center text-sm text-slate-400">
      {{ t('common.loading') }}
    </div>

    <template v-else-if="error">
      <div class="mt-8 text-center text-sm text-red-600">{{ error }}</div>
    </template>

    <template v-else-if="logs.length === 0">
      <div class="mt-16 text-center text-sm text-slate-400">
        {{ t('reviewHistory.no_data') }}
      </div>
    </template>

    <template v-else>
      <div class="mt-6 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <table class="w-full text-sm">
          <thead
            class="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          >
            <tr>
              <th class="px-4 py-3">{{ t('reviewHistory.date') }}</th>
              <th class="px-4 py-3">{{ t('reviewHistory.word') }}</th>
              <th class="px-4 py-3 text-right">{{ t('reviewHistory.quality') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
            <tr
              v-for="log in logs"
              :key="log.id"
              class="hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <td class="px-4 py-3 text-slate-500 dark:text-slate-400">
                {{ formatDate(log.reviewedAt) }}
              </td>
              <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                {{ log.source }} → {{ log.target }}
              </td>
              <td class="px-4 py-3 text-right">
                <span
                  class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                  :class="qualityColor(log.quality)"
                >
                  {{ qualityLabel(log.quality) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" class="mt-6 flex items-center justify-between">
        <button
          :disabled="!hasPrev"
          class="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
          :class="
            hasPrev
              ? 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'
              : 'bg-slate-100 dark:bg-slate-800'
          "
          @click="loadPage(page - 1)"
        >
          {{ t('reviewHistory.prev') }}
        </button>
        <span class="text-xs text-slate-400">Page {{ page }} / {{ totalPages }}</span>
        <button
          :disabled="!hasNext"
          class="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
          :class="
            hasNext
              ? 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'
              : 'bg-slate-100 dark:bg-slate-800'
          "
          @click="loadPage(page + 1)"
        >
          {{ t('reviewHistory.next') }}
        </button>
      </div>
    </template>
  </section>
</template>
