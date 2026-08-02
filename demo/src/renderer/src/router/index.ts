import { createRouter, createMemoryHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Home from '../views/Home.vue'
import ExperimentLab from '../views/ExperimentLab.vue'
import ExperimentBuilder from '../views/ExperimentBuilder.vue'

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
  history: createMemoryHistory(),
  routes
})

export default router
