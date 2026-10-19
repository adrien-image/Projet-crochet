// Extraction du texte d'un patron PDF (pdf.js, chargé seulement quand on en a besoin).
// Les lignes sont reconstituées à partir des positions du texte, puis nettoyées pour que
// le parseur reconnaisse les rangs (« R1 : 6 ms… »).

const MAX_PAGES = 80

/** Fragment de texte d'une page PDF (position du coin bas gauche, largeur, taille de police). */
export interface TextPiece { s: string, x: number, y: number, w: number, h: number }

/**
 * Reconstitue les lignes d'une page : fragments de même ordonnée, de gauche à droite. Un grand
 * écart horizontal (cellules d'un tableau, légende de photo) devient « | », pour ne pas coller
 * « 36 – 36 sc » et « After row 35 – » : le parseur relit les cellules.
 */
export function pageLines(pieces: TextPiece[]): string[] {
  const rows: { y: number, h: number, parts: TextPiece[] }[] = []
  for (const p of pieces) {
    if (!p.s) continue
    let row = rows.find((r) => Math.abs(r.y - p.y) < Math.max(2, Math.min(r.h, p.h || r.h) * 0.4))
    if (!row) {
      row = { y: p.y, h: p.h || 10, parts: [] }
      rows.push(row)
    }
    row.parts.push(p)
  }
  rows.sort((a, b) => b.y - a.y)
  const out: string[] = []
  for (const row of rows) {
    const parts = row.parts.sort((a, b) => a.x - b.x)
    let cur = ''
    let end = -Infinity
    for (const p of parts) {
      // pdf.js comble l'écart entre deux colonnes par une « espace » très large : elle ne compte pas
      if (!p.s.trim()) continue
      const gap = p.x - end
      if (cur && gap > Math.max(24, row.h * 3)) {
        // cellules d'un tableau, ou légende à côté d'un rang : séparées par « | » (le parseur les relit)
        cur = `${cur.trim()} | `
      } else if (cur && gap > row.h * 0.15 && !/\s$/.test(cur) && !/^\s/.test(p.s)) {
        cur += ' '
      }
      cur += p.s
      end = p.x + (p.w || p.s.length * row.h * 0.5)
    }
    if (cur.trim()) out.push(cur.trim())
  }
  return out
}

/**
 * En-têtes et pieds de page (« Titre – by … », « Page 3 of 4 ») : fragments au même endroit sur
 * la plupart des pages, retirés avant de reconstituer les lignes.
 */
export function removeRunningPieces(pages: TextPiece[][]): TextPiece[][] {
  if (pages.length < 3) return pages
  const key = (p: TextPiece) => `${Math.round(p.y / 4)}|${p.s.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase()}`
  const seen = new Map<string, number>()
  for (const page of pages) for (const k of new Set(page.map(key))) seen.set(k, (seen.get(k) ?? 0) + 1)
  const min = Math.max(3, Math.ceil(pages.length * 0.6))
  return pages.map((page) => page.filter((p) => p.s.trim().length < 2 || (seen.get(key(p)) ?? 0) < min))
}

/** Contenu utile d'un patron PDF : texte, titre et photos de l'ouvrage. */
export interface PdfContent {
  text: string
  title: string | null
  /** photos (JPEG), dans l'ordre des pages : la première sert de couverture */
  photos: Blob[]
  /** aperçu des premières pages (JPEG, data:), pour vérifier les rangs reconnus */
  pages: string[]
  /** texte lu par reconnaissance de caractères (PDF scanné) : à vérifier de près */
  ocr: boolean
}

export interface PdfProgress {
  /** page en cours de lecture par OCR, et nombre de pages à lire */
  page: number
  pages: number
  /** avancement de la page (0 à 1) */
  progress: number
}

export interface PdfOptions {
  /** lecture des PDF scannés (OCR) : avancement */
  onProgress?: (p: PdfProgress) => void
  /** lecture des pages scannées ; par défaut Tesseract.js (chargé seulement si besoin) */
  ocr?: (onProgress: (progress: number) => void) => Promise<import('./ocr').Ocr>
  /** lire toutes les pages par OCR, sans le texte du PDF (texte mal encodé, illisible) */
  ocrOnly?: boolean
}

