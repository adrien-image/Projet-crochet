// Extraction du texte d'un patron PDF (pdf.js, chargé seulement quand on en a besoin).
// Les lignes sont reconstituées à partir des positions du texte, puis nettoyées pour que
// le parseur reconnaisse les rangs (« R1 : 6 ms… »).

const MAX_PAGES = 80

export async function extractPdfText(data: Blob): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await data.arrayBuffer()), isEvalSupported: false }).promise
  const pages: string[] = []
  try {
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      // regroupe les fragments par ligne (même ordonnée, à 2 points près)
      const lines: { y: number, parts: { x: number, s: string }[] }[] = []
      for (const item of content.items) {
        if (!('str' in item) || !item.str) continue
        const x = item.transform[4]
        const y = item.transform[5]
        let line = lines.find((l) => Math.abs(l.y - y) < 2)
        if (!line) {
          line = { y, parts: [] }
          lines.push(line)
        }
        line.parts.push({ x, s: item.str })
      }
      lines.sort((a, b) => b.y - a.y)
      pages.push(lines.map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ')).join('\n'))
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }
  return cleanPdfText(pages.join('\n\n'))
}

/** Nettoyage du texte extrait : espaces, césures, numéros de page, puces. */
export function cleanPdfText(text: string): string {
  return text
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .split('\n')
    .map((l) => l.trim().replace(/^[•●▪◦‣]\s*/, ''))
    // numéros de page seuls, « Page 3 / 12 »
    .filter((l) => !/^(?:page\s*)?\d{1,3}(?:\s*[/|]\s*\d{1,3})?$/i.test(l))
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
