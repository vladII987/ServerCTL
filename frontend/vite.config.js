import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
  define: {
    'import.meta.env.VITE_API_URL':        JSON.stringify(process.env.VITE_API_URL || ''),
    'import.meta.env.VITE_DASHBOARD_TOKEN': JSON.stringify(process.env.VITE_DASHBOARD_TOKEN || 'change-me'),
  }
})
