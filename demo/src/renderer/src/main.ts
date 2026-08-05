import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { themeStore } from './stores/theme'

themeStore.init()
console.log('[Main] 渲染进程启动，主题初始化完成:', themeStore.mode)

const app = createApp(App)
app.use(router)
app.mount('#app')
console.log('[Main] 应用挂载完成')
