import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 开发期把 /api 代理到后端 FastAPI（避免 CORS）
const API_TARGET = process.env.VITE_API_TARGET || 'http://127.0.0.1:8600'

export default defineConfig({
  plugins: [vue()],
  server: {
    // 显式绑定 IPv4：默认只监听 IPv6 ::1，导致 http://127.0.0.1:5273 打不开
    host: '127.0.0.1',
    port: 5273,
    strictPort: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
