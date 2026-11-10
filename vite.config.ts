import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 开发期把 /api 代理到后端 FastAPI（避免 CORS）
const API_TARGET = process.env.VITE_API_TARGET || 'http://127.0.0.1:8600'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5273,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
