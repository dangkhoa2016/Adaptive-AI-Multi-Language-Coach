<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  current: number
  total: number
}>()

const pct = computed(() => Math.round((props.current / props.total) * 100))
</script>

<template>
  <div
    role="progressbar"
    :aria-valuenow="current"
    :aria-valuemin="0"
    :aria-valuemax="total"
    class="w-full"
  >
    <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div
        class="h-full rounded-full bg-indigo-500 transition-all duration-300"
        :style="{ width: pct + '%' }"
      />
    </div>
    <p class="mt-1 text-center text-xs text-slate-400">{{ current }} / {{ total }}</p>
  </div>
</template>
