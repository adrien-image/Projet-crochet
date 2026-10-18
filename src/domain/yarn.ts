// Estimation de la longueur de fil à partir des mailles du patron.
// Ordre de grandeur courant : une maille serrée consomme ≈ 0,5 cm de fil par mm de crochet
// (≈ 2,5 cm au crochet 5 mm), les mailles hautes davantage.
import type { Pattern, StitchType } from './types'
import { buildCords, buildPieces } from './pieces'

const PER_STITCH: Record<StitchType, number> = {
  sc: 1, hdc: 1.45, dc: 1.85, tr: 2.4, sl: 0.4, ch: 0.5, inc: 2, dec: 1.6, inc3: 3, dec3: 2.1,
}
const CM_PER_SC_PER_MM = 0.5
/** marge d'incertitude annoncée */
export const YARN_MARGIN = 0.2

/** Taille de crochet en mm lue dans un texte (« 3,5 mm », « 4mm », « US G/6 » non géré). */
export function hookMm(text: string | null | undefined): number | null {
  const m = (text ?? '').match(/(\d+(?:[.,]\d+)?)\s*mm/i)
  const v = m ? parseFloat(m[1].replace(',', '.')) : NaN
  return Number.isFinite(v) && v >= 1 && v <= 25 ? v : null
}

export interface YarnEstimate {
  /** longueur totale en mètres */
  meters: number
  /** par couleur (#rrggbb → mètres), du plus long au plus court */
  byColor: { color: string, meters: number }[]
  hook: number
  /** taille de crochet supposée (absente du patron) */
  assumedHook: boolean
}

export function estimateYarn(pattern: Pattern): YarnEstimate {
  const found = hookMm(pattern.hook) ?? hookMm(pattern.text)
  const hook = found ?? 4
  const cmPerUnit = CM_PER_SC_PER_MM * hook
  const byColor = new Map<string, number>()
  const add = (color: string, units: number) => byColor.set(color, (byColor.get(color) ?? 0) + units * cmPerUnit / 100)
  for (const piece of buildPieces(pattern)) {
    for (const r of piece.rounds) {
      const units = r.stitches.reduce((n, s) => n + PER_STITCH[s], 0)
      add(r.color ?? piece.color, units * piece.copies)
    }
  }
  for (const cord of buildCords(pattern)) add(cord.color, cord.length * PER_STITCH.ch)
  const list = [...byColor.entries()].map(([color, meters]) => ({ color, meters })).sort((a, b) => b.meters - a.meters)
  return { meters: list.reduce((n, x) => n + x.meters, 0), byColor: list, hook, assumedHook: found == null }
}

/** « 45 m » ou « 1,2 km », arrondi à une précision raisonnable. */
export function formatMeters(m: number, locale = 'fr'): string {
  if (m >= 1000) return `${(m / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km`
  const rounded = m < 20 ? Math.max(1, Math.round(m)) : Math.round(m / 5) * 5
  return `${rounded.toLocaleString(locale)} m`
}
