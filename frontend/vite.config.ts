import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['cytoscape', 'cytoscape-fcose', 'cose-base', 'cytoscape-cola'],
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      include: [/cytoscape-fcose/, /cose-base/, /cytoscape-cola/, /node_modules/],
    },
  },
})

