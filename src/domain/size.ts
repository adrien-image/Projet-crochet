// Taille finale d'un ouvrage, et ce qu'elle devient avec un autre crochet (le patron reste le même :
// chaque maille grandit ou rétrécit avec le crochet et l'épaisseur du fil).
import type { Pattern } from './types'
import { buildCords, buildPieces, findDetails } from './pieces'
import { buildModel, modelExtent } from '../render3d/model'
import { estimateYarn, yarnWeight, type YarnWeight } from './yarn'

/** Largeur d'une maille serrée ≈ 0,15 × taille du crochet (0,6 cm au crochet 4 mm). */
const CM_PER_STITCH_PER_MM = 0.15

/** Taille annoncée par le patron : « Final length: 14cm », « Approx. size: 10” », « hauteur ≈ 12 cm ». */
export function statedSize(text: string | null | undefined): number | null {
  const m = (text ?? '').replace(/\s+/g, ' ').match(
    /\b(?:final\s+(?:length|size|height)|approx(?:imate)?\.?\s+size|finished\s+size|size|taille(?:\s+finale)?|hauteur|longueur|height|length|mesure)\s*(?::|=|≈|~)?\s*(?:≈|~|environ|approx(?:imately)?\.?|about|d['’]environ)?\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|inch(?:es)?|in\b|”|"|'')/i,
  )
    // « environ 15 cm de large », « about 20 cm »
    ?? (text ?? '').replace(/\s+/g, ' ').match(/\b(?:environ|approx(?:imately)?\.?|about|ca\.)\s*(\d+(?:[.,]\d+)?)\s*(cm|inch(?:es)?|”|")/i)
  if (!m) return null
  const v = parseFloat(m[1].replace(',', '.'))
  const unit = m[2].toLowerCase()
  const cm = unit === 'mm' ? v / 10 : unit === 'cm' ? v : v * 2.54
  return cm >= 2 && cm <= 300 ? Math.round(cm * 10) / 10 : null
}

export interface SizeEstimate {
  /** dimensions de l'ouvrage fini en cm, de la plus grande à la plus petite */
  dims: [number, number, number]
  /** la plus grande dimension vient du patron (sinon : estimée d'après les mailles) */
  stated: boolean
  hook: number
  meters: number
}

/** Taille et fil de l'ouvrage au crochet du patron. */
export function estimateSize(pattern: Pattern): SizeEstimate | null {
  const pieces = buildPieces(pattern)
  if (!pieces.length) return null
  const model = buildModel(pieces, buildCords(pattern), findDetails(pattern.text), { assembled: true })
  const { min, max } = modelExtent(model.parts)
  const units = [0, 1, 2].map((k) => max[k] - min[k]).filter(Number.isFinite).sort((a, b) => b - a)
  if (!units.length || units[0] <= 0) return null
  const yarn = estimateYarn(pattern)
  const stated = statedSize(pattern.description) ?? statedSize(pattern.text)
  // étalonnage : la taille annoncée correspond à la plus grande dimension du modèle
  const cmPerUnit = stated ? stated / units[0] : CM_PER_STITCH_PER_MM * yarn.hook
  const dims = [0, 1, 2].map((k) => Math.round((units[k] ?? 0) * cmPerUnit * 10) / 10) as [number, number, number]
  return { dims, stated: !!stated, hook: yarn.hook, meters: yarn.meters }
}

export interface Resized {
  hook: number
  dims: [number, number, number]
  meters: number
  weight: YarnWeight
}

/** Le même patron avec un autre crochet (et le fil assorti) : tout est proportionnel à la maille. */
export function resize(base: SizeEstimate, hook: number): Resized {
  const f = hook / base.hook
  return {
    hook,
    dims: base.dims.map((d) => Math.round(d * f * 10) / 10) as [number, number, number],
    meters: base.meters * f,
    weight: yarnWeight(hook),
  }
}

/** Tailles de crochet courantes (mm). */
export const HOOK_SIZES = [1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8, 9, 10, 12]
