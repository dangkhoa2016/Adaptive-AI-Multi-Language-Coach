<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const step = ref(1)
function getOnboardingDone(): boolean {
  try {
    return localStorage.getItem('vocab.onboarding_done') === 'true'
  } catch {
    return false
  }
}

function setOnboardingDone(): void {
  try {
    localStorage.setItem('vocab.onboarding_done', 'true')
  } catch {
    // localStorage may be unavailable
  }
}

const done = ref(getOnboardingDone())

const steps = [
  { title: 'onboarding.step1_title', description: 'onboarding.step1_desc' },
  { title: 'onboarding.step2_title', description: 'onboarding.step2_desc' },
  { title: 'onboarding.step3_title', description: 'onboarding.step3_desc' },
]

function next() {
  if (step.value < steps.length) step.value++
  else finish()
}
function finish() {
  setOnboardingDone()
  done.value = true
}
function skip() {
  finish()
}
</script>

<template>
  <div
    v-if="!done"
    class="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-6 dark:border-indigo-800 dark:bg-indigo-900/20"
  >
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <h3 class="font-semibold text-indigo-800 dark:text-indigo-200">
          {{ t(steps[step - 1].title) }}
        </h3>
        <p class="mt-1 text-sm text-indigo-600 dark:text-indigo-300">
          {{ t(steps[step - 1].description) }}
        </p>
      </div>
      <button
        class="ml-4 text-sm text-indigo-500 hover:text-indigo-700 dark:text-indigo-400"
        @click="skip"
      >
        {{ t('onboarding.skip') }}
      </button>
    </div>
    <div class="mt-4 flex items-center justify-between">
      <div class="flex gap-1.5">
        <div
          v-for="i in steps.length"
          :key="i"
          class="h-2 w-2 rounded-full"
          :class="i === step ? 'bg-indigo-500' : 'bg-indigo-200 dark:bg-indigo-700'"
        />
      </div>
      <button
        class="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        @click="next"
      >
        {{ step < steps.length ? t('onboarding.next') : t('onboarding.get_started') }}
      </button>
    </div>
  </div>
</template>
