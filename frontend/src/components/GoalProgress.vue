<script setup lang="ts">
defineProps<{
  current: number
  target: number
  label: string
}>()
</script>

<template>
  <div>
    <div class="flex items-center justify-between text-sm">
      <span class="text-slate-600 dark:text-slate-400">{{ label }}</span>
      <span class="font-medium text-slate-800 dark:text-slate-200"
        >{{ current }} / {{ target }}</span
      >
    </div>
    <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div
        class="h-full rounded-full bg-indigo-500 transition-all"
        :style="{ width: `${Math.min(100, target > 0 ? (current / target) * 100 : 0)}%` }"
      />
    </div>
  </div>
</template>
