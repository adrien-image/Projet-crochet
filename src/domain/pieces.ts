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
  /** une couleur par exemplaire : « Corps x2 (bleu, blanc) » */
  copyColors?: string[]
  /** couleur déduite sans indication du patron (2e couleur du fil, couleur par défaut…) */
  colorGuessed: boolean
}

export interface CordPiece {
  label: string
  length: number
  color: string
  /** « Antennes x2 » */
  copies: number
}

export interface Details {
  /** gap : écart entre les yeux en mailles (« 8 sc apart ») */
  eyes: { color: string, gap?: number } | null
  nose: { color: string } | null
  /** rangs cités dans les consignes d'assemblage (« Pin the front legs between rows 21 and 22 ») */
  rows: RowHint[]
  /** le patron se rembourre (« Rembourre l'aile et le corps ») */
  stuffed: boolean
  /** traits brodés sur le dessus (« Brode plusieurs traits en laine chenille blanc ») */
  stripes: { color: string } | null
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
  // « Corps x2 (bleu, blanc) » → « Corps »
  return (section ?? '').replace(/\s*[(—–:-].*$/, '').replace(/\s+[x×]\s*\d+\s*$/i, '').trim()
}

const ACCENT_PIECE = /\b(?:spikes?|picots?|piquants?|horns?|cornes?|scales?|[ée]cailles?|cr[êe]tes?|crests?)\b/i

/** Couleurs distinctes citées dans le champ « fil », dans l'ordre (« vert et beige » → [vert, beige]). */
function allYarnColors(yarn: string | null | undefined): string[] {
  const out: string[] = []
  for (const part of (yarn ?? '').split(/\s*(?:,|;|\/|\+|\bet\b|\band\b)\s*/i)) {
    const c = findYarnColor(part)
    if (c && !out.includes(c)) out.push(c)
  }
  return out
}

/** Couleurs listées entre parenthèses dans un titre : « Corps x2 (bleu, blanc) » → [bleu, blanc]. */
function copyColorList(heading: string, legend: Map<string, string>): string[] {
  const inner = heading.match(/\(([^)]*)\)/)?.[1]
  if (!inner) return []
  const parts = inner.split(/\s*(?:,|\/|\bet\b|\band\b|\+)\s*/).map((x) => x.trim()).filter((x) => x && !/^[x×]\s*\d+$/i.test(x))
  // seulement des noms de couleur (« bleu, blanc »), pas « fil beige, un peu de rose »
  if (parts.length < 2 || parts.some((x) => x.split(/\s+/).length > 2)) return []
  const colors = parts.map((x) => headingColor(x, legend))
  return colors.every(Boolean) ? colors as string[] : []
}

export function buildPieces(pattern: Pattern): Piece[] {
  const rounds = roundsOf(pattern)
  const texts = splitSections(pattern.text)
  const firstLine = pattern.text.split('\n')[0].split(/[.,;]/).filter((x) => !DETAIL.test(x)).join(' ')
  const fallback = findYarnColor(pattern.yarn) ?? findYarnColor(firstLine) ?? DEFAULT_YARN
  const pieces: Piece[] = []
  for (const r of rounds) {
    if (!r.count) continue
    // une pièce reprise plus loin dans le texte (« R25 & 26 » après le plastron) garde ses rangs ensemble
    const last = pieces.find((p) => p.index === r.piece)
    if (last) {
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
      colorGuessed: false,
    })
  }
  const legend = colorLegend(pattern.text)
  const yarnColors = allYarnColors(pattern.yarn)
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
    // une pièce qui change de fil : les couleurs citées dans ses rangs ne sont pas celle de départ ;
    // la couleur de ses premiers rangs (« Use color #8008 rock corey ») est sa couleur de base
    const changes = p.rounds.some((r) => r.color)
    // piquants, cornes, écailles sans couleur indiquée : la 2e couleur du fil, s'il y en a une
    // (« green and beige » → piquants beige, comme sur la plupart des photos)
    const accent = ACCENT_PIECE.test(p.label) && yarnColors.length > 1 ? yarnColors[1] : null
    const stated = headingColor(p.sections.join(' '), legend) ?? p.rounds[0].color ?? (changes ? null : findYarnColor(ownYarn))
    const natural = stated ?? accent ?? fallback
    const override = pattern.pieceColors?.[p.label]
    p.color = override ?? natural
    // supposée : rien dans le patron ne la donne pour cette pièce (fil à plusieurs couleurs, ou aucune couleur)
    p.colorGuessed = !override && !stated && (!!accent || yarnColors.length !== 1)
    // couleur choisie à la main : elle remplace aussi la couleur de base écrite dans les rangs
    if (override && override !== natural) p.rounds = p.rounds.map((r) => (r.color === natural ? { ...r, color: null } : r))
    // « Corps x2 (bleu, blanc) » : un exemplaire de chaque couleur (les « Blanc : » des rangs disent
    // seulement quel exemplaire on crochète)
    const listed = copyColorList(p.sections[0] ?? '', legend)
    // « Tête de la raie (bleu, blanc) » : une par couleur, même sans « x2 »
    if (p.copies === 1 && listed.length > 1 && listed.length <= 4) p.copies = listed.length
    if (p.copies > 1 && listed.length === p.copies && new Set(listed).size > 1) {
      p.copyColors = override ? listed.map(() => override) : listed
      p.color = p.copyColors[0]
      p.rounds = p.rounds.map((r) => (r.color ? { ...r, color: null } : r))
    }
  }
  return pieces
}

