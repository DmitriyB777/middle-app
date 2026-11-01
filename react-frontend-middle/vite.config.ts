import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget =
    env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'

  const proxy = {
    '/api': {
      target: apiProxyTarget,
      changeOrigin: true,
    },
  }

  return {
    plugins: [react()],
    server: {
      proxy,
    },
    preview: {
      proxy,
    },
  }
})
