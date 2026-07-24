import { createRouter, createMemoryHistory } from 'vue-router'
import Home from '../views/Home.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/about',
    name: 'About',
    // 路由懒加载
    component: () => import('../views/About.vue')
  }
]

const router = createRouter({
  // Electron 环境中使用 memory history 模式
  history: createMemoryHistory(),
  routes
})

export default router
