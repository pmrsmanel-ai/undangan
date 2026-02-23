import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Hapus "base: '/undangan/'" atau ubah menjadi '/' untuk Cloudflare Pages
  base: '/', 
})