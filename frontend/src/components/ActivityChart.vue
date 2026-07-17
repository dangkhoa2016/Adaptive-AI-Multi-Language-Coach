<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: Array<{ day: string; count: number }>
}>()

const activityMap = computed(() => {
  const map = new Map<string, number>()
  for (const d of props.data) {
    map.set(d.day, d.count)
  }
  return map
})

const bars = computed(() => {
  const result: Array<{ day: string; count: number; pct: number }> = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let maxCount = 0
  const entries: Array<{ day: string; count: number }> = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dayStr = d.toISOString().slice(0, 10)
    const count = activityMap.value.get(dayStr) ?? 0
    entries.push({ day: dayStr, count })
    if (count > maxCount) maxCount = count
  }
  for (const e of entries) {
    result.push({
      day: e.day,
      count: e.count,
      pct: maxCount > 0 ? e.count / maxCount : 0,
    })
  }
  return result
})

const maxBarHeight = 64
</script>

<template>
  <div class="rounded-xl border p-4 dark:border-slate-700">
    <div v-if="data.length === 0" class="py-8 text-center text-sm text-slate-500">
      No activity data yet.
    </div>
    <svg
      v-else
      :viewBox="`0 0 ${bars.length * 20} ${maxBarHeight + 16}`"
      class="w-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        v-for="(bar, i) in bars"
        :key="bar.day"
        :x="i * 20 + 2"
        :y="maxBarHeight - bar.pct * maxBarHeight"
        :width="16"
        :height="bar.pct * maxBarHeight"
        class="fill-indigo-500"
        :rx="2"
      />
    </svg>
  </div>
</template>
