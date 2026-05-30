<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '../stores/session'

const router = useRouter()
const { t } = useI18n()
const session = useSessionStore()

onMounted(() => {
  if (session.quizQuestions.length === 0) {
    router.push({ name: 'home' })
  }
})

const percentage = computed(() => {
  if (session.quizQuestions.length === 0) return 0
  return Math.round((session.score / session.quizQuestions.length) * 100)
})

const message = computed(() => {
  if (percentage.value >= 80) return t('result.excellent')
  if (percentage.value >= 50) return t('result.good_job')
  return t('result.keep_practicing')
})

function tryAgain() {
  router.push({ name: 'quiz' })
}

function continueLearning() {
  router.push({ name: 'flashcard' })
}

function goHome() {
  session.resetSession()
  router.push({ name: 'home' })
}
</script>

<template>
  <section class="mx-auto max-w-lg px-6 py-12 text-center">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('result.title') }}</h1>

    <div class="mt-8">
      <div class="text-6xl font-bold text-indigo-600 dark:text-indigo-400">{{ percentage }}%</div>
      <p class="mt-2 text-lg text-slate-600 dark:text-slate-300">
        {{ t('result.score') }} {{ session.score }} {{ t('result.out_of') }}
        {{ session.quizQuestions.length }}
      </p>
      <p class="mt-1 text-xl font-semibold">{{ message }}</p>
    </div>

    <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
      <button
        class="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        @click="tryAgain()"
      >
        {{ t('result.try_again') }}
      </button>
      <button
        class="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold transition-colors hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
        @click="continueLearning()"
      >
        {{ t('result.continue_learning') }}
      </button>
    </div>

    <button
      class="mt-4 text-sm text-slate-400 underline hover:text-slate-600 dark:hover:text-slate-300"
      @click="goHome()"
    >
      {{ t('result.go_home') }}
    </button>
  </section>
</template>
