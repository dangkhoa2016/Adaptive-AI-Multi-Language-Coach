<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  fetchVocabList,
  deleteVocabPair,
  updateVocabPair,
  type LearnedPair,
  type UpdateVocabRequest,
} from '../api/client'
import SkeletonLoader from '../components/SkeletonLoader.vue'

const { t } = useI18n()

const pairs = ref<LearnedPair[]>([])
const total = ref(0)
const page = ref(1)
const limit = 20
const search = ref('')
const loading = ref(true)
const deleting = ref<Set<string>>(new Set())
const error = ref<string | null>(null)

let searchTimer: ReturnType<typeof setTimeout> | null = null

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))
const hasPrev = computed(() => page.value > 1)
const hasNext = computed(() => page.value < totalPages.value)

const learningCount = computed(() => pairs.value.filter((p) => p.status === 'learning').length)
const masteredCount = computed(() => pairs.value.filter((p) => p.status === 'mastered').length)

function statusColor(status: string): string {
  if (status === 'learning')
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (status === 'mastered')
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
}

function statusLabel(status: string): string {
  if (status === 'learning') return t('vocabulary.status_learning')
  if (status === 'mastered') return t('vocabulary.status_mastered')
  return status
}

function formatDate(iso: string | null): string {
  if (!iso) return t('vocabulary.now')
  const d = new Date(iso)
  const now = new Date()
  if (d <= now) return t('vocabulary.now')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatEase(ease: number): string {
  return ease.toFixed(1)
}

function onSearchInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = value
    page.value = 1
    loadPage(1)
  }, 300)
}

async function loadPage(p: number) {
  loading.value = true
  error.value = null
  try {
    const res = await fetchVocabList(p, limit, search.value || undefined)
    pairs.value = res.pairs
    total.value = res.total
    page.value = res.page
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'errors.generic'
  } finally {
    loading.value = false
  }
}

async function handleDelete(pairId: string) {
  if (!confirm(t('vocabulary.delete_confirm'))) return
  deleting.value.add(pairId)
  try {
    await deleteVocabPair(pairId)
    pairs.value = pairs.value.filter((p) => p.id !== pairId)
    total.value--
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'errors.generic'
  } finally {
    deleting.value.delete(pairId)
  }
}

const editingPair = ref<LearnedPair | null>(null)
const editForm = ref<UpdateVocabRequest>({
  sourceText: '',
  targetText: '',
  ipa: '',
  pos: '',
  exampleSource: '',
  exampleTarget: '',
})
const saving = ref(false)
const editError = ref<string | null>(null)

function openEdit(pair: LearnedPair) {
  editingPair.value = pair
  editForm.value = {
    sourceText: pair.source_text,
    targetText: pair.target_text,
    ipa: pair.ipa ?? '',
    pos: pair.pos ?? '',
    exampleSource: pair.example_source ?? '',
    exampleTarget: pair.example_target ?? '',
  }
  editError.value = null
}

function closeEdit() {
  editingPair.value = null
  editError.value = null
}

