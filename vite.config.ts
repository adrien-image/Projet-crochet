import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Projet-crochet/',
  build: {
    // three.js (≈575 ko) est isolé dans son propre fichier, chargé à la demande
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        // three.js n'est chargé qu'à l'ouverture de l'aperçu 3D
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