const PREVIEW_PAGES = 12
const PREVIEW_WIDTH = 720
/** une page avec moins de caractères que ça est une image (scan, photo) */
const SCANNED_CHARS = 40
/** un document avec moins de caractères par page en moyenne est scanné */
const SCANNED_DOC_CHARS = 150
const OCR_PAGES = 30
const OCR_SCALE = 2.5

interface PdfPage {
  view: number[]
  getViewport(o: { scale: number }): { width: number, height: number }
  render(o: { canvas: HTMLCanvasElement, canvasContext: CanvasRenderingContext2D, viewport: unknown }): { promise: Promise<void> }
}

async function renderPage(page: PdfPage, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  return canvas
}

const textChars = (pieces: TextPiece[]) => pieces.reduce((n, p) => n + p.s.trim().length, 0)

const MAX_PHOTOS = 6
const PHOTO_PAGES = 12

type Matrix = [number, number, number, number, number, number]
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
]

/** Nom de patron à partir des métadonnées, du plus grand texte de la page 1, ou du nom du fichier. */
export function pdfTitle(metaTitle: string | null | undefined, firstPage: TextPiece[], fileName?: string | null): string | null {
  const clean = (s: string) => s
    .replace(/\.pdf$/i, '').replace(/[_]+/g, ' ')
    // « Titre – by Adriana Gori », « Titre - par Moi »
    .replace(/\s+[-–—]\s+(?:by|par|de)\s.*$/i, '')
    .replace(/\b(?:pattern|patron|pdf|tuto(?:riel)?|crochet|free|gratuit|eng?|fr|v\d+)\b/gi, ' ')
    .replace(/[-–—|]+\s*$/, '').replace(/\s+/g, ' ').trim()
  // un titre lisible : des mots, pas « P a t t e r n » ni « Microsoft Word - doc1 »
  const readable = (s: string) => {
    const words = s.split(/\s+/).filter(Boolean)
    return s.length >= 3 && s.length <= 60 && words.length > 0 && words.filter((w) => w.length === 1).length / words.length < 0.4
      && !/\b(?:microsoft|word|untitled|sans titre|document)\b|\.docx?$/i.test(s)
  }
  const meta = clean(metaTitle ?? '')
  if (readable(meta)) return meta
  const big = firstPage.filter((p) => p.s.trim()).sort((a, b) => (b.h || 0) - (a.h || 0))
  if (big.length) {
    const top = big[0].h || 0
    const line = pageLines(big.filter((p) => (p.h || 0) >= top * 0.9)).map(clean).find(readable)
    if (line) return line
  }
  const file = clean(fileName ?? '')
  return readable(file) ? file : null
}

/**
 * Fond de page, cadre ou page logo : presque toute l'image a la même teinte. Une photo d'ouvrage,
 * même sur fond uni, a au moins une part notable de pixels éloignés de la teinte dominante.
 */
function isFlat(canvas: HTMLCanvasElement): boolean {
  const sample = document.createElement('canvas')
  sample.width = 32
  sample.height = 32
  const ctx = sample.getContext('2d')
  if (!ctx) return false
  ctx.drawImage(canvas, 0, 0, 32, 32)
  const d = ctx.getImageData(0, 0, 32, 32).data
  const lum: number[] = []
  for (let i = 0; i < d.length; i += 4) lum.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2])
  const median = [...lum].sort((a, b) => a - b)[lum.length >> 1]
  return lum.filter((l) => Math.abs(l - median) > 24).length / lum.length < 0.12
}

/** Image d'un objet pdf.js (bitmap décodé ou pixels bruts) en JPEG, réduite à 1600 px. */
async function imageToJpeg(img: { width: number, height: number, bitmap?: ImageBitmap, data?: Uint8ClampedArray, kind?: number }): Promise<Blob | null> {
  if (typeof document === 'undefined') return null
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0, canvas.width, canvas.height)
  } else if (img.data) {
    // pixels bruts : RGBA (kind 3) ou RGB (kind 2)
    const rgba = new Uint8ClampedArray(img.width * img.height * 4)
    const rgb = img.kind === 2
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += rgb ? 3 : 4) {
      rgba[i] = img.data[j]
      rgba[i + 1] = img.data[j + 1]
      rgba[i + 2] = img.data[j + 2]
      rgba[i + 3] = rgb ? 255 : img.data[j + 3]
    }
    const full = document.createElement('canvas')
    full.width = img.width
    full.height = img.height
    full.getContext('2d')!.putImageData(new ImageData(rgba, img.width, img.height), 0, 0)
    ctx.drawImage(full, 0, 0, canvas.width, canvas.height)
  } else return null
  if (isFlat(canvas)) return null
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88))
}

