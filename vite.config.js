import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' -> relative asset URLs, works under any GH Pages subpath or custom domain.
// Routing uses HashRouter, so deep links never 404 on GH Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
})
