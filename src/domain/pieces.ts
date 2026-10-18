// Pièces d'un patron (regroupement des rangs), partagées par le rendu tissu 2D et l'aperçu 3D.
import type { Pattern, Round } from './types'
import { colorLegend, headingColor, looksLikeRound, parseCords, sectionCopies, splitSections } from './parser'
import { DEFAULT_YARN, findYarnColor } from './colors'
import { roundsOf } from './progress'

/** Au-delà de ce nombre de mailles au dernier rang, la pièce reste ouverte. */
export const OPEN_ABOVE = 12

export interface Piece {
  index: number
  /** « MUSEAU + CORPS » */
  label: string
  sections: string[]
  rounds: Round[]
  copies: number
  flat: boolean
  /** dernier rang large : pièce ouverte (bonnet, oreille, lobe…) */
  open: boolean
  /** premier rang large : pièce montée sur des pièces précédentes (« 48 ms autour des deux lobes ») */
  joinedStart: boolean
  /** « fermer à plat », « aplatir » */
  flattened: boolean
  /** rembourrée (amigurumi) — faux pour un bonnet, un sac, un panier… */
  stuffed: boolean
  color: string
}

export interface CordPiece {
  label: string
  length: number
  color: string
}

export interface Details {
  eyes: { color: string } | null
  nose: { color: string } | null
  /** rangs cités dans les consignes d'assemblage (« Pin the front legs between rows 21 and 22 ») */
  rows: RowHint[]
}

/** Mention d'un rang hors des rangs eux-mêmes : texte qui la précède sur la ligne, rang (milieu d'un intervalle). */
export interface RowHint { before: string, row: number }

const ROW_REF_RE = /\b(?:rows?|rounds?|rnds?|rangs?|tours?|r)\s*(\d{1,3})(?:\s*(?:and|to|-|–|à|a|et|e|&)\s*(?:r\s*)?(\d{1,3}))?/gi

function rowHints(text: string): RowHint[] {
  const hints: RowHint[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || looksLikeRound(line)) continue
    let last = 0
    let subject = ''
    for (const m of line.matchAll(ROW_REF_RE)) {
      const from = parseInt(m[1], 10)
      const to = m[2] != null ? parseInt(m[2], 10) : from
      // « rows 5 to 6 - rows 10 to 11 » : la 2e mention reprend le sujet de la précédente
      const before = line.slice(last, m.index).toLowerCase()
      if (/\p{L}{3,}/u.test(before)) subject = before
      if (to >= from && to - from < 20) hints.push({ before: subject, row: (from + to) / 2 })
      last = m.index + m[0].length
    }
  }
  return hints
}

/**
 * Rangs indiqués pour une pièce (ou les yeux), dans l'ordre du texte : mentions précédées du premier
 * mot de son nom (« front » pour « Front legs ») ; s'il en faut `want` (un par exemplaire) et que ce
 * mot n'en donne pas assez, les mots suivants (« spikes » pour « Back spikes »).
 */
export function rowsFor(label: string, hints: RowHint[], want = 1): number[] {
  let best: number[] = []
  for (const word of label.toLowerCase().split(/[^\p{L}]+/u).filter((w) => w.length >= 3)) {
    const stem = word.replace(/(?:e?s|x)$/, '')
    const re = new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu')
    const rows = hints.filter((h) => re.test(h.before)).map((h) => h.row)
    if (rows.length >= want) return rows
    if (rows.length > best.length) best = rows
  }
  return best
}

const DETAIL = /\b(?:yeux|oeil|œil|eyes?|nez|truffe|nose|brod|embroider|bouche|mouth|joues?|cheeks?)/i

