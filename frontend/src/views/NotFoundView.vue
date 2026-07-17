<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <section class="mx-auto max-w-2xl px-6 py-20 text-center">
    <h1 class="text-6xl font-bold text-slate-300 dark:text-slate-600">404</h1>
    <p class="mt-4 text-lg text-slate-600 dark:text-slate-400">
      {{ t('errors.not_found') }}
    </p>
    <button
      class="mt-8 rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-indigo-700"
      @click="router.push({ name: 'home' })"
    >
      {{ t('common.back_home') }}
    </button>
  </section>
</template>
