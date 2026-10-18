// Extraction du texte d'un patron PDF (pdf.js, chargé seulement quand on en a besoin).
// Les lignes sont reconstituées à partir des positions du texte, puis nettoyées pour que
// le parseur reconnaisse les rangs (« R1 : 6 ms… »).

const MAX_PAGES = 80

/** Fragment de texte d'une page PDF (position du coin bas gauche, largeur, taille de police). */
export interface TextPiece { s: string, x: number, y: number, w: number, h: number }

/**
 * Reconstitue les lignes d'une page : fragments de même ordonnée, de gauche à droite. Un grand
 * écart horizontal (légende de photo, deuxième colonne) coupe la ligne en deux, pour ne pas
 * coller « 36 – 36 sc » et « After row 35 – » sur la même ligne.
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
        out.push(cur.trim())
        cur = ''
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

export async function extractPdfText(data: Blob): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await data.arrayBuffer()), isEvalSupported: false }).promise
  const pages: TextPiece[][] = []
  try {
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      const pieces: TextPiece[] = []
      for (const item of content.items) {
        if (!('str' in item) || !item.str) continue
        pieces.push({ s: item.str, x: item.transform[4], y: item.transform[5], w: item.width, h: item.height || Math.abs(item.transform[3]) })
      }
      pages.push(pieces)
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }
  return piecesToText(pages)
}

/** Texte des pages : en-têtes répétés retirés, lignes reconstituées, nettoyage. */
export function piecesToText(pages: TextPiece[][]): string {
  return cleanPdfText(removeRunningPieces(pages).map((p) => pageLines(p).join('\n')).join('\n\n'))
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
    // un rang coupé en deux lignes : la suite ne commence ni par un rang ni par une majuscule
    .reduce<string[]>((acc, l) => {
      const prev = acc[acc.length - 1]
      if (prev && /^\s*(?:rounds?|rangs?|rnds?|rows?|r)\.?\s*\d/i.test(prev) && !/[)\].]$/.test(prev) && /^[a-z0-9*(,]/.test(l)) {
        acc[acc.length - 1] = `${prev} ${l}`
      } else acc.push(l)
      return acc
    }, [])
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