async function openPdf(data: Blob) {
  // version « legacy » : la version moderne exige des fonctions JavaScript toutes récentes
  // (Map.getOrInsertComputed) absentes de nombreux navigateurs encore en service
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await data.arrayBuffer()), isEvalSupported: false }).promise
  return { pdfjs, doc }
}

/** Aperçu des premières pages d'un PDF (JPEG, data:). */
export async function pdfPreviews(data: Blob): Promise<string[]> {
  const { doc } = await openPdf(data)
  const out: string[] = []
  try {
    for (let n = 1; n <= Math.min(doc.numPages, PREVIEW_PAGES); n++) {
      const page = await doc.getPage(n)
      out.push(await previewOf(page as unknown as PdfPage))
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }
  return out
}

async function previewOf(page: PdfPage): Promise<string> {
  const canvas = await renderPage(page, PREVIEW_WIDTH / (Math.abs(page.view[2] - page.view[0]) || 595))
  return canvas.toDataURL('image/jpeg', 0.72)
}

export async function extractPdf(data: Blob, fileName?: string | null, options: PdfOptions = {}): Promise<PdfContent> {
  const { pdfjs, doc } = await openPdf(data)
  const pages: TextPiece[][] = []
  const photos: { blob: Blob, page: number, full: boolean }[] = []
  const previews: string[] = []
  const seen = new Set<string>()
  let metaTitle: string | null = null
  let ocr = false
  const ocrPages = new Set<number>()
  try {
    metaTitle = ((await doc.getMetadata().catch(() => null))?.info as { Title?: string } | undefined)?.Title ?? null
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      const pieces: TextPiece[] = []
      for (const item of content.items) {
        if (!('str' in item) || !item.str) continue
        pieces.push({ s: item.str, x: item.transform[4], y: item.transform[5], w: item.width, h: item.height || Math.abs(item.transform[3]) })
      }
      pages.push(pieces)
      if (n <= PREVIEW_PAGES) {
        try {
          previews.push(await previewOf(page as unknown as PdfPage))
        } catch {
          // page impossible à dessiner : pas d'aperçu
        }
      }
      if (n <= PHOTO_PAGES && photos.length < MAX_PHOTOS) {
        // photos : images affichées en grand (≥ 6 % de la page), pas les logos ni les pictogrammes
        try {
          const ops = await page.getOperatorList()
          const [x0, y0, x1, y1] = page.view
          const pageArea = Math.abs((x1 - x0) * (y1 - y0))
          const stack: Matrix[] = []
          let ctm: Matrix = [1, 0, 0, 1, 0, 0]
          const found: { name: string, area: number, full: boolean }[] = []
          for (let i = 0; i < ops.fnArray.length; i++) {
            const fn = ops.fnArray[i]
            const args = ops.argsArray[i]
            if (fn === pdfjs.OPS.save) stack.push(ctm)
            else if (fn === pdfjs.OPS.restore) ctm = stack.pop() ?? ctm
            else if (fn === pdfjs.OPS.transform) ctm = multiply(ctm, args as Matrix)
            else if (fn === pdfjs.OPS.paintFormXObjectBegin) {
              stack.push(ctm)
              if (Array.isArray(args?.[0]) && args[0].length === 6) ctm = multiply(ctm, args[0] as Matrix)
            } else if (fn === pdfjs.OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm
            else if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintImageXObjectRepeat) {
              const area = Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2])
              if (typeof args?.[0] === 'string' && area >= pageArea * 0.06) found.push({ name: args[0], area, full: area >= pageArea * 0.8 })
            }
          }
          for (const { name, full } of found.sort((a, b) => b.area - a.area)) {
            if (photos.length >= MAX_PHOTOS || seen.has(name)) continue
            seen.add(name)
            const store = name.startsWith('g_') ? page.commonObjs : page.objs
            const img = await new Promise<unknown>((resolve) => store.get(name, resolve))
            const o = img as { width?: number, height?: number }
            if (!o?.width || !o.height || Math.min(o.width, o.height) < 160 || Math.max(o.width, o.height) / Math.min(o.width, o.height) > 4) continue
            const jpeg = await imageToJpeg(img as Parameters<typeof imageToJpeg>[0]).catch(() => null)
            if (jpeg) photos.push({ blob: jpeg, page: n, full })
          }
        } catch {
          // image illisible (JPEG 2000…) : on garde le texte
        }
      }
      page.cleanup()
    }
    // PDF scanné (presque pas de texte dans tout le document, pas seulement des pages de photos) :
    // ses pages sans texte sont lues par OCR
    const scanned = options.ocrOnly ? pages.map((_, i) => i).slice(0, OCR_PAGES)
      : pages.map((p, i) => (textChars(p) < SCANNED_CHARS ? i : -1)).filter((i) => i >= 0).slice(0, OCR_PAGES)
    if (options.ocrOnly) for (const i of scanned) pages[i] = []
    if (scanned.length && (options.ocrOnly || textChars(pages.flat()) < SCANNED_DOC_CHARS * pages.length)) {
      let at = 1
      const report = (progress: number) => options.onProgress?.({ page: at, pages: scanned.length, progress })
      report(0)
      const engine = await (options.ocr ?? ((cb) => import('./ocr').then((m) => m.createOcr(cb))))(report)
      try {
        for (const [k, i] of scanned.entries()) {
          at = k + 1
          report(0)
          const page = await doc.getPage(i + 1)
          const canvas = await renderPage(page as unknown as PdfPage, OCR_SCALE)
          page.cleanup()
          pages[i] = [...pages[i], ...await engine.read(canvas, OCR_SCALE)]
          ocrPages.add(i)
          canvas.width = canvas.height = 0
        }
        ocr = true
      } finally {
        await engine.close()
      }
    }
  } finally {
    await doc.destroy()
  }
  // titre lu sur la page 1 sans les en-têtes répétés
  // un scan pleine page n'est pas une photo de l'ouvrage
  const kept = photos.filter((p) => !(ocr && p.full && textChars(pages[p.page - 1]) >= SCANNED_CHARS)).map((p) => p.blob)
  return { text: piecesToText(pages, ocrPages), title: pdfTitle(metaTitle, removeRunningPieces(pages)[0] ?? [], fileName), photos: kept, pages: previews, ocr }
}

