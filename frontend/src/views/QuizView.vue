<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '../stores/session'
import { usePrefsStore } from '../stores/prefs'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'
import { createQuiz } from '../api/client'
import QuizQuestion from '../components/QuizQuestion.vue'
import ProgressBar from '../components/ProgressBar.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'

const router = useRouter()
const { t } = useI18n()
const session = useSessionStore()
const prefs = usePrefsStore()

onMounted(async () => {
  if (session.pairs.length === 0) {
    router.push({ name: 'home' })
    return
  }
  session.isQuizLoading = true
  try {
    const res = await createQuiz(session.pairs)
    session.setQuizQuestions(res.questions)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'errors.generic'
    session.setError(message)
  } finally {
    session.isQuizLoading = false
  }
})

function seeResults() {
  router.push({ name: 'result' })
}

useKeyboardShortcuts({
  '1': () => session.recordAnswer(0),
  '2': () => session.recordAnswer(1),
  '3': () => session.recordAnswer(2),
  '4': () => session.recordAnswer(3),
  Enter: () => {
    if (session.answers[session.currentQuestionIndex] !== null) {
      session.isQuizComplete ? seeResults() : session.nextQuestion()
    }
  },
})
</script>

<template>
  <section class="mx-auto max-w-2xl px-6 py-8">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold tracking-tight">{{ t('quiz.title') }}</h1>
      <button
        class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        aria-label="Back to home"
        @click="router.push({ name: 'home' })"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"
          />
        </svg>
      </button>
    </div>

    <div v-if="session.isQuizLoading" class="mt-8">
      <SkeletonLoader variant="card" height="12rem" />
    </div>

    <div v-else-if="session.error" class="mt-8 text-center text-red-500">
      <p>{{ t(session.error) }}</p>
      <button
        class="mt-4 rounded-lg bg-slate-200 px-4 py-2 text-sm dark:bg-slate-700"
        @click="router.push({ name: 'home' })"
      >
        {{ t('common.back') }}
      </button>
    </div>

    <template v-else-if="session.quizQuestions.length > 0">
      <div class="mt-4">
        <ProgressBar
          :current="session.currentQuestionIndex + 1"
          :total="session.quizQuestions.length"
        />
        <p class="mt-1 text-center text-xs text-slate-400">
          {{
            t('quiz.question_progress', {
              current: session.currentQuestionIndex + 1,
              total: session.quizQuestions.length,
            })
          }}
        </p>
      </div>

      <div class="mt-6">
        <QuizQuestion
          :question="session.quizQuestions[session.currentQuestionIndex]"
          :answered="session.answers[session.currentQuestionIndex] !== null"
          :selected-index="session.answers[session.currentQuestionIndex]"
          :target-lang="prefs.target"
          @select="session.recordAnswer"
        />
      </div>

      <div
        v-if="session.answers[session.currentQuestionIndex] !== null && !session.isQuizComplete"
        class="mt-6 text-center"
      >
        <button
          class="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          @click="session.nextQuestion()"
        >
          {{
            session.currentQuestionIndex < session.quizQuestions.length - 1
              ? t('quiz.next')
              : t('quiz.see_results')
          }}
        </button>
      </div>

      <div v-if="session.isQuizComplete" class="mt-8 text-center">
        <button
          class="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          @click="seeResults()"
        >
          {{ t('quiz.see_results') }}
        </button>
      </div>
    </template>
  </section>
</template>
