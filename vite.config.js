import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        // The stylesheet keeps a stable name; fonts and images get hashed ones.
        assetFileNames: (a) => ((a.names?.[0] || a.name || '').endsWith('.css') ? 'assets/app.css' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
})
