import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    server: {
      proxy: {
        // Fastify 后端
        '/chemistry': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        // CRS 化学推荐系统后端
        '/crs': {
          target: 'http://localhost:5005',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/crs/, '')
        }
      }
    },
    plugins: [vue(), tailwindcss()]
  }
})
