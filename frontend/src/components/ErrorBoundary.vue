<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const error = ref<Error | null>(null)

onErrorCaptured((err) => {
  error.value = err as Error
  return false
})
</script>

<template>
  <div v-if="error" role="alert" class="mx-auto max-w-md p-6 text-center">
    <p class="text-lg font-semibold text-red-600 dark:text-red-400">
      {{ t('common.error') }}
    </p>
    <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
      {{ error.message }}
    </p>
    <button
      class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      @click="error = null"
    >
      {{ t('common.retry') }}
    </button>
  </div>
  <slot v-else />
</template>
