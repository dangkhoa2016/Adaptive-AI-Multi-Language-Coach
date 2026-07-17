<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
  actionLabel?: string
  actionLink?: string
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-12 text-center dark:border-slate-600"
  >
    <span v-if="icon" class="mb-4 text-4xl">{{ icon }}</span>
    <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300">{{ title }}</h3>
    <p v-if="description" class="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
      {{ description }}
    </p>
    <RouterLink
      v-if="actionLabel && actionLink"
      :to="actionLink"
      class="mt-6 rounded-xl bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
    >
      {{ actionLabel }}
    </RouterLink>
  </div>
</template>
