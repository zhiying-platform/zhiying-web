import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/tasks' },
  { path: '/tasks', name: 'tasks', component: () => import('../views/TaskConsole.vue'), meta: { title: '任务台' } },
  { path: '/arts', name: 'docs', component: () => import('../views/DocsView.vue'), meta: { title: '文档库' } },
  { path: '/library', name: 'library', component: () => import('../views/KnowledgeBase.vue'), meta: { title: '知识库' } },
  { path: '/ask', name: 'ask', component: () => import('../views/AskView.vue'), meta: { title: '问答' } },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
