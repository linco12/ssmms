import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

function firebaseSwPlugin() {
  return {
    name: 'firebase-sw-env-inject',
    closeBundle() {
      const swPath = resolve('public', 'firebase-messaging-sw.js')
      const outPath = resolve('dist', 'firebase-messaging-sw.js')
      let src = readFileSync(swPath, 'utf-8')
      const vars = [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_DATABASE_URL',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_STORAGE_BUCKET',
        'VITE_FIREBASE_MESSAGING_SENDER_ID',
        'VITE_FIREBASE_APP_ID',
      ]
      vars.forEach(k => {
        src = src.replace(`__${k}__`, process.env[k] || '')
      })
      writeFileSync(outPath, src)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)
  return {
    // GitHub Actions sets GITHUB_ACTIONS=true → use /ssmms/ base for Pages
    // Electron uses file:// protocol → needs relative './' base
    base: process.env.GITHUB_ACTIONS ? '/ssmms/' : './',
    plugins: [react(), tailwindcss(), firebaseSwPlugin()],
  }
})