/** Texte seul d'un PDF. */
export async function extractPdfText(data: Blob): Promise<string> {
  return (await extractPdf(data)).text
}

const pieceWidth = (p: TextPiece) => p.w || p.s.length * (p.h || 10) * 0.5

/** Plus large intervalle libre entre des segments [début, fin] (milieu et largeur), ou null. */
function widestGap(spans: [number, number][], min: number): { at: number, size: number } | null {
  const sorted = spans.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0])
  let best: { at: number, size: number } | null = null
  let end = -Infinity
  for (const [a, b] of sorted) {
    if (end > -Infinity && a - end >= min && (!best || a - end > best.size)) best = { at: (a + end) / 2, size: a - end }
    end = Math.max(end, b)
  }
  return best
}

/**
 * Découpe une page en blocs dans l'ordre de lecture (« XY-cut ») : une gouttière verticale sépare des
 * colonnes (lues l'une après l'autre), sinon le plus grand espace horizontal sépare le haut du bas
 * (en-tête et corps de page). Sans cela, les lignes de trois colonnes seraient entremêlées.
 */
export function readingBlocks(pieces: TextPiece[], depth = 0, words = false): TextPiece[][] {
  const items = pieces.filter((p) => p.s.trim())
  if (items.length < 4 || depth > 16) return [items]
  const sizes = items.map((p) => p.h || 10).sort((a, b) => a - b)
  const h = sizes[Math.floor(sizes.length / 2)]
  // gouttière étroite (texte justifié : 6 pt pour une police de 12) : il faut alors plusieurs lignes de
  // chaque côté, pour ne pas couper deux lignes dont les espaces tombent par hasard au même endroit
  // mots isolés (OCR) : les espaces entre mots sont plus larges qu'entre les fragments d'un PDF
  const v = widestGap(items.map((p) => [p.x, p.x + pieceWidth(p)]), Math.max(4, h * (words ? 0.7 : 0.4)))
  if (v) {
    const left = items.filter((p) => p.x + pieceWidth(p) / 2 < v.at)
    const right = items.filter((p) => p.x + pieceWidth(p) / 2 >= v.at)
    const extent = (l: TextPiece[]) => Math.max(...l.map((p) => p.x + pieceWidth(p))) - Math.min(...l.map((p) => p.x))
    const rowOf = (p: TextPiece) => Math.round(p.y / Math.max(2, h * 0.5))
    const lines = (l: TextPiece[]) => new Set(l.map(rowOf)).size
    const enough = v.size >= h * 1.5 || (lines(left) >= 3 && lines(right) >= 3)
    // un tableau (« Round | Instructions | Count ») : mêmes lignes des deux côtés, et à gauche des numéros
    // de rang ou à droite des comptes — on le lit ligne par ligne, pas colonne par colonne
    const rightRows = new Set(right.map(rowOf))
    const aligned = [...new Set(left.map(rowOf))].filter((r) => rightRows.has(r)).length / Math.max(1, lines(left))
    const short = (l: TextPiece[], re: RegExp) => l.filter((p) => re.test(p.s.trim())).length / Math.max(1, l.length)
    const table = aligned > 0.7 && (short(left, /^(?:\p{L}{0,8}\.?\s*)?\d{1,3}(?:\s*[-–&]\s*\d{1,3})?\s*[:.]?$/u) > 0.6 || short(right, /^\(?\d{1,4}\)?$/) > 0.6)
    // deux vraies colonnes (pas « R1: » aligné à gauche de ses instructions)
    if (enough && !table && extent(left) >= 60 && extent(right) >= 60) {
      return [...readingBlocks(left, depth + 1, words), ...readingBlocks(right, depth + 1, words)]
    }
  }
  const g = widestGap(items.map((p) => [p.y, p.y + (p.h || 10)]), h * 0.6)
  if (g) {
    const top = items.filter((p) => p.y >= g.at)
    const bottom = items.filter((p) => p.y < g.at)
    if (top.length && bottom.length) return [...readingBlocks(top, depth + 1, words), ...readingBlocks(bottom, depth + 1, words)]
  }
  return [items]
}

