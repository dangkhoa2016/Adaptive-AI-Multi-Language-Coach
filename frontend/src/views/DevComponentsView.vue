<script setup lang="ts">
import SkeletonLoader from '../components/SkeletonLoader.vue'
import EmptyState from '../components/EmptyState.vue'
import OnboardingBanner from '../components/OnboardingBanner.vue'
import StreakDisplay from '../components/StreakDisplay.vue'
import ActivityChart from '../components/ActivityChart.vue'
import GoalProgress from '../components/GoalProgress.vue'
import StatCard from '../components/StatCard.vue'
import ReviewStatsCard from '../components/ReviewStatsCard.vue'
import ProgressBar from '../components/ProgressBar.vue'
import AutoScaleText from '../components/AutoScaleText.vue'
import ToastContainer from '../components/ToastContainer.vue'

const sampleActivity = [
  { day: '2026-06-18', count: 5 },
  { day: '2026-06-19', count: 12 },
  { day: '2026-06-20', count: 8 },
  { day: '2026-06-21', count: 0 },
  { day: '2026-06-22', count: 15 },
  { day: '2026-06-23', count: 3 },
  { day: '2026-06-24', count: 10 },
  { day: '2026-06-25', count: 7 },
  { day: '2026-06-26', count: 20 },
  { day: '2026-06-27', count: 6 },
  { day: '2026-06-28', count: 14 },
  { day: '2026-06-29', count: 9 },
  { day: '2026-06-30', count: 11 },
  { day: '2026-07-01', count: 4 },
]

function resetOnboarding() {
  localStorage.removeItem('vocab.onboarding_done')
  window.location.reload()
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-12 p-6">
    <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">Component Catalog</h1>
    <p class="-mt-10 text-sm text-slate-400">Dev-only view — not visible in production</p>

    <section>
      <h2 class="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-300">SkeletonLoader</h2>
      <div class="space-y-4">
        <SkeletonLoader variant="text" :lines="3" />
        <SkeletonLoader variant="card" />
        <SkeletonLoader variant="circle" />
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-300">EmptyState</h2>
      <div class="space-y-4">
        <EmptyState
          icon="📭"
          title="No reviews yet"
          description="Complete your first lesson to see reviews here."
        />
        <EmptyState title="Minimal (no icon)" description="Just a title and description." />
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-300">
        OnboardingBanner
      </h2>
      <p class="mb-2 text-xs text-slate-400">
        <button class="text-indigo-500 underline" @click="resetOnboarding">Reset onboarding</button>
        (click to show banner)
      </p>
      <OnboardingBanner />
    </section>

    <section>
      <h2 class="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-300">StreakDisplay</h2>
      <StreakDisplay />
    </section>

    <section>
      <h2 class="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-300">ActivityChart</h2>
      <ActivityChart :data="sampleActivity" />
    </section>

    <section>
      <h2 class="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-300">GoalProgress</h2>
      <div class="space-y-6">
        <GoalProgress :current="12" :target="20" label="Daily reviews" />
        <GoalProgress :current="45" :target="50" label="Weekly goal" />
        <GoalProgress :current="200" :target="200" label="Monthly target" />
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-300">StatCard</h2>
      <div class="grid grid-cols-3 gap-4">
        <StatCard label="Reviews" :value="142" />
        <StatCard label="Streak" :value="7" />
        <StatCard label="Accuracy" :value="89" />
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-300">ReviewStatsCard</h2>
      <div class="grid grid-cols-2 gap-4">
        <ReviewStatsCard label="Due" :count="12" color="amber" icon="⏰" />
        <ReviewStatsCard label="New" :count="8" color="blue" icon="🆕" />
        <ReviewStatsCard label="Mastered" :count="156" color="emerald" icon="✅" />
        <ReviewStatsCard label="Total" :count="312" color="slate" icon="📊" />
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-300">ProgressBar</h2>
      <div class="space-y-6">
        <ProgressBar :current="7" :total="20" />
        <ProgressBar :current="20" :total="20" />
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-300">AutoScaleText</h2>
      <div class="space-y-2">
        <AutoScaleText text="Short" />
        <AutoScaleText text="Medium length text here" />
        <AutoScaleText
          text="This is a very long text that should trigger the auto-scale behavior"
        />
      </div>
    </section>

    <section>
      <h2 class="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-300">ToastContainer</h2>
      <p class="mb-2 text-xs text-slate-400">
        Toasts appear in the bottom-right corner. They are triggered programmatically via
        <code class="rounded bg-slate-100 px-1 dark:bg-slate-800">useToast()</code>.
      </p>
      <ToastContainer />
    </section>
  </div>
</template>
