import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// Politique de sécurité du contenu (GitHub Pages n'envoie pas d'en-têtes : balise <meta>). Tout est
// servi par l'application ; les photos et fichiers sont affichés en blob: / data:. Seulement au build :
// le serveur de développement injecte des scripts en ligne.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // attributs style="" (couleurs calculées) : pas de feuille de style externe
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  // aperçu du PDF joint
  "frame-src blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "manifest-src 'self'",
].join('; ')

const csp = (): Plugin => ({
  name: 'csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
})

export default defineConfig({
  plugins: [react(), csp()],
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
