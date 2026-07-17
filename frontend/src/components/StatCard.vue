<script setup lang="ts">
defineProps<{ label: string; value: number }>()
</script>

<template>
  <div class="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800">
    <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{{ value }}</div>
    <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ label }}</div>
  </div>
</template>
