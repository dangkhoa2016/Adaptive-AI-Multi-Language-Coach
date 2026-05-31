import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/flashcard',
    name: 'flashcard',
    component: () => import('../views/FlashcardView.vue'),
  },
  {
    path: '/quiz',
    name: 'quiz',
    component: () => import('../views/QuizView.vue'),
  },
  {
    path: '/result',
    name: 'result',
    component: () => import('../views/ResultView.vue'),
  },
  {
    path: '/drill',
    name: 'drill',
    component: () => import('../views/DrillView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
