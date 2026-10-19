// Estimation de la longueur de fil à partir des mailles du patron.
// Ordre de grandeur courant : une maille serrée consomme ≈ 0,5 cm de fil par mm de crochet
// (≈ 2,5 cm au crochet 5 mm), les mailles hautes davantage.
import type { Pattern, StitchType } from './types'
import { buildCords, buildPieces } from './pieces'
import { findYarnColor } from './colors'

const PER_STITCH: Record<StitchType, number> = {
  sc: 1, hdc: 1.45, dc: 1.85, tr: 2.4, sl: 0.4, ch: 0.5, inc: 2, dec: 1.6, inc3: 3, dec3: 2.1,
}
const CM_PER_SC_PER_MM = 0.5
/** marge d'incertitude annoncée */
export const YARN_MARGIN = 0.2

/** Taille de crochet en mm lue dans un texte (« 3,5 mm », « 4mm », « US G/6 » non géré). */
export function hookMm(text: string | null | undefined): number | null {
  const s = text ?? ''
  // d'abord une taille accolée au mot crochet / hook (« 10 mm safety eyes, 3.5 mm hook » → 3,5)
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*mm\s+(?:crochet\s+)?hook|\b(?:hook|crochet)(?:\s+(?:size|n°|de))?(?:\s+used)?\s*:?\s*(?:[a-z]-?\d+\s*\/\s*)?(\d+(?:[.,]\d+)?)\s*mm|\bcrochet\s+n[°ºo]\s*(\d+(?:[.,]\d+)?)/i)
    ?? s.match(/(\d+(?:[.,]\d+)?)\s*mm/i)
  const v = m ? parseFloat((m[1] ?? m[2] ?? m[3]).replace(',', '.')) : NaN
  return Number.isFinite(v) && v >= 1 && v <= 25 ? v : null
}

export interface YarnColor {
  color: string
  meters: number
  /** pièces crochetées dans cette couleur */
  pieces: string[]
  /** nom lu dans le patron (« #8008 rock corey », « Bleu »), sinon null */
  name: string | null
  /** couleur supposée pour toutes ses pièces (le patron ne la précise pas) */
  guessed: boolean
}

export interface YarnEstimate {
  /** longueur totale en mètres */
  meters: number
  /** par couleur, du plus long au plus court */
  byColor: YarnColor[]
  hook: number
  /** taille de crochet supposée (absente du patron) */
  assumedHook: boolean
}

export function estimateYarn(pattern: Pattern): YarnEstimate {
  const found = hookMm(pattern.hook) ?? hookMm(pattern.text)
  const hook = found ?? 4
  const cmPerUnit = CM_PER_SC_PER_MM * hook
  const byColor = new Map<string, { meters: number, pieces: Set<string>, guessed: boolean }>()
  const add = (color: string, units: number, label: string, guessed = false) => {
    const e = byColor.get(color) ?? { meters: 0, pieces: new Set<string>(), guessed: true }
    e.meters += units * cmPerUnit / 100
    e.pieces.add(label)
    e.guessed &&= guessed
    byColor.set(color, e)
  }
  for (const piece of buildPieces(pattern)) {
    for (let c = 0; c < piece.copies; c++) {
      // « Corps x2 (bleu, blanc) » : chaque exemplaire dans sa couleur
      const copyColor = piece.copyColors?.[c]
      for (const r of piece.rounds) {
        const units = r.stitches.reduce((n, s) => n + PER_STITCH[s], 0)
        add(copyColor ?? r.color ?? piece.color, units, piece.label, !copyColor && !r.color && piece.colorGuessed)
      }
    }
  }
  for (const cord of buildCords(pattern)) add(cord.color, cord.length * PER_STITCH.ch * Math.max(1, cord.copies), cord.label)
  const sources = [pattern.yarn, pattern.text]
  const list = [...byColor.entries()]
    .map(([color, e]) => ({ color, meters: e.meters, pieces: [...e.pieces], name: colorNameIn(color, sources), guessed: e.guessed }))
    .sort((a, b) => b.meters - a.meters)
  return { meters: list.reduce((n, x) => n + x.meters, 0), byColor: list, hook, assumedHook: found == null }
}

