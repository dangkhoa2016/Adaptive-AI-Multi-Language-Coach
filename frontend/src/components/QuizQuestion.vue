<script setup lang="ts">
import { computed } from 'vue'
import type { QuizQuestion } from '../api/client'

const props = defineProps<{
  question: QuizQuestion
  answered: boolean
  selectedIndex: number | null
  targetLang: string
}>()

defineEmits<{
  select: [idx: number]
}>()

const fontSizeClass = computed(() => {
  const len = props.question.pair.source.length
  if (len > 40) return 'text-xl'
  if (len > 25) return 'text-2xl'
  return 'text-3xl'
})

function optionClass(idx: number): string {
  if (!props.answered) {
    return 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
  }
  if (idx === props.question.correctIndex) {
    return 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-300'
  }
  if (idx === props.selectedIndex) {
    return 'border-red-400 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-900/20 dark:text-red-300'
  }
  return 'border-slate-200 bg-white opacity-60 dark:border-slate-700 dark:bg-slate-900'
}
</script>

<template>
  <div class="space-y-6">
    <div
      class="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <span class="text-xs font-medium text-slate-400 uppercase tracking-wide">{{
        targetLang
      }}</span>
      <p :class="fontSizeClass" class="mt-2 font-semibold text-slate-800 dark:text-slate-100">
        {{ question.pair.source }}
      </p>
    </div>

    <div class="space-y-3" role="radiogroup" :aria-label="'Answer options'">
      <button
        v-for="(opt, idx) in question.options"
        :key="idx"
        role="radio"
        :aria-checked="selectedIndex === idx"
        :disabled="answered"
        :class="[
          'w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors disabled:cursor-default',
          optionClass(idx),
        ]"
        @click="$emit('select', idx)"
      >
        <span class="mr-2 inline-block h-5 w-5 text-center text-xs leading-5 text-slate-400">
          {{ String.fromCharCode(65 + idx) }}
        </span>
        {{ opt }}
        <span v-if="answered && idx === question.correctIndex" class="float-right text-emerald-500">
          ✓
        </span>
        <span v-else-if="answered && idx === selectedIndex" class="float-right text-red-500">
          ✗
        </span>
      </button>
    </div>
  </div>
</template>
