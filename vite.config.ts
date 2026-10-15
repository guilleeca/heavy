import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // La app se publica en https://guilleeca.github.io/heavy/
  base: '/heavy/',
  plugins: [react()],
})
