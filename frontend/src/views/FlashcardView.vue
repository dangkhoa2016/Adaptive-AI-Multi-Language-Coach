<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '../stores/session'
import { usePrefsStore } from '../stores/prefs'
import { useTTS } from '../composables/useTTS'
import { useSavePairs } from '../composables/useSavePairs'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'
import Flashcard from '../components/Flashcard.vue'
import ProgressBar from '../components/ProgressBar.vue'

const router = useRouter()
const { t } = useI18n()
const session = useSessionStore()
const prefs = usePrefsStore()
const { speak } = useTTS()
const { savedIndices, savingIndices, isSavingAll, error, savePair, saveAll } = useSavePairs(
  computed(() => session.pairs),
)

const currentPair = computed(() => session.pairs[session.currentCardIndex] ?? null)
const currentSaved = computed(() => savedIndices.value.has(session.currentCardIndex))
const currentSaving = computed(() => savingIndices.value.has(session.currentCardIndex))
const allSaved = computed(
  () => session.pairs.length > 0 && savedIndices.value.size === session.pairs.length,
)

onMounted(() => {
  if (session.pairs.length === 0) {
    router.push({ name: 'home' })
  }
})

function tts() {
  const pair = currentPair.value
  if (pair) {
    speak(pair.source, prefs.source)
  }
}

function startQuiz() {
  router.push({ name: 'quiz' })
}

useKeyboardShortcuts({
  ' ': session.toggleFlip,
  ArrowRight: () => session.nextCard(),
  ArrowLeft: () => session.prevCard(),
  s: () => savePair(session.currentCardIndex),
})
</script>

<template>
  <section class="mx-auto max-w-2xl px-6 py-8">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold tracking-tight">{{ t('flashcard.title') }}</h1>
      <div class="flex items-center gap-2">
        <button
          v-if="!allSaved"
          :disabled="isSavingAll"
          class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          :class="
            isSavingAll
              ? 'bg-slate-200 text-slate-400 dark:bg-slate-700'
              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50'
          "
          @click="saveAll()"
        >
          {{ isSavingAll ? t('review.saving') : t('review.save_all') }}
        </button>
        <button
          class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          aria-label="Back to home"
          @click="router.push({ name: 'home' })"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"
            />
          </svg>
        </button>
      </div>
    </div>

    <template v-if="currentPair && session.pairs.length > 0">
      <div class="mt-4">
        <ProgressBar :current="session.currentCardIndex + 1" :total="session.pairs.length" />
        <p class="mt-1 text-center text-xs text-slate-400">
          {{
            t('flashcard.card_progress', {
              current: session.currentCardIndex + 1,
              total: session.pairs.length,
            })
          }}
        </p>
      </div>

      <div class="mt-6">
        <Flashcard
          :pair="currentPair"
          :flipped="session.flipped"
          :source-lang="prefs.source"
          @flip="session.toggleFlip()"
        />
      </div>

      <div class="mt-4 flex items-center justify-between gap-4">
        <button
          aria-label="Previous card"
          class="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
          :class="
            session.currentCardIndex > 0
              ? 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'
              : 'bg-slate-100 dark:bg-slate-800'
          "
          :disabled="session.currentCardIndex === 0"
          @click="session.prevCard()"
        >
          {{ t('flashcard.previous') }}
        </button>

        <button
          aria-label="Listen to pronunciation"
          class="rounded-lg bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
          @click="tts()"
        >
          TTS
        </button>

        <button
          :disabled="currentSaved"
          class="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          :class="
            currentSaved
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
          "
          @click="savePair(session.currentCardIndex)"
        >
          {{
            currentSaving ? t('review.saving') : currentSaved ? t('review.saved') : t('review.save')
          }}
        </button>

        <button
          aria-label="Next card"
          class="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
          :class="
            session.currentCardIndex < session.pairs.length - 1
              ? 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'
              : 'bg-slate-100 dark:bg-slate-800'
          "
          :disabled="session.currentCardIndex >= session.pairs.length - 1"
          @click="session.nextCard()"
        >
          {{ t('flashcard.next') }}
        </button>
      </div>

      <div v-if="error" class="mt-4 text-center text-sm text-red-600">
        {{ error }}
      </div>

      <div class="mt-6 text-center">
        <button
          class="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          @click="startQuiz()"
        >
          {{ t('flashcard.start_quiz') }}
        </button>
      </div>
    </template>
  </section>
</template>
