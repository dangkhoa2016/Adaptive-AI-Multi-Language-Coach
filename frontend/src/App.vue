<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterView, RouterLink } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { usePrefsStore } from './stores/prefs'
import { useI18n } from 'vue-i18n'
import ToastContainer from './components/ToastContainer.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'

const auth = useAuthStore()
const prefs = usePrefsStore()
const { t } = useI18n()

const menuOpen = ref(false)
function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

watch(
  () => prefs.theme,
  (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  },
  { immediate: true },
)

onMounted(() => {
  auth.fetchUser()
})
</script>

<template>
  <main class="min-h-screen">
    <nav class="flex items-center justify-between border-b px-6 py-3">
      <!-- Logo (always visible) -->
      <RouterLink :to="{ name: 'home' }" class="text-lg font-bold">AI Vocab Coach</RouterLink>

      <!-- Desktop nav links (hidden on mobile) -->
      <div class="hidden items-center gap-6 md:flex">
        <RouterLink
          v-if="auth.user"
          :to="{ name: 'review' }"
          class="text-sm text-blue-600 hover:underline"
        >
          {{ t('nav.review') }}
        </RouterLink>
        <RouterLink
          v-if="auth.user"
          :to="{ name: 'reviews' }"
          class="text-sm text-blue-600 hover:underline"
        >
          {{ t('nav.reviewHistory') }}
        </RouterLink>
        <RouterLink
          v-if="auth.user"
          :to="{ name: 'vocabulary' }"
          class="text-sm text-blue-600 hover:underline"
        >
          {{ t('nav.vocabulary') }}
        </RouterLink>
      </div>

      <!-- Desktop right group (hidden on mobile) -->
      <div class="hidden items-center gap-4 text-sm md:flex">
        <button
          class="rounded p-1 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
          :aria-label="prefs.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="prefs.toggleTheme()"
        >
          {{ prefs.theme === 'dark' ? '☀️' : '🌙' }}
        </button>
        <RouterLink
          v-if="auth.user"
          :to="{ name: 'profile' }"
          class="text-blue-600 hover:underline"
        >
          {{ auth.user.email }}
        </RouterLink>
        <RouterLink v-else :to="{ name: 'login' }" class="text-blue-600 hover:underline">
          Sign in
        </RouterLink>
      </div>

      <!-- Hamburger button (visible only on mobile) -->
      <button class="flex items-center p-2 md:hidden" aria-label="Toggle menu" @click="toggleMenu">
        <span v-if="menuOpen">✕</span>
        <span v-else>☰</span>
      </button>
    </nav>

    <!-- Mobile menu panel (below md:) -->
    <div v-if="menuOpen" class="border-b dark:border-slate-700 md:hidden" @click="menuOpen = false">
      <div class="flex flex-col gap-4 px-6 py-4">
        <div class="flex flex-col gap-2">
          <RouterLink
            v-if="auth.user"
            :to="{ name: 'review' }"
            class="text-sm text-blue-600 hover:underline"
          >
            {{ t('nav.review') }}
          </RouterLink>
          <RouterLink
            v-if="auth.user"
            :to="{ name: 'reviews' }"
            class="text-sm text-blue-600 hover:underline"
          >
            {{ t('nav.reviewHistory') }}
          </RouterLink>
          <RouterLink
            v-if="auth.user"
            :to="{ name: 'vocabulary' }"
            class="text-sm text-blue-600 hover:underline"
          >
            {{ t('nav.vocabulary') }}
          </RouterLink>
        </div>
        <div class="flex items-center gap-4 border-t pt-4 text-sm dark:border-slate-700">
          <button
            class="rounded p-1 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
            :aria-label="prefs.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="prefs.toggleTheme()"
          >
            {{ prefs.theme === 'dark' ? '☀️' : '🌙' }}
          </button>
          <RouterLink
            v-if="auth.user"
            :to="{ name: 'profile' }"
            class="text-blue-600 hover:underline"
          >
            {{ auth.user.email }}
          </RouterLink>
          <RouterLink v-else :to="{ name: 'login' }" class="text-blue-600 hover:underline">
            Sign in
          </RouterLink>
        </div>
      </div>
    </div>
    <ErrorBoundary>
      <RouterView />
    </ErrorBoundary>
    <ToastContainer />
  </main>
</template>
