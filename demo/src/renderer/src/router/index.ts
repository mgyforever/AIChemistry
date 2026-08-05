import { createRouter, createWebHashHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Home from '../views/Home.vue'
import ExperimentLab from '../views/ExperimentLab.vue'
import ExperimentBuilder from '../views/ExperimentBuilder.vue'
import ReproductionLab from '../views/ReproductionLab.vue'
import StepDetailPage from '../views/StepDetailPage.vue'

const routes = [
  {
    path: '/',
    redirect: '/lab'
  },
  {
    path: '/lab',
    name: 'ExperimentLab',
    component: ExperimentLab
  },
  {
    path: '/lab/:id',
    name: 'ExperimentBuilder',
    component: ExperimentBuilder
  },
  {
    path: '/repro',
    name: 'ReproductionLab',
    component: ReproductionLab
  },
  {
    path: '/step-detail',
    name: 'StepDetailPage',
    component: StepDetailPage
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/register',
    name: 'Register',
    component: Register
  },
  {
    path: '/chat',
    name: 'Chat',
    component: Home
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.afterEach((to, from) => {
  console.log(`[Router] 路由跳转: ${from.fullPath || '(初始)'} → ${to.fullPath}`)
})

export default router
