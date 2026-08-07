import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: {
      // The entry chunk is already fetched by the initial <script type="module">,
      // so listing it again as a dependency of an async chunk produces a preload
      // that is never used. WebKit reports that as a console warning, which the
      // accessibility gate counts as a failure. Preloads for genuinely new
      // dependencies are still emitted.
      resolveDependencies: (_filename, deps) => deps.filter((dep) => !/(^|\/)index-[\w-]+\.js$/.test(dep)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
  },
})
