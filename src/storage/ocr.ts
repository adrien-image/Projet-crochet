// Lecture des PDF scannés (OCR, Tesseract.js) : chargée seulement quand un PDF n'a presque pas de texte.
// Le moteur, son worker et les langues (français, anglais) sont servis par l'application (dossier
// ocr/, voir vite.config.ts) : rien n'est envoyé ni téléchargé ailleurs.
import type { TextPiece } from './pdfText'

export interface Ocr {
  /** fragments de texte d'une page rendue à l'échelle `scale` (unités du PDF, origine en bas à gauche) */
  read(canvas: HTMLCanvasElement, scale: number): Promise<TextPiece[]>
  close(): Promise<void>
}

/** Mots trop incertains (taches, motifs, photos) ignorés. */
const MIN_CONFIDENCE = 35

export async function createOcr(onProgress?: (progress: number) => void): Promise<Ocr> {
  const { createWorker, OEM } = await import('tesseract.js')
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, location.href).href
  const worker = await createWorker(['fra', 'eng'], OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core`,
    langPath: `${base}lang`,
    workerBlobURL: false,
    // le service worker garde déjà les fichiers : pas de seconde copie dans IndexedDB
    cacheMethod: 'none',
    logger: (m: { status: string, progress: number }) => { if (m.status === 'recognizing text') onProgress?.(m.progress) },
  })
  return {
    async read(canvas, scale) {
      const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false })
      const pieces: TextPiece[] = []
      for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            // tous les mots d'une ligne sur la même ligne de base (les lettres hautes ou basses varient)
            const y = (canvas.height - line.bbox.y1) / scale
            const h = ((line.bbox.y1 - line.bbox.y0) / scale) * 0.8
            for (const w of line.words) {
              if (w.confidence < MIN_CONFIDENCE || !w.text.trim()) continue
              pieces.push({ s: w.text, x: w.bbox.x0 / scale, y, w: (w.bbox.x1 - w.bbox.x0) / scale, h })
            }
          }
        }
      }
      return pieces
    },
    close: () => worker.terminate().then(() => undefined),
  }
}
