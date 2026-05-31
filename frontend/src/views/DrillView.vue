<script setup lang="ts">
import { ref, computed, toRefs } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '../stores/session'
import { usePrefsStore } from '../stores/prefs'
import { useListeningDrill } from '../composables/useListeningDrill'
import { useSpeakingDrill } from '../composables/useSpeakingDrill'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const session = useSessionStore()
const prefs = usePrefsStore()

const drillMode = ref<'listening' | 'speaking' | 'typing'>(
  (route.query.mode as 'listening' | 'speaking' | 'typing') ?? 'listening',
)

const currentIndex = ref(0)
const pairs = computed(() => session.pairs)
const currentPair = computed(() => pairs.value[currentIndex.value])

const listening = useListeningDrill()
const speaking = useSpeakingDrill()

// Flatten refs for template access
const {
  isPlaying,
  userAnswer,
  result,
  showHint,
  error: listeningError,
  getHint,
  playAudio,
  checkAnswer,
} = toRefs(listening)

const {
  isRecording,
  transcript,
  similarity,
  error: speakingError,
  isProcessing,
  startRecording,
  stopRecording,
} = toRefs(speaking)

function nextCard() {
  if (currentIndex.value < pairs.value.length - 1) {
    currentIndex.value++
    listening.reset()
    speaking.reset()
  }
}

function prevCard() {
  if (currentIndex.value > 0) {
    currentIndex.value--
    listening.reset()
    speaking.reset()
  }
}

function goBack() {
  router.push({ name: 'flashcard' })
}

function toggleHint() {
  showHint.value = !showHint.value
}

const scoreFeedback = computed(() => {
  if (drillMode.value === 'listening' && result.value) {
    if (result.value.feedback === 'correct') return 'drills.great_job'
    if (result.value.feedback === 'close') return 'drills.close'
    return 'drills.keep_practicing'
  }
  if (drillMode.value === 'speaking' && similarity.value !== null) {
    if (similarity.value >= 0.9) return 'drills.great_job'
    if (similarity.value >= 0.6) return 'drills.close'
    return 'drills.keep_practicing'
  }
  return null
})

const similarityPercent = computed(() => {
  if (similarity.value === null) return 0
  return Math.round(similarity.value * 100)
})

const resultPercent = computed(() => {
  if (!result.value) return 0
  return Math.round(result.value.score * 100)
})

const speakingErrorMsg = computed(() => speakingError.value ?? '')
const listeningErrorMsg = computed(() => listeningError.value ?? '')
const transcriptText = computed(() => transcript.value ?? '')
</script>