/** Nom d'une couleur tel qu'il est écrit dans le patron : « #8008 rock corey », « Bleu », « green ». */
function colorNameIn(color: string, sources: (string | null | undefined)[]): string | null {
  for (const src of sources) {
    for (const raw of (src ?? '').split(/[\n,;()/]|\s+(?:and|et)\s+/)) {
      // « Use color #8008 rock corey » → « #8008 rock corey » ; « Bleu : 03 » → « Bleu 03 »
      const part = raw.replace(/^.*\b(?:colou?rs?|couleurs?|coloris)\s+(?=#|\p{L})/iu, '').replace(/^.*?\b(?:in|en)\s+(?=#|\p{L})/iu, '').replace(/\s*:\s*/, ' ').trim()
      if (part.length < 2 || part.length > 32 || /\d+\s*mm/.test(part)) continue
      if (findYarnColor(part) === color && part.split(/\s+/).length <= 4) return part
    }
  }
  return null
}

export interface YarnWeight {
  /** catégorie internationale (Craft Yarn Council) : 1 fin … 6 super épais */
  category: 1 | 2 | 3 | 4 | 5 | 6
  /** noms courants */
  names: string
  /** mètres pour une pelote de 50 g, ordre de grandeur */
  metersPer50g: number
}

const WEIGHTS: (YarnWeight & { maxHook: number })[] = [
  { maxHook: 2.25, category: 1, names: 'fingering, 4 fils, baby', metersPer50g: 200 },
  { maxHook: 3.25, category: 2, names: 'sport, baby', metersPer50g: 150 },
  { maxHook: 4.25, category: 3, names: 'DK, light worsted', metersPer50g: 120 },
  { maxHook: 5.5, category: 4, names: 'worsted, aran', metersPer50g: 90 },
  { maxHook: 8, category: 5, names: 'bulky, chunky', metersPer50g: 60 },
  { maxHook: Infinity, category: 6, names: 'super bulky, jumbo', metersPer50g: 40 },
]

/**
 * Épaisseur de fil adaptée au crochet. Pour un amigurumi, on prend un crochet plus petit que celui
 * conseillé sur la pelote (mailles serrées, rembourrage invisible) : la table en tient compte.
 */
export function yarnWeight(hook: number): YarnWeight {
  const { maxHook: _max, ...w } = WEIGHTS.find((x) => hook <= x.maxHook)!
  return w
}

export type YarnMaterial = 'chenille' | 'coton' | 'laine' | 'acrylique' | 'mohair'

/** Matière du fil d'après le patron (« Pelucia », « Softy », « coton »…). */
export function yarnMaterial(text: string | null | undefined): YarnMaterial | null {
  const s = text ?? ''
  if (/\b(?:chenille|velours|velvet|plush|pelucia|softy|baby\s*velvet|dolphin\s*baby)\b/i.test(s)) return 'chenille'
  if (/\b(?:coton|cotton|milk\s*cotton)\b/i.test(s)) return 'coton'
  if (/\b(?:mohair)\b/i.test(s)) return 'mohair'
  if (/\b(?:laine|wool|m[ée]rinos|merino|alpaga|alpaca)\b/i.test(s)) return 'laine'
  if (/\b(?:acrylique|acrylic)\b/i.test(s)) return 'acrylique'
  return null
}

/** Nombre de pelotes à acheter (marge comprise) ; un fil chenille est plus court au gramme. */
export function ballsFor(meters: number, weight: YarnWeight, material: YarnMaterial | null): { balls: number, grams: number } {
  const per50 = material === 'chenille' ? Math.min(weight.metersPer50g, 60) : weight.metersPer50g
  const need = meters * (1 + YARN_MARGIN)
  return { balls: Math.max(1, Math.ceil(need / (per50 * 2))), grams: Math.max(5, Math.ceil((need / per50) * 50 / 5) * 5) }
}

/** « 45 m » ou « 1,2 km », arrondi à une précision raisonnable. */
export function formatMeters(m: number, locale = 'fr'): string {
  if (m >= 1000) return `${(m / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km`
  const rounded = m < 20 ? Math.max(1, Math.round(m)) : Math.round(m / 5) * 5
  return `${rounded.toLocaleString(locale)} m`
}
