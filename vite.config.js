import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// [https://vitejs.dev/config/](https://vitejs.dev/config/)
export default defineConfig({
  plugins: [react()],
  // WAJIB DITAMBAHKAN: Sesuaikan dengan nama repo GitHub Anda
  // (Pastikan ada garis miring di awal dan akhir)
  base: '/undangan-pmr/', 
})