export function buildCords(pattern: Pattern): CordPiece[] {
  const cords = parseCords(pattern.text)
  const texts = splitSections(pattern.text)
  // sans couleur indiquée : le fil de la pièce principale (la queue d'une raie bleue est bleue)
  const fallback = findYarnColor(pattern.yarn) ?? (cords.length ? buildPieces(pattern)[0]?.color : null) ?? DEFAULT_YARN
  return cords.map((c) => {
    const label = shortName(c.section) || 'Chaînette'
    const own = `${c.section ?? ''}\n${texts.get(c.section) ?? ''}`.split(/[.\n!;]/).filter((x) => !DETAIL.test(x)).join('\n')
    return { label, length: c.length, color: pattern.pieceColors?.[label] ?? findYarnColor(own) ?? fallback, copies: sectionCopies(c.section) }
  })
}

/** Yeux et nez mentionnés dans le patron (yeux de sécurité, nez brodé…). */
function eyeGap(text: string): { gap?: number } {
  const m = text.replace(/\s+/g, ' ').match(/\b(?:eyes?|yeux)\b[^.]{0,120}?\b(\d{1,2})\s*(?:sc|sts?|stitches|mailles?|m)\b\s*(?:apart|between|d['’][ée]cart|d['’]intervalle|entre)/i)
  return m ? { gap: parseInt(m[1], 10) } : {}
}

export function findDetails(text: string): Details {
  const sentences = text.split(/[.\n!]/)
  const eyeSentence = sentences.find((s) => /\b(?:yeux|oeil|œil|eyes?)\b/i.test(s))
  const noseSentence = sentences.find((s) => /\b(?:nez|truffe|nose|museau\s+brod)/i.test(s) && /\b(?:brod|coudre|cousu|embroider|sew|perle|bead|bouton|safety|s[ée]curit[ée]|attach|insert|place|fix)/i.test(s))
  const stripeSentence = sentences.find((s) => /\b(?:brode[rz]?|embroider)\b[^\n]*\b(?:traits?|lignes?|lines?|stripes?|dashes?|tirets?)\b/i.test(s))
  const noseColor = noseSentence?.match(/\b(?:nez|truffe|nose)\b[^,;]*/i)?.[0]
  return {
    eyes: eyeSentence ? { color: '#141416', ...eyeGap(text) } : null,
    nose: noseSentence ? { color: findYarnColor(noseColor) ?? findYarnColor(noseSentence) ?? '#2a2a2d' } : null,
    rows: rowHints(text),
    stuffed: /\b(?:rembourr|bourr|stuff|fiberfill|ouate)/i.test(text),
    stripes: stripeSentence ? { color: findYarnColor(stripeSentence) ?? '#f4f1ea' } : null,
  }
}
