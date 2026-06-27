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
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
  },
  {
    path: '/auth/verify',
    name: 'verify',
    component: () => import('../views/VerifyView.vue'),
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/ProfileView.vue'),
  },
  {
    path: '/review',
    name: 'review',
    component: () => import('../views/ReviewView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
