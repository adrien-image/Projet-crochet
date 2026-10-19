import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
  // silence joué en boucle pour les commandes du casque et de l'écran verrouillé (compteur)
  "media-src 'self' blob:",
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

// Service worker généré avec la liste de tous les fichiers du build (même ceux chargés à la demande)
// et une version qui change à chaque build : le navigateur installe la nouvelle version, l'ancienne
// est libérée.
const PUBLIC_FILES = ['manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png']
// Lecture des PDF scannés (Tesseract.js) : worker, moteur WebAssembly et langues servis par
// l'application, sous ocr/. Gros fichiers chargés seulement à la première lecture d'un scan : ils ne
// sont pas mis en cache à l'installation.
const OCR_FILES: Record<string, string> = {
  'ocr/worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
  ...Object.fromEntries(['', '-simd', '-relaxedsimd'].map((v) => [`ocr/core/tesseract-core${v}-lstm.wasm.js`, `node_modules/tesseract.js-core/tesseract-core${v}-lstm.wasm.js`])),
  ...Object.fromEntries(['eng', 'fra', 'spa', 'deu', 'ita', 'por', 'nld'].map((l) => [`ocr/lang/${l}.traineddata.gz`, `node_modules/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`])),
}
const ocrFiles = (base: string): Plugin => ({
  name: 'ocr-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const file = OCR_FILES[(req.url ?? '').split('?')[0].replace(base, '')]
      if (!file) return next()
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream')
      res.end(readFileSync(file))
    })
  },
  generateBundle() {
    for (const [fileName, file] of Object.entries(OCR_FILES)) this.emitFile({ type: 'asset', fileName, source: readFileSync(file) })
  },
})

const serviceWorker = (): Plugin => ({
  name: 'service-worker',
  apply: 'build',
  generateBundle(_, bundle) {
    const files = [...Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map') && !(f in OCR_FILES)), ...PUBLIC_FILES].sort()
    const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)
    const source = readFileSync(new URL('./src/sw/sw.template.js', import.meta.url), 'utf8')
      .replace('__SW_VERSION__', version)
      .replace('/* __SW_ASSETS__ */ []', JSON.stringify(files))
    this.emitFile({ type: 'asset', fileName: 'sw.js', source })
  },
})

const BASE = '/Projet-crochet/'

export default defineConfig({
  plugins: [react(), csp(), ocrFiles(BASE), serviceWorker()],
  base: BASE,
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