/** Texte des pages : en-têtes répétés retirés, lignes reconstituées, nettoyage. */
export function piecesToText(pages: TextPiece[][], ocrPages: ReadonlySet<number> = new Set()): string {
  const labels = ocrLabels()
  return cleanPdfText(removeRunningPieces(pages)
    .map((p, i) => readingBlocks(p, 0, ocrPages.has(i)).map((block) => {
      const lines = pageLines(block)
      return (ocrPages.has(i) ? lines.map((l) => labels(cleanOcrLine(l))) : lines).join('\n')
    }).join('\n'))
    .join('\n\n'))
}

/**
 * Numéros de rang mal lus par l'OCR (« RS : », « RIO : », « | : », rien avant « : ») : les rangs se
 * suivent, le numéro est déduit du rang précédent. Un vrai « R12 : » remet la suite à jour.
 */
export function ocrLabels(): (line: string) => string {
  let last: number | null = null
  return (line) => {
    const good = line.match(/^R\s?(\d{1,3})(?:\s*[-–à]\s*R?\s?(\d{1,3}))?\s*:/)
    if (good) {
      last = parseInt(good[2] ?? good[1], 10)
      return line
    }
    const bad = line.match(/^(?:R[A-Za-z0-9%|!]{0,3}|[|!I]|)\s*:\s*(.*)$/)
    if (!bad || !new RegExp(String.raw`\b${STITCH_WORD}\b`).test(bad[1])) return line
    // premier rang d'une pièce : « Ri : ch 2… » juste après un titre
    const next: number = last == null ? 1 : last + 1
    last = next
    return `R${next} : ${bad[1]}`
  }
}

const STITCH_WORD = String.raw`(?:aug|dim|inc|dec|sc|ms|mc|ml|ch|db|br|hdc|dc|tr|sl|st|x\s?\d)`

