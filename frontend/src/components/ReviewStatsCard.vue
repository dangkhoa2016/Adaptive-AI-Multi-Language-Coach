<script setup lang="ts">
defineProps<{
  label: string
  count: number
  color: string
  icon: string
}>()
</script>

<template>
  <div
    class="rounded-xl border p-4 shadow-sm"
    :class="[
      color === 'amber' &&
        'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20',
      color === 'blue' && 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
      color === 'emerald' &&
        'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20',
      color === 'slate' &&
        'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50',
    ]"
  >
    <div class="flex items-center gap-2">
      <span class="text-lg" v-text="icon" />
      <span
        class="text-xs font-medium uppercase tracking-wide"
        :class="[
          color === 'amber' && 'text-amber-700 dark:text-amber-300',
          color === 'blue' && 'text-blue-700 dark:text-blue-300',
          color === 'emerald' && 'text-emerald-700 dark:text-emerald-300',
          color === 'slate' && 'text-slate-600 dark:text-slate-400',
        ]"
      >
        {{ label }}
      </span>
    </div>
    <p
      class="mt-1 text-3xl font-bold"
      :class="[
        color === 'amber' && 'text-amber-800 dark:text-amber-200',
        color === 'blue' && 'text-blue-800 dark:text-blue-200',
        color === 'emerald' && 'text-emerald-800 dark:text-emerald-200',
        color === 'slate' && 'text-slate-800 dark:text-slate-200',
      ]"
    >
      {{ count }}
    </p>
  </div>
</template>
