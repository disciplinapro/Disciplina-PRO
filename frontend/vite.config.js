import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { seoAssets } from './seo.config.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), seoAssets(loadEnv(mode, import.meta.dirname, 'VITE_').VITE_SITE_URL)],
  build: {
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'app.html'),
        landing: resolve(import.meta.dirname, 'index.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
}))
