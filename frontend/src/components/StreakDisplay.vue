<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchStreak } from '../api/client'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const streak = ref({
  currentStreak: 0,
  longestStreak: 0,
  todayCount: 0,
  dailyActivity: [] as Array<{ day: string; count: number }>,
})
const loading = ref(true)

onMounted(async () => {
  try {
    streak.value = await fetchStreak()
  } catch {
    /* silent */
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="grid grid-cols-3 gap-4 rounded-xl border p-4 dark:border-slate-700">
    <div class="text-center">
      <p class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
        {{ streak.currentStreak }}
      </p>
      <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('home.streak') }}</p>
    </div>
    <div class="text-center">
      <p class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
        {{ streak.longestStreak }}
      </p>
      <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('home.streak_longest') }}</p>
    </div>
    <div class="text-center">
      <p class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{{ streak.todayCount }}</p>
      <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('home.today_reviews') }}</p>
    </div>
  </div>
</template>
