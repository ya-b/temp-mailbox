import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'mailboxes',
      component: () => import('../views/MailboxConsoleView.vue'),
    },
  ],
})

export default router
