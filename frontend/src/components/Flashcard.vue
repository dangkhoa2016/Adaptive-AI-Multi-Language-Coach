<script setup lang="ts">
import { computed } from 'vue'
import type { VocabPair, LearnedPair } from '../api/client'

const props = defineProps<{
  pair: VocabPair | LearnedPair
  flipped: boolean
  sourceLang: string
}>()

const emit = defineEmits<{
  flip: []
}>()

const display = computed(() => {
  const p = props.pair
  if ('source_text' in p) {
    return {
      source: p.source_text,
      target: p.target_text,
      ipa: p.ipa,
      pos: p.pos,
      exampleSource: p.example_source,
      exampleTarget: p.example_target,
      isPhrase: p.is_phrase === 1,
    }
  }
  return {
    source: p.source,
    target: p.target,
    ipa: p.ipa,
    pos: p.pos,
    exampleSource: p.exampleSource,
    exampleTarget: p.exampleTarget,
    isPhrase: p.isPhrase,
  }
})

const fontSizeClass = computed(() => {
  const len = display.value.source.length + display.value.target.length
  if (len > 60) return 'text-xl'
  if (len > 40) return 'text-2xl'
  return 'text-3xl'
})
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :aria-label="flipped ? display.target : display.source"
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
            {{ display.source }}
          </span>
          <span v-if="display.ipa" class="mt-1 text-sm text-slate-400">{{ display.ipa }}</span>
          <span
            v-if="display.isPhrase"
            class="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            >Phrase</span
          >
          <span class="mt-3 text-xs text-slate-400">Tap to flip</span>
        </div>
      </div>

      <!-- Back -->
      <div
        class="absolute inset-0 backface-hidden rotate-y-180 rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="flex h-full flex-col items-center justify-center text-center">
          <span :class="fontSizeClass" class="font-semibold text-slate-800 dark:text-slate-100">
            {{ display.target }}
          </span>
          <span v-if="display.pos" class="mt-2 text-sm text-slate-500 dark:text-slate-400">{{
            display.pos
          }}</span>
          <span v-if="display.exampleSource" class="mt-3 max-w-xs text-xs text-slate-400 italic">
            {{ display.exampleSource }}
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
