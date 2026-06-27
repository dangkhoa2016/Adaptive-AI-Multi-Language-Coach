<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const auth = useAuthStore()

const email = ref('')
const submitted = ref(false)

function validateEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

async function handleSubmit() {
  if (!validateEmail(email.value)) return
  await auth.requestLink(email.value)
  if (!auth.error) {
    submitted.value = true
  }
}
</script>

<template>
  <section class="mx-auto max-w-md px-6 py-16">
    <h1 class="mb-8 text-center text-2xl font-bold">{{ t('auth.login_title') }}</h1>

    <div v-if="submitted" class="text-center">
      <p class="mb-2 text-lg font-semibold text-green-700">{{ t('auth.link_sent') }}</p>
      <p class="text-gray-600">{{ t('auth.check_email') }}</p>
      <button class="mt-6 text-sm text-blue-600 hover:underline" @click="submitted = false">
        {{ t('common.back') }}
      </button>
    </div>

    <form v-else class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label for="auth-email" class="mb-1 block text-sm font-medium">{{
          t('auth.email_label')
        }}</label>
        <input
          id="auth-email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          :placeholder="t('auth.email_label')"
        />
      </div>

      <div
        v-if="auth.error"
        role="alert"
        aria-live="assertive"
        class="rounded bg-red-50 p-3 text-sm text-red-700"
      >
        {{ auth.error }}
      </div>

      <button
        type="submit"
        :disabled="auth.loading || !email"
        class="w-full rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {{ auth.loading ? t('common.loading') : t('auth.send_link') }}
      </button>
    </form>
  </section>
</template>
