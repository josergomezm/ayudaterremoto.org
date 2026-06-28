import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // Capacitor loads the app from capacitor://localhost — relative asset
  // paths are required or the native build 404s on every chunk.
  base: './',
  build: { outDir: 'dist' },
  server: {
    host: true,
    // Acepta cualquier host (incluye túneles ngrok: .ngrok-free.dev, .ngrok-free.app, etc.)
    // sin el error "Blocked request. This host is not allowed." Solo dev local.
    allowedHosts: true,
  },
})
