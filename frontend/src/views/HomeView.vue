<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from '@vocab/shared'
import { usePrefsStore } from '../stores/prefs'

const { t, locale } = useI18n()
const prefs = usePrefsStore()

function setLocale(value: Locale) {
  locale.value = value
  prefs.uiLocale = value
  document.documentElement.lang = value
}
</script>

<template>
  <section class="mx-auto max-w-3xl px-6 py-12">
    <h1 class="text-3xl font-bold tracking-tight">{{ t('home.title') }}</h1>
    <p class="mt-3 text-slate-600 dark:text-slate-300">{{ t('home.tagline') }}</p>

    <div class="mt-8">
      <label for="ui-locale" class="block text-sm font-medium">
        {{ t('home.ui_language') }}
      </label>
      <select
        id="ui-locale"
        :value="locale"
        class="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        @change="setLocale(($event.target as HTMLSelectElement).value as Locale)"
      >
        <option v-for="code in SUPPORTED_LOCALES" :key="code" :value="code">
          {{ LOCALE_LABELS[code] }}
        </option>
      </select>
    </div>
  </section>
</template>
