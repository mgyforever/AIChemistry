import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { themeStore } from './stores/theme'

themeStore.init()

const app = createApp(App)
app.use(router)
app.mount('#app')