/**
 * Erreurs de lecture courantes de l'OCR dans un patron : « | aug » ou « I aug » pour « 1 aug »,
 * « R3% » pour « R34 », « ma » pour « ms », mots collés (« 4to7—18sc(4rows) »), puces lues comme
 * « + » ou « o », tiret collé au numéro de rang (« 21-24sc »).
 */
export function cleanOcrLine(line: string): string {
  let l = line
    // puces devant un rang
    .replace(/^(?:[+o°•*·»«>~=©®-]+\s*)+(?=R\S{0,3}\s*:|[|!I]\s*:|:|R\s?\d|\d)/, '')
    // « RI-6 : », « Rl2 : » : 1 lu comme I, l, | ou ! dans un numéro de rang
    .replace(/^R[Il|!](?=\d|\s*[-–à]\s*\d)/, 'R1')
    // 1 lu comme | I ! l devant une maille, une virgule ou une parenthèse
    .replace(new RegExp(String.raw`(^|[\s,:(*\[])[|!Il](?=\s*(?:${STITCH_WORD}\b|[,)]))`, 'g'), '$11')
    // 4 lu comme % ou Y : « R3% », « (%6) », « % ms »
    .replace(/(\d)[%Y](?![A-Za-z])/g, '$14')
    .replace(/\(([\d%]{1,3})\)/g, (_, n: string) => `(${n.replace(/%/g, '4')})`)
    .replace(new RegExp(String.raw`(^|[\s,(*])%(?=\s*${STITCH_WORD}\b)`, 'g'), '$14')
    // « ms » lu comme ma, me, mas, rns
    .replace(/(\d\s*)(?:ma|me|mas|rns|m5)\b/g, '$1ms')
    // mots collés
    .replace(/(\d)(sc|inc|dec|ms|aug|dim|rows?|rnds?|rounds?|to|and|ch|dc|hdc|tr|sl|st)\b/g, '$1 $2')
    .replace(/(\d)(to|and)(?=\d)/g, '$1 $2')
    .replace(/\b(to|and|rows?|rnds?|between)(\d)/g, '$1 $2')
    .replace(/(\d)\(/g, '$1 (')
    .replace(/\bmagicring\b/gi, 'magic ring')
    .replace(/\b(sc|inc|dec)(into|in|around)/g, '$1 $2')
    .replace(/\binto(a|the)\b/g, 'into $1')
    .replace(/([a-z])\((\d)/g, '$1 ($2')
    // numéro de rang sans préfixe collé à son tiret : « 2 —6 inc », « 21-24 sc »
    .replace(/^(\d+(?:\s+(?:to|and|&)\s+\d+)?)\s*[—–]\s*/, '$1 – ')
  if (!/\s[—–]\s/.test(l)) l = l.replace(/^(\d+)\s*-\s*(?=\d+\s*[a-z(])/, '$1 – ')
  return l
}

/** Nettoyage du texte extrait : espaces, césures, numéros de page, puces. */
export function cleanPdfText(text: string): string {
  return text
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .split('\n')
    .map((l) => l.trim().replace(/^[•●▪◦‣]\s*/, ''))
    // restes de mise en page : tirets ou puces isolés
    .filter((l) => !/^[\p{P}\p{S}]+$/u.test(l))
    // numéros de page seuls, « Page 3 / 12 »
    .filter((l) => !/^(?:page\s*)?\d{1,3}(?:\s*(?:[/|]|of|sur|de)\s*\d{1,3})?$/i.test(l))
    // un rang coupé en deux lignes : la suite ne commence ni par un rang ni par une majuscule ;
    // une phrase coupée après « between », « entre », « of »… (« Attach safety eyes between / R16 & 17 »)
    .reduce<string[]>((acc, l) => {
      const prev = acc[acc.length - 1]
      if (prev && /\b(?:between|entre|and|et|or|ou|of|de|du|des|the|le|la|les|to|à|au|with|avec|onto|on|sur|into|in|dans|from|after|before|apr[eè]s|avant)$/i.test(prev)) {
        acc[acc.length - 1] = `${prev} ${l}`
      } else if (prev && /^\s*(?:rounds?|rangs?|rnds?|rows?|r)\.?\s*\d/i.test(prev) && !/[)\].]$/.test(prev) && /^[a-z0-9*(,]/.test(l)) {
        acc[acc.length - 1] = `${prev} ${l}`
      } else acc.push(l)
      return acc
    }, [])
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
