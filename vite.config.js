import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // For GitHub Pages, change this to '/YOUR-REPO-NAME/' if the repo is not <username>.github.io
  base: './',
})