async function handleSave() {
  if (!editingPair.value) return
  saving.value = true
  editError.value = null
  const body: UpdateVocabRequest = {
    sourceText: editForm.value.sourceText,
    targetText: editForm.value.targetText,
    ipa: editForm.value.ipa || undefined,
    pos: editForm.value.pos || undefined,
    exampleSource: editForm.value.exampleSource || undefined,
    exampleTarget: editForm.value.exampleTarget || undefined,
  }
  try {
    const updated = await updateVocabPair(editingPair.value.id, body)
    const idx = pairs.value.findIndex((p) => p.id === updated.id)
    if (idx !== -1) pairs.value[idx] = updated
    closeEdit()
  } catch (e) {
    editError.value = e instanceof Error ? e.message : t('vocabulary.edit_error')
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

onMounted(() => {
  loadPage(1)
})
</script>

<template>
  <section class="mx-auto max-w-2xl px-6 py-8">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('vocabulary.title') }}</h1>

    <div class="mt-6">
      <input
        type="text"
        class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
        :placeholder="t('vocabulary.search_placeholder')"
        @input="onSearchInput"
      />
    </div>

    <div class="mt-4 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
      <span>{{ t('vocabulary.total_count') }}: {{ total }}</span>
      <span>{{ t('vocabulary.learning_count') }}: {{ learningCount }}</span>
      <span>{{ t('vocabulary.mastered_count') }}: {{ masteredCount }}</span>
    </div>

    <template v-if="loading">
      <div class="mt-6 space-y-3">
        <div v-for="i in 5" :key="i">
          <SkeletonLoader variant="text" height="3rem" class="w-full" />
        </div>
      </div>
    </template>

    <template v-else-if="error">
      <div class="mt-8 text-center text-sm text-red-600">{{ error }}</div>
    </template>

    <template v-else-if="pairs.length === 0">
      <div class="mt-16 text-center text-sm text-slate-400">
        {{ t('vocabulary.no_results') }}
        <RouterLink :to="{ name: 'home' }" class="text-blue-600 hover:underline">
          {{ t('common.back') }}
        </RouterLink>
      </div>
    </template>

    <template v-else>
      <div class="mt-6 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <table class="w-full text-sm">
          <thead
            class="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          >
            <tr>
              <th class="px-4 py-3">{{ t('vocabulary.word') }}</th>
              <th class="px-4 py-3">{{ t('vocabulary.status') }}</th>
              <th class="px-4 py-3">{{ t('vocabulary.ease') }}</th>
              <th class="px-4 py-3">{{ t('vocabulary.next_review') }}</th>
              <th class="px-4 py-3 text-right">{{ t('vocabulary.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
            <tr
              v-for="pair in pairs"
              :key="pair.id"
              class="hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                {{ pair.source_text }} → {{ pair.target_text }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                  :class="statusColor(pair.status)"
                >
                  {{ statusLabel(pair.status) }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-500 dark:text-slate-400">
                {{ formatEase(pair.ease) }}
              </td>
              <td class="px-4 py-3 text-slate-500 dark:text-slate-400">
                {{ formatDate(pair.next_review) }}
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  class="mr-2 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  aria-label="Edit"
                  @click="openEdit(pair)"
                >
                  ✏️
                </button>
                <button
                  :disabled="deleting.has(pair.id)"
                  class="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-900/20"
                  aria-label="Delete"
                  @click="handleDelete(pair.id)"
                >
                  {{ deleting.has(pair.id) ? '...' : '🗑' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" class="mt-6 flex items-center justify-between">
        <button
          :disabled="!hasPrev"
          class="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
          :class="
            hasPrev
              ? 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'
              : 'bg-slate-100 dark:bg-slate-800'
          "
          @click="loadPage(page - 1)"
        >
          {{ t('vocabulary.prev') }}
        </button>
        <span class="text-xs text-slate-400"
          >{{ t('vocabulary.page') }} {{ page }} / {{ totalPages }}</span
        >
        <button
          :disabled="!hasNext"
          class="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
          :class="
            hasNext
              ? 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600'
              : 'bg-slate-100 dark:bg-slate-800'
          "
          @click="loadPage(page + 1)"
        >
          {{ t('vocabulary.next') }}
        </button>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="editingPair"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="closeEdit"
      >
        <div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">
              {{ t('vocabulary.edit_title') }}
            </h2>
            <button
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              @click="closeEdit"
            >
              ✕
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ t('vocabulary.edit_source') }} <span class="text-red-500">*</span>
              </label>
              <input
                v-model="editForm.sourceText"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ t('vocabulary.edit_target') }} <span class="text-red-500">*</span>
              </label>
              <input
                v-model="editForm.targetText"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ t('vocabulary.edit_ipa') }}
              </label>
              <input
                v-model="editForm.ipa"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ t('vocabulary.edit_pos') }}
              </label>
              <input
                v-model="editForm.pos"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ t('vocabulary.edit_example_source') }}
              </label>
              <input
                v-model="editForm.exampleSource"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ t('vocabulary.edit_example_target') }}
              </label>
              <input
                v-model="editForm.exampleTarget"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
              />
            </div>
          </div>

          <div v-if="editError" class="mt-4 text-sm text-red-600">
            {{ editError }}
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              @click="closeEdit"
            >
              {{ t('vocabulary.edit_cancel') }}
            </button>
            <button
              :disabled="saving"
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              @click="handleSave"
            >
              {{ saving ? t('vocabulary.edit_saving') : t('vocabulary.edit_save') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
