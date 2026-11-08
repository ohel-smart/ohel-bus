import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// One id per build. It is baked into the bundle (__BUILD_ID__) and written to /version.json, so a
// page that is already open can ask "is there a newer build?" with one tiny file request
// (src/services/appUpdate.ts, src/UpdateWatcher.tsx).
const BUILD_ID = `${(process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 8)}-${Date.now().toString(36)}`

// https://vite.dev/config/
export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) })
      },
    },
  ],
})
