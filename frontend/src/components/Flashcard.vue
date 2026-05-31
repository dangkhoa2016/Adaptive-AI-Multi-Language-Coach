<script setup lang="ts">
import { computed } from 'vue'
import type { VocabPair } from '../api/client'

const props = defineProps<{
  pair: VocabPair
  flipped: boolean
  sourceLang: string
}>()

const emit = defineEmits<{
  flip: []
}>()

const fontSizeClass = computed(() => {
  const len = props.pair.source.length + props.pair.target.length
  if (len > 60) return 'text-xl'
  if (len > 40) return 'text-2xl'
  return 'text-3xl'
})
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :aria-label="flipped ? pair.target : pair.source"
    class="perspective-1000 h-64 cursor-pointer"
    @click="emit('flip')"
    @keydown.enter="emit('flip')"
    @keydown.space.prevent="emit('flip')"
  >
    <div
      class="relative h-full w-full transition-transform duration-500 transform-style-preserve-3d"
      :class="{ 'rotate-y-180': flipped }"
    >
      <!-- Front -->
      <div
        class="absolute inset-0 backface-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="flex h-full flex-col items-center justify-center text-center">
          <span class="mb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
            {{ sourceLang }}
          </span>
          <span :class="fontSizeClass" class="font-semibold text-slate-800 dark:text-slate-100">
            {{ pair.source }}
          </span>
          <span v-if="pair.ipa" class="mt-1 text-sm text-slate-400">{{ pair.ipa }}</span>
          <span class="mt-3 text-xs text-slate-400">Tap to flip</span>
        </div>
      </div>

      <!-- Back -->
      <div
        class="absolute inset-0 backface-hidden rotate-y-180 rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="flex h-full flex-col items-center justify-center text-center">
          <span :class="fontSizeClass" class="font-semibold text-slate-800 dark:text-slate-100">
            {{ pair.target }}
          </span>
          <span class="mt-2 text-sm text-slate-500 dark:text-slate-400">{{ pair.pos }}</span>
          <span class="mt-3 max-w-xs text-xs text-slate-400 italic">
            {{ pair.exampleSource }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.perspective-1000 {
  perspective: 1000px;
}
.transform-style-preserve-3d {
  transform-style: preserve-3d;
}
.backface-hidden {
  backface-visibility: hidden;
}
.rotate-y-180 {
  transform: rotateY(180deg);
}
</style>
