<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const error = ref<Error | null>(null)

onErrorCaptured((err) => {
  error.value = err as Error
  return false
})
</script>

<template>
  <div v-if="error" role="alert" class="mx-auto max-w-2xl px-6 py-20 text-center">
    <h1 class="text-4xl font-bold text-red-500 dark:text-red-400">
      {{ t('common.error') }}
    </h1>
    <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
      {{ error.message }}
    </p>
    <div class="mt-8 flex justify-center gap-4">
      <button
        class="rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-indigo-700"
        @click="error = null"
      >
        {{ t('common.retry') }}
      </button>
      <button
        class="rounded-xl border border-slate-300 px-6 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        @click="router.push({ name: 'home' })"
      >
        {{ t('common.back_home') }}
      </button>
    </div>
  </div>
  <slot v-else />
</template>
