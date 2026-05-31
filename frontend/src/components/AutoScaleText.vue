<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    text: string
    maxLen?: number
  }>(),
  { maxLen: 20 },
)

const sizeClass = computed(() => {
  if (props.text.length > 60) return 'text-lg'
  if (props.text.length > props.maxLen) return 'text-xl'
  return 'text-2xl'
})
</script>

<template>
  <span :class="sizeClass" class="font-semibold leading-tight">
    {{ text }}
  </span>
</template>
