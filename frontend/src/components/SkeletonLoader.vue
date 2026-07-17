<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'text' | 'card' | 'circle'
    width?: string
    height?: string
    lines?: number
    class?: string
  }>(),
  {
    variant: 'text',
    width: '',
    height: '',
    lines: 1,
    class: '',
  },
)
</script>

<template>
  <div v-if="variant === 'text'" :class="$props.class">
    <div
      v-for="i in lines"
      :key="i"
      class="animate-pulse rounded bg-slate-200 dark:bg-slate-700"
      :style="{
        width: i === lines ? '60%' : '100%',
        height: height || '1rem',
        marginTop: i > 1 ? '0.5rem' : undefined,
      }"
    />
  </div>
  <div
    v-else-if="variant === 'card'"
    class="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
    :class="$props.class"
  >
    <div
      class="rounded bg-slate-200 dark:bg-slate-700"
      :style="{ height: height || '6rem', width: width || '100%' }"
    />
  </div>
  <div
    v-else-if="variant === 'circle'"
    class="animate-pulse rounded-full bg-slate-200 dark:bg-slate-700"
    :class="$props.class"
    :style="{ width: width || '3rem', height: height || '3rem' }"
  />
</template>