<template>
  <section class="mx-auto max-w-2xl px-6 py-12">
    <div class="mb-6 flex items-center justify-between">
      <button
        class="rounded-lg border border-slate-300 px-4 py-2 text-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        @click="goBack"
      >
        ← {{ t('common.back') }}
      </button>
      <div class="flex gap-2">
        <button
          :class="[
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            drillMode === 'listening'
              ? 'bg-indigo-600 text-white'
              : 'border border-slate-300 dark:border-slate-700',
          ]"
          @click="drillMode = 'listening'"
        >
          {{ t('drills.listening') }}
        </button>
        <button
          :class="[
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            drillMode === 'speaking'
              ? 'bg-indigo-600 text-white'
              : 'border border-slate-300 dark:border-slate-700',
          ]"
          @click="drillMode = 'speaking'"
        >
          {{ t('drills.speaking') }}
        </button>
        <button
          :class="[
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            drillMode === 'typing'
              ? 'bg-indigo-600 text-white'
              : 'border border-slate-300 dark:border-slate-700',
          ]"
          @click="drillMode = 'typing'"
        >
          {{ t('drills.typing') }}
        </button>
      </div>
    </div>

    <div class="mb-6 text-sm text-slate-500">{{ currentIndex + 1 }} / {{ pairs.length }}</div>

    <div
      v-if="currentPair"
      class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <!-- Listening Drill -->
      <div v-if="drillMode === 'listening'" class="space-y-6">
        <div class="text-center">
          <button
            class="rounded-full bg-indigo-100 p-6 text-indigo-700 transition-colors hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
            :disabled="isPlaying"
            :aria-label="t('tts.play_audio')"
            @click="playAudio(currentPair.source, prefs.source)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M11 5L6 9H2v6h4l5 4V5z"
              />
            </svg>
          </button>
          <p class="mt-3 text-sm text-slate-500">{{ t('drills.type_what_you_hear') }}</p>
        </div>

        <div v-if="showHint && currentPair" class="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
          <p class="text-sm text-slate-600 dark:text-slate-300">
            {{ t('drills.hint') }}: {{ getHint(currentPair.source) }}
          </p>
        </div>

        <input
          v-model="userAnswer"
          type="text"
          class="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg dark:border-slate-700 dark:bg-slate-800"
          :placeholder="t('drills.type_what_you_hear')"
          @keyup.enter="checkAnswer(currentPair.source)"
        />

        <div class="flex gap-3">
          <button
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            @click="toggleHint"
          >
            {{ t('drills.hint') }}
          </button>
          <button
            class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            @click="checkAnswer(currentPair.source)"
          >
            {{ t('drills.check') }}
          </button>
        </div>

        <div v-if="result" class="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
          <p class="font-medium">{{ t(scoreFeedback!) }}</p>
          <p class="mt-1 text-sm text-slate-500">
            {{ t('drills.similarity') }}: {{ resultPercent }}%
          </p>
          <p class="mt-2 text-sm">
            <span class="text-slate-500">{{ t('drills.transcript') }}: </span>
            <span class="font-mono">{{ currentPair.source }}</span>
          </p>
        </div>

        <div
          v-if="listeningErrorMsg"
          class="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
        >
          {{ t(listeningErrorMsg) }}
        </div>
      </div>

      <!-- Speaking Drill -->
      <div v-if="drillMode === 'speaking'" class="space-y-6">
        <div class="text-center">
          <p class="text-2xl font-semibold">{{ currentPair.source }}</p>
          <p class="mt-2 text-sm text-slate-500">{{ t('drills.speak_the_phrase') }}</p>
        </div>

        <div class="flex justify-center">
          <button
            v-if="!isRecording"
            class="rounded-full bg-red-100 p-6 text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
            :disabled="isProcessing"
            :aria-label="t('drills.record')"
            @click="startRecording()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 18.5a6 6 0 006-6V8a6 6 0 10-12 0v4.5a6 6 0 006 6z"
              />
            </svg>
          </button>
          <button
            v-else
            class="rounded-full bg-slate-200 p-6 text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
            :aria-label="t('drills.stop')"
            @click="stopRecording()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-10 w-10"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        </div>

        <p v-if="isRecording" class="text-center text-sm text-red-600 animate-pulse">
          {{ t('drills.recording') }}
        </p>
        <p v-if="isProcessing" class="text-center text-sm text-slate-500">
          {{ t('common.loading') }}
        </p>

        <div v-if="transcriptText" class="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
          <p class="text-sm">
            <span class="text-slate-500">{{ t('drills.transcript') }}: </span>
            <span class="font-mono">{{ transcriptText }}</span>
          </p>
          <p v-if="similarity !== null" class="mt-2 text-sm">
            {{ t('drills.similarity') }}: {{ similarityPercent }}%
          </p>
          <p v-if="scoreFeedback" class="mt-1 font-medium">{{ t(scoreFeedback) }}</p>
        </div>

        <div
          v-if="speakingErrorMsg"
          class="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
        >
          {{ t(speakingErrorMsg) }}
        </div>
      </div>

      <!-- Typing Drill -->
      <div v-if="drillMode === 'typing'" class="space-y-6">
        <div class="text-center">
          <p class="text-2xl font-semibold">{{ currentPair.target }}</p>
          <p class="mt-2 text-sm text-slate-500">{{ t('drills.type_what_you_hear') }}</p>
        </div>

        <div v-if="showHint" class="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
          <p class="text-sm text-slate-600 dark:text-slate-300" dir="auto">
            {{ t('drills.hint') }}: {{ getHint(currentPair.source) }}
          </p>
        </div>

        <input
          v-model="userAnswer"
          type="text"
          class="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg dark:border-slate-700 dark:bg-slate-800"
          :placeholder="t('drills.type_what_you_hear')"
          @keyup.enter="checkAnswer(currentPair.source)"
        />

        <div class="flex gap-3">
          <button
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            @click="toggleHint"
          >
            {{ t('drills.hint') }}
          </button>
          <button
            class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            @click="checkAnswer(currentPair.source)"
          >
            {{ t('drills.check') }}
          </button>
        </div>

        <div v-if="result" class="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
          <p class="font-medium">{{ t(scoreFeedback!) }}</p>
          <p class="mt-1 text-sm text-slate-500">
            {{ t('drills.similarity') }}: {{ resultPercent }}%
          </p>
        </div>
      </div>
    </div>

    <div class="mt-6 flex justify-between">
      <button
        class="rounded-lg border border-slate-300 px-4 py-2 text-sm transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        :disabled="currentIndex === 0"
        @click="prevCard"
      >
        ← {{ t('common.previous') }}
      </button>
      <button
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        :disabled="currentIndex >= pairs.length - 1"
        @click="nextCard"
      >
        {{ t('common.next') }} →
      </button>
    </div>
  </section>
</template>
