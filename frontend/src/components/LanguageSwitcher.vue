<script setup lang="ts">
import { LOCALE_LABELS, type Locale } from '@vocab/shared'

defineProps<{
  modelValue: Locale
}>()

const emit = defineEmits<{
  'update:modelValue': [locale: Locale]
}>()

const locales = Object.keys(LOCALE_LABELS) as Locale[]
</script>

<template>
  <div class="relative inline-block w-full sm:w-auto">
    <select
      :value="modelValue"
      class="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value as Locale)"
    >
      <option v-for="loc in locales" :key="loc" :value="loc">
        {{ LOCALE_LABELS[loc] }}
      </option>
    </select>
    <div
      class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-500"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 20 20" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 7l5 5 5-5" />
      </svg>
    </div>
  </div>
</template>
