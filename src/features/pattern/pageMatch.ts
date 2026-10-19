import type { PageLayout } from '../../storage/pdfText'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '')

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>()
  for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1)
  return m
}

/** Ressemblance de deux textes (coefficient de Dice sur les paires de lettres, 0 à 1). */
function similarity(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0
  const x = bigrams(a)
  const y = bigrams(b)
  let common = 0
  for (const [k, n] of x) common += Math.min(n, y.get(k) ?? 0)
  return (2 * common) / (a.length - 1 + b.length - 1)
}

export interface PageSpot { page: number, box: [number, number, number, number] }

/**
 * Place d'une ligne du patron sur les pages du PDF : la même ligne, ou la plus ressemblante (le texte
 * a pu être nettoyé ou corrigé depuis). `occurrence` : la n-ième ligne identique du patron (« R1 : 6 ms
 * dans un anneau magique » revient dans chaque pièce).
 */
export function findOnPages(line: string, layout: PageLayout[], occurrence = 0): PageSpot | null {
  const target = norm(line)
  if (target.length < 3) return null
  const all = layout.flatMap((p, page) => p.lines.map((l) => ({ page, box: l.box, text: norm(l.text) })))
  const same = all.filter((l) => l.text === target)
  if (same.length) {
    const hit = same[Math.min(occurrence, same.length - 1)]
    return { page: hit.page, box: hit.box }
  }
  let best: PageSpot | null = null
  let score = 0.6
  for (const l of all) {
    const s = similarity(target, l.text)
    if (s > score) {
      score = s
      best = { page: l.page, box: l.box }
    }
  }
  return best
}

/** Rang de cette ligne parmi les lignes identiques qui la précèdent. */
export function occurrenceOf(lines: string[], index: number): number {
  const target = norm(lines[index])
  let n = 0
  for (let i = 0; i < index; i++) if (norm(lines[i]) === target) n++
  return n
}