// objets creux, jamais rembourrés
const NO_STUFF = /\b(?:do\s+not|don['’]t|no)\s+stuff(?:ing)?\b|\bne\s+pas\s+(?:re)?bourrer\b|\bsans\s+(?:re)?bourr(?:er|age)\b/i
const STUFF = /\b(?:stuff(?:ing)?|fill\s+(?:it|with)|(?:re)?bourr(?:er|ez|age))\b/i
const CONTAINER = /\b(?:bonnet|chapeau|b[ée]ret|hat|beanie|cap|sac|bag|pochette|pouch|panier|basket|corbeille|pot|tasse|mug|cup|bol|bowl|chaussons?|slippers?|chaussettes?|socks?)\b/i

export function shortName(section: string | null): string {
  return (section ?? '').replace(/\s*[(—–:-].*$/, '').trim()
}

export function buildPieces(pattern: Pattern): Piece[] {
  const rounds = roundsOf(pattern)
  const texts = splitSections(pattern.text)
  const firstLine = pattern.text.split('\n')[0].split(/[.,;]/).filter((x) => !DETAIL.test(x)).join(' ')
  const fallback = findYarnColor(pattern.yarn) ?? findYarnColor(firstLine) ?? DEFAULT_YARN
  const pieces: Piece[] = []
  for (const r of rounds) {
    if (!r.count) continue
    const last = pieces[pieces.length - 1]
    if (last && last.index === r.piece) {
      last.rounds.push(r)
      if (r.section && !last.sections.includes(r.section)) last.sections.push(r.section)
      continue
    }
    pieces.push({
      index: r.piece,
      label: '',
      sections: r.section ? [r.section] : [],
      rounds: [r],
      copies: sectionCopies(r.section),
      flat: false,
      open: false,
      joinedStart: false,
      flattened: false,
      stuffed: true,
      color: fallback,
    })
  }
  const legend = colorLegend(pattern.text)
  for (const p of pieces) {
    const names = [...new Set(p.sections.map(shortName))].filter(Boolean)
    p.label = names.join(' + ') || 'Pièce'
    p.flat = p.rounds.filter((r) => r.flat).length > p.rounds.length / 2
    p.open = !p.flat && p.rounds[p.rounds.length - 1].count > OPEN_ABOVE
    p.joinedStart = !p.flat && p.rounds[0].count > OPEN_ABOVE
    const own = p.sections.map((s) => `${s}\n${texts.get(s) ?? ''}`).join('\n')
    // la couleur d'une pièce ne se lit pas dans les phrases sur les yeux, le nez ou les broderies
    const ownYarn = own.split(/[.\n!;]/).filter((x) => !DETAIL.test(x)).join('\n')
    // « ne pas bourrer » / « bourrer » écrits dans la pièce priment sur les indices de forme
    const noStuff = NO_STUFF.test(own)
    const stuffs = !noStuff && STUFF.test(own)
    p.flattened = !stuffs && /\b(?:[àa]\s+plat|aplatir|aplatie?|flatten(?:ed)?|sew\s+flat|close\s+flat)\b/i.test(own)
    p.stuffed = !p.flat && !noStuff && !p.flattened && (stuffs || !CONTAINER.test(`${p.label} ${pattern.name}`))
    // une pièce qui change de fil : les couleurs citées dans ses rangs ne sont pas celle de départ
    const changes = p.rounds.some((r) => r.color)
    p.color = pattern.pieceColors?.[p.label] ?? headingColor(p.sections.join(' '), legend) ?? (changes ? null : findYarnColor(ownYarn)) ?? fallback
  }
  return pieces
}

export function buildCords(pattern: Pattern): CordPiece[] {
  const cords = parseCords(pattern.text)
  const texts = splitSections(pattern.text)
  const fallback = findYarnColor(pattern.yarn) ?? DEFAULT_YARN
  return cords.map((c) => {
    const label = shortName(c.section) || 'Chaînette'
    const own = `${c.section ?? ''}\n${texts.get(c.section) ?? ''}`.split(/[.\n!;]/).filter((x) => !DETAIL.test(x)).join('\n')
    return { label, length: c.length, color: pattern.pieceColors?.[label] ?? findYarnColor(own) ?? fallback }
  })
}

/** Yeux et nez mentionnés dans le patron (yeux de sécurité, nez brodé…). */
export function findDetails(text: string): Details {
  const sentences = text.split(/[.\n!]/)
  const eyeSentence = sentences.find((s) => /\b(?:yeux|oeil|œil|eyes?)\b/i.test(s))
  const noseSentence = sentences.find((s) => /\b(?:nez|truffe|nose|museau\s+brod)/i.test(s) && /\b(?:brod|coudre|cousu|embroider|sew|perle|bead|bouton)/i.test(s))
  const noseColor = noseSentence?.match(/\b(?:nez|truffe|nose)\b[^,;]*/i)?.[0]
  return {
    eyes: eyeSentence ? { color: '#141416' } : null,
    nose: noseSentence ? { color: findYarnColor(noseColor) ?? findYarnColor(noseSentence) ?? '#2a2a2d' } : null,
    rows: rowHints(text),
  }
}
