// Lecture des PDF scannés (OCR, Tesseract.js) : chargée seulement quand un PDF n'a presque pas de texte.
// Le moteur, son worker et les langues (français, anglais, espagnol, allemand, italien, portugais,
// néerlandais) sont servis par l'application (dossier
// ocr/, voir vite.config.ts) : rien n'est envoyé ni téléchargé ailleurs.
import type { TextPiece } from './pdfText'
import type { PatternLanguage } from '../domain/language'

export interface Ocr {
  /** fragments de texte d'une page rendue à l'échelle `scale` (unités du PDF, origine en bas à gauche) */
  read(canvas: HTMLCanvasElement, scale: number): Promise<TextPiece[]>
  close(): Promise<void>
}

/**
 * Mots trop incertains (taches, motifs, photos) ignorés ; mais un nombre, un signe ou une maille
 * incertains sont gardés : sans eux le rang est faux (« R2: 8 inc = 16 sc » devient « R2: = 16 sc »).
 */
const MIN_CONFIDENCE = 20
const JUNK_LINE_CONFIDENCE = 60
/** ligne illisible (traits d'un diagramme, motif) : écartée même avec des chiffres */
const UNREADABLE_LINE_CONFIDENCE = 35
const USEFUL_RE = /\d|^[=|(),:–—-]+$|^(?:sc|inc|dec|ms|aug|dim|ch|mc|ml|dc|hdc|tr|sl|st|rnds?|rows?|in|each|x\d*)[,.)]?$/i

/** Langues lues par défaut ; les autres (espagnol, allemand…) sont chargées si le patron est écrit ainsi. */
export const DEFAULT_OCR_LANGUAGES: PatternLanguage[] = ['fra', 'eng']

export async function createOcr(onProgress?: (progress: number) => void, languages: PatternLanguage[] = DEFAULT_OCR_LANGUAGES): Promise<Ocr> {
  const { createWorker, OEM } = await import('tesseract.js')
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, location.href).href
  const worker = await createWorker(languages, OEM.LSTM_ONLY, {
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
            // ligne lue dans une photo (« TA Cat », « CL ») : incertaine, sans nombre ni maille
            if (line.confidence < UNREADABLE_LINE_CONFIDENCE || (line.confidence < JUNK_LINE_CONFIDENCE && !line.words.some((w) => USEFUL_RE.test(w.text)))) continue
            // tous les mots d'une ligne sur sa ligne de base (les lettres hautes ou basses varient) ; mais
            // une « ligne » haute comme deux est faite de deux lignes serrées : chaque mot garde sa place
            const heights = line.words.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b)
            const word = heights[heights.length >> 1] ?? line.bbox.y1 - line.bbox.y0
            const merged = line.bbox.y1 - line.bbox.y0 > heights[heights.length - 1] * 1.6
            const h = (merged ? word : line.bbox.y1 - line.bbox.y0) * 0.8 / scale
            for (const w of line.words) {
              if (!w.text.trim() || (w.confidence < MIN_CONFIDENCE && !USEFUL_RE.test(w.text))) continue
              const y = (canvas.height - (merged ? w.bbox.y1 : line.bbox.y1)) / scale
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
