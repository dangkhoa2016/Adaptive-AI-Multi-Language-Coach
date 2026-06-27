<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

onMounted(() => {
  if (!auth.user) {
    auth.fetchUser()
  }
})

async function handleLogout() {
  await auth.signOut()
  router.push({ name: 'login' })
}

async function handleExport() {
  await auth.exportData()
}
</script>

<template>
  <section class="mx-auto max-w-2xl px-6 py-8">
    <div v-if="!auth.user && auth.loading" class="text-center">{{ t('common.loading') }}</div>
    <div v-else-if="!auth.user" class="text-center">
      <p class="mb-4">{{ t('auth.not_logged_in') }}</p>
      <router-link :to="{ name: 'login' }" class="text-blue-600 hover:underline">
        {{ t('auth.login_title') }}
      </router-link>
    </div>
    <div v-else>
      <h1 class="mb-6 text-2xl font-bold">{{ t('auth.profile_title') }}</h1>

      <dl class="space-y-3">
        <div>
          <dt class="text-sm text-gray-500">Email</dt>
          <dd class="font-medium">{{ auth.user.email }}</dd>
        </div>
        <div>
          <dt class="text-sm text-gray-500">{{ t('auth.activated_date') }}</dt>
          <dd class="font-medium">{{ auth.user.activatedDate ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-sm text-gray-500">{{ t('auth.member_since') }}</dt>
          <dd class="font-medium">{{ auth.user.createdAt?.split('T')[0] ?? '—' }}</dd>
        </div>
      </dl>

      <div class="mt-8 space-y-3">
        <button
          class="w-full rounded border border-gray-300 px-4 py-2 text-sm transition hover:bg-gray-50"
          @click="handleExport"
        >
          {{ t('auth.export_data') }}
        </button>
        <button
          class="w-full rounded bg-red-600 px-4 py-2 text-white transition hover:bg-red-700"
          @click="handleLogout"
        >
          {{ t('auth.logout') }}
        </button>
      </div>
    </div>
  </section>
</template>
