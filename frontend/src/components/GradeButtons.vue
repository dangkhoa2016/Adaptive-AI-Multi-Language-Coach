<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  disabled: boolean
}>()

const emit = defineEmits<{
  grade: [quality: number]
}>()

const { t } = useI18n()

const grades = [
  { quality: 0, key: 'again', tKey: 'review.again', color: 'red' },
  { quality: 3, key: 'hard', tKey: 'review.hard', color: 'orange' },
  { quality: 4, key: 'good', tKey: 'review.good', color: 'green' },
  { quality: 5, key: 'easy', tKey: 'review.easy', color: 'teal' },
] as const

function handleKeydown(e: KeyboardEvent) {
  const idx = parseInt(e.key) - 1
  if (idx >= 0 && idx < grades.length && !e.repeat) {
    emit('grade', grades[idx].quality)
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="flex gap-3">
    <button
      v-for="g in grades"
      :key="g.key"
      :disabled="disabled"
      class="flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:opacity-40"
      :class="{
        'bg-red-100 text-red-700 hover:bg-red-200 active:bg-red-300 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50':
          g.color === 'red',
        'bg-orange-100 text-orange-700 hover:bg-orange-200 active:bg-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50':
          g.color === 'orange',
        'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:bg-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50':
          g.color === 'green',
        'bg-teal-100 text-teal-700 hover:bg-teal-200 active:bg-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50':
          g.color === 'teal',
      }"
      @click="emit('grade', g.quality)"
    >
      {{ t(g.tKey) }}
    </button>
  </div>
</template>
