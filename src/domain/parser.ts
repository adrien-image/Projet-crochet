import type { Cord, Notation, ParseOptions, Round, StitchType } from './types'
import { findYarnColor } from './colors'


// Abréviations de plusieurs lettres (après normalisation : minuscules, sans accents).
const BASE_MAP: Record<string, StitchType> = {
  // FR
  ms: 'sc', mc: 'sl', ml: 'ch', mla: 'ch',
  db: 'hdc', dbr: 'tr', br: 'dc', bs: 'dc', bride: 'dc',
  aug: 'inc', augm: 'inc', augmentation: 'inc',
  dim: 'dec', diminution: 'dec',
  // US
  sc: 'sc', hdc: 'hdc', dc: 'dc', tr: 'tr', trc: 'tr', dtr: 'tr',
  sl: 'sl', slst: 'sl', ss: 'sl',
  inc: 'inc', increase: 'inc',
  dec: 'dec', decrease: 'dec', invdec: 'dec',
  sc2tog: 'dec', hdc2tog: 'dec', dc2tog: 'dec',
  sc3tog: 'dec3', hdc3tog: 'dec3', dc3tog: 'dec3',
  inc3: 'inc3', aug3: 'inc3', dec3: 'dec3', dim3: 'dec3',
  ch: 'ch', chain: 'ch',
}

// Termes UK : « dc » UK = maille serrée, « tr » UK = bride…
const UK_MAP: Record<string, StitchType> = {
  ...BASE_MAP,
  dc: 'sc', htr: 'hdc', tr: 'dc', dtr: 'tr', ttr: 'tr',
  dc2tog: 'dec', htr2tog: 'dec', tr2tog: 'dec',
  dc3tog: 'dec3', htr3tog: 'dec3', tr3tog: 'dec3',
}

// Lettres seules : trop ambiguës dans du texte français (« à », « m »…),
// acceptées seulement en majuscule (notation XVA) ou collées à un nombre (« 6v », « 6 m »).
const SINGLE_MAP: Record<string, StitchType> = { x: 'sc', v: 'inc', w: 'inc3', a: 'dec', m: 'sc', b: 'dc' }

export const STITCH_INFO: Record<StitchType, { label: string, abbr: string }> = {
  sc: { label: 'Maille serrée', abbr: 'ms / sc / X' },
  hdc: { label: 'Demi-bride', abbr: 'db / hdc' },
  dc: { label: 'Bride', abbr: 'br / dc' },
  tr: { label: 'Double bride', abbr: 'dbr / tr' },
  sl: { label: 'Maille coulée', abbr: 'mc / sl st' },
  inc: { label: 'Augmentation', abbr: 'aug / inc / V' },
  dec: { label: 'Diminution', abbr: 'dim / dec / A' },
  inc3: { label: 'Augmentation triple (3 m. dans 1)', abbr: '3 ms dans 1 / W' },
  dec3: { label: 'Diminution triple (3 m. ensemble)', abbr: 'sc3tog' },
  ch: { label: 'Maille en l’air (chaînette)', abbr: 'ml / ch' },
}

// Mailles « de structure » : chaînette de départ, maille coulée de jonction.
// Elles ne comptent que si le rang n'est composé que d'elles.
const STRUCTURAL = new Set<StitchType>(['ch', 'sl'])
const STITCH_WEIGHT: Partial<Record<StitchType, number>> = { inc: 2, inc3: 3 } // mailles produites (1 par défaut)
const STITCH_CONSUME: Partial<Record<StitchType, number>> = { dec: 2, dec3: 3 } // mailles du rang précédent consommées (1 par défaut)

function isStructuralOnly(stitches: StitchType[]) {
  return stitches.length > 0 && stitches.every((s) => STRUCTURAL.has(s))
}

export function stitchCount(stitches: StitchType[]) {
  const structuralOnly = isStructuralOnly(stitches)
  let sum = 0
  for (const s of stitches) {
    if (STRUCTURAL.has(s) && !structuralOnly) continue
    sum += STITCH_WEIGHT[s] ?? 1
  }
  return sum
}

export function stitchConsumed(stitches: StitchType[], structuralOnly = isStructuralOnly(stitches)) {
  let sum = 0
  for (const s of stitches) {
    if (s === 'ch') continue
    if (s === 'sl' && !structuralOnly) continue
    sum += STITCH_CONSUME[s] ?? 1
  }
  return sum
}

function normalizeWord(w: string) {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function lookup(word: string, map: Record<string, StitchType>): StitchType | null {
  if (map[word]) return map[word]
  // pluriels : « augs », « dims », « incs »…
  if (word.length > 2 && word.endsWith('s') && map[word.slice(0, -1)]) return map[word.slice(0, -1)]
  return null
}

// Remplace les formes longues par leur abréviation avant la tokenisation.
const PHRASES: [RegExp, string][] = [
  [/mailles?\s+serr[ée]es?/gi, 'ms'],
  [/mailles?\s+coul[ée]es?/gi, 'mc'],
  [/mailles?\s+en\s+l['’]\s*air/gi, 'ml'],
  [/demi[-\s]brides?/gi, 'db'],
  [/doubles?[-\s]brides?/gi, 'dbr'],
  [/slip\s+stitch(?:es)?|sl\s+sts?\b/gi, 'slst'],
  [/single\s+crochets?/gi, 'sc'],
  [/half\s+double\s+crochets?/gi, 'hdc'],
  [/double\s+crochets?/gi, 'dc'],
  [/invisible\s+dec(?:rease)?s?/gi, 'invdec'],
  [/\b(?:anneau|cercle)\s+magique\b|\bmagic\s+(?:ring|circle|loop)\b/gi, ''],
  // répétition US à une seule étoile : « *sc, inc; rep from * 5 more times »
  [/\*([^*]+?)[;,]?\s*(?:rep(?:eat)?|r[ée]p[ée]ter|r[ée]p)\.?\s+(?:from|depuis|[àa]\s+partir\s+de|de)\s+\*/gi, '*$1* rep '],
  // « 3 ms dans la même maille » = augmentation triple
  [/\b3\s*(?:ms|sc|SC)\s+(?=(?:dans|in|into)\s+(?:chaque|each)\b)/gi, 'inc3 '],
  [/\b3\s*(?:ms|sc|SC)\s+(?:dans|in|into)\s+(?:la\s+m[eê]me(?:\s+maille)?|the\s+same\s+st(?:itch)?|same\s+st(?:itch)?|next\s+st(?:itch)?|la\s+maille\s+suivante)\b/gi, 'inc3'],
  // « 2 ms dans la même maille » = une augmentation
  [/\b2\s*(?:ms|sc|SC)\s+(?=(?:dans|in|into)\s+(?:chaque|each)\b)/gi, 'aug '],
  [/\b2\s*(?:ms|sc|SC)\s+(?:dans|in|into)\s+(?:la\s+m[eê]me(?:\s+maille)?|the\s+same\s+st(?:itch)?|same\s+st(?:itch)?|next\s+st(?:itch)?|la\s+maille\s+suivante)\b/gi, 'aug'],
]

function preprocess(str: string, notation: Notation) {
  // En termes UK, la maille serrée s'écrit « dc » : on la ramène à « SC » pour les règles ci-dessous.
  let s = notation === 'uk' ? str.replace(/\bdc\b(?!2)/gi, 'SC') : str
  for (const [re, rep] of PHRASES) s = s.replace(re, rep)
  return s
}

function parseTokens(str: string, out: StitchType[], map: Record<string, StitchType>) {
  const tokRe = /(\d+)?(\s*)([A-Za-zÀ-ÿ][A-Za-z0-9À-ÿ]*)/g
  let m
  while ((m = tokRe.exec(str))) {
    const raw = m[3]
    const word = normalizeWord(raw)
    let type: StitchType | null = null
    if (word.length === 1) {
      const glued = m[1] && !m[2]
      const upper = raw === raw.toUpperCase() && raw !== raw.toLowerCase()
      const single = SINGLE_MAP[word]
      if (single && (glued || upper || (m[1] && (word === 'm' || word === 'b')))) type = single
    } else {
      type = lookup(word, map)
    }
    if (!type) continue
    let count = m[1] ? Math.min(parseInt(m[1], 10), 500) : 1
    // « sc2tog 6 fois », « dim x3 »
    const mult = str.slice(tokRe.lastIndex).match(MULT_RE)
    if (mult) {
      count = Math.min(count * multiplier(mult), 500)
      tokRe.lastIndex += mult[0].length
    }
    for (let i = 0; i < count; i++) out.push(type)
  }
}

const OPENERS: Record<string, string> = { '*': '*', '(': ')', '[': ']' }
const MULT_RE = /^\s*[,;]?\s*(?:(?:x|×)\s*(\d+)|(\d+)\s*(?:x|×|fois|times)(?![a-z])|(?:r[ée]p[ée]ter|repeat|rep|r[ée]p)\.?\s+(encore\s+)?(\d+)\s*(more\s+times|more|fois\s+de\s+plus|autres\s+fois|fois|times|x)?)/i

// « x6 » → 6 ; « rep 5 more times » / « répéter encore 5 fois » → 6 au total
function multiplier(m: RegExpMatchArray) {
  const n = parseInt(m[1] || m[2] || m[4], 10)
  const more = m[3] || /more|plus|autres/i.test(m[5] || '')
  return Math.min(more ? n + 1 : n, 200)
}

function findGroup(str: string, from: number) {
  for (let i = from; i < str.length; i++) {
    const open = str[i]
    const close = OPENERS[open]
    if (!close) continue
    if (open === '*') {
      const end = str.indexOf('*', i + 1)
      if (end > i) return { start: i, end, inner: str.slice(i + 1, end) }
      continue
    }
    let depth = 0
    for (let j = i; j < str.length; j++) {
      if (str[j] === open) depth++
      else if (str[j] === close && --depth === 0) return { start: i, end: j, inner: str.slice(i + 1, j) }
    }
  }
  return null
}

// Développe les répétitions *…* xN, (…) xN, […] xN (récursif).
function expandSegment(str: string, out: StitchType[], map: Record<string, StitchType>, depth = 0) {
  if (depth > 8) return
  let rest = str
  let g
  while ((g = findGroup(rest, 0))) {
    if (g.start > 0) parseTokens(rest.slice(0, g.start), out, map)
    let after = rest.slice(g.end + 1)
    const mm = after.match(MULT_RE)
    const n = mm ? multiplier(mm) : 1
    if (mm) after = after.slice(mm[0].length)
    for (let i = 0; i < n; i++) expandSegment(g.inner, out, map, depth + 1)
    rest = after
  }
  if (rest) parseTokens(rest, out, map)
}

// Découpe sur les virgules de premier niveau (hors *…*, (…), […]).
function splitTopLevel(str: string) {
  const parts: string[] = []
  let depth = 0
  let star = false
  let cur = ''
  for (const c of str) {
    if (c === '*') star = !star
    else if (c === '(' || c === '[') depth++
    else if ((c === ')' || c === ']') && depth > 0) depth--
    if ((c === ',' || c === ';') && depth === 0 && !star) {
      parts.push(cur)
      cur = ''
    } else cur += c
  }
  parts.push(cur)
  return parts
}

const ROUND_WORD = '(?:rounds?|rangs?|rnds?|rows?|rds?|rgs?|tours?|r)'
const ROUND_RE = new RegExp(
  `^\\s*[-•·]?\\s*(${ROUND_WORD})\\.?\\s*(\\d+)` +
  `(?:\\s*(?:[-–—]|à|to|au)\\s*(?:${ROUND_WORD}\\.?\\s*)?(\\d+))?` +
  '\\s*[:.)]?\\s*(.+)$',
  'i',
)
const COUNT_RE = /(?:[([]\s*(\d+)\s*(?:m(?:ailles)?|ms|sts?|stitches)?\.?\s*[)\]]|[=→]\s*(\d+)\s*(?:m(?:ailles)?|ms|sts?|stitches)?)\s*[.;]?\s*$/i
const EACH_STITCH_RE = /(?:(?:\b(?:dans|sur)|(?:^|\s)[àa])\s+(?:chaque|toutes\s+les)\s+(?:mailles?|points?|m)\b(?:\s+(?:suivantes?|du\s+tour|du\s+rang|autour))?|\btout\s+(?:le\s+)?(?:tour|autour)\b|\bautour\b|\b(?:in|into)\s+(?:each|every)\s+(?:st(?:itch)?|sp|sc)\b(?:\s+(?:around|across))?|\b(?:all\s+)?around\b|\bacross\b)/i
const SIZES_COUNT_RE = /[([]\s*(\d+(?:\s*[,/]\s*\d+)+)\s*(?:m(?:ailles)?|ms|sts?|stitches)?\.?\s*[)\]]\s*[.;]?\s*$/i
// « 6 (7, 8) ms » : une valeur par taille ; une seule valeur entre parenthèses doit être suivie d'une maille
const INLINE_SIZES_RE = /(?<![x×\d*])(\d+)\s*\(\s*(\d+(?:\s*[,/]\s*\d+)+|\d+(?=\s*\)\s*[A-Za-z]))\s*\)/g
// mailles travaillées dans un arceau : la consommation n'est pas calculable
const CHAIN_SPACE_RE = /\b(?:ch-?\d*[\s-]*sp(?:ace)?s?|arceaux?|espaces?\s+de\s+ch)\b/i
const TURN_RE = /\b(?:turn|tourner|tournez|tourne)\b/i
const BLO_RE = /\b(?:blo|back\s+loops?(?:\s+only)?|brins?\s+arri[eè]res?|bra)\b/i
const FLO_RE = /\b(?:flo|front\s+loops?(?:\s+only)?|brins?\s+avant|bav)\b/i
// --- changements de couleur --------------------------------------------------
// « Couleur A : rose », « MC: grey », « CC1 = white »
const LEGEND_RE = /^\s*(?:(?:couleur|coloris|colou?r|fil)\s+([A-Z]\d?|\d)|(MC|CC\d?|CP|CS))\s*[:=–—-]\s*(.+)$/i
// « en rose », « avec le fil blanc », « in pink », « change to white », « (rose) »
const INLINE_COLOR_RE = /\b(?:en|avec(?:\s+le)?(?:\s+fil)?|au\s+fil|fil|couleur|coloris|in|with|using|change\s+to|switch\s+to|changer\s+(?:pour|en|de\s+couleur\s*:?)|passer\s+(?:au|à|en)|prendre\s+le\s+fil)\s+(?:le\s+|la\s+|l['’]|du\s+|de\s+la\s+|the\s+)?([^,;.()\n]{2,40})/gi
const PAREN_COLOR_RE = /\(([^()]{2,24})\)/g
const CHANGE_LINE_RE = /\b(?:changer|change|switch|passer\s+au|prendre\s+le\s+fil|joindre\s+le\s+fil|attach|join\s+(?:new\s+)?(?:yarn|colou?r))\b/i
// « couleur C » aussi dans un titre en majuscules (« COULEUR C ») ; les codes MC / CC restent en
// majuscules (« mc » est la maille coulée)
const LETTER_REF_RE = /\b(?:couleur|coloris|colou?r|fil)\s+([A-Z]\d?|\d)\b/i
const CODE_REF_RE = /\b(MC|CC\d?|CP|CS)\b/

export function colorLegend(text: string): Map<string, string> {
  const legend = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(LEGEND_RE)
    const color = m && findYarnColor(m[3])
    if (m && color) legend.set((m[1] || m[2]).toUpperCase(), color)
  }
  return legend
}

/** Couleur nommée dans une instruction (« en rose », « with CC », « (blanc) »), ou null. */
function colorIn(line: string, legend: Map<string, string>): string | null {
  for (const ref of [line.match(LETTER_REF_RE)?.[1], line.match(CODE_REF_RE)?.[1]]) {
    const c = ref && legend.get(ref.toUpperCase())
    if (c) return c
  }
  for (const m of line.matchAll(INLINE_COLOR_RE)) {
    // seuls les premiers mots après « en » / « in » : « en rond » ne désigne pas une couleur
    const c = findYarnColor(m[1].split(/\s+/).slice(0, 3).join(' '))
    if (c) return c
  }
  for (const m of line.matchAll(PAREN_COLOR_RE)) {
    if (m[1].trim().split(/\s+/).length <= 3) {
      const c = findYarnColor(m[1])
      if (c) return c
    }
  }
  return null
}

/** Couleur annoncée dans un titre de pièce (« AILES (x2, couleur C) », « TÊTE en beige »), légende comprise. */
export function headingColor(heading: string, legend: Map<string, string>): string | null {
  return colorIn(heading, legend) ?? findYarnColor(heading)
}

const CONTINUES_RE = /\bsuite\s+(?:du|de|des|d['’])|\bcontinued?\b|\(cont\.?\)/i
const SECTION_STOPWORDS = /^(?:notes?|mat[ée]riel|fournitures|abr[ée]viations?|l[ée]gende|astuces?|conseils?|remarques?|materials?|supplies|abbreviations?|tips?|gauge|[ée]chantillon|taille|size)\b/i

/** Détecte la notation employée par un texte : 'uk' si termes britanniques, sinon 'us'. */
export function detectNotation(text: string | null | undefined): 'us' | 'uk' {
  if (!text) return 'us'
  if (/\b(?:uk\s+terms?|termes?\s+(?:uk|anglais|britanniques?)|british\s+terms?)\b/i.test(text)) return 'uk'
  if (/\bhtr\b/i.test(text)) return 'uk'
  return 'us'
}

function sectionName(line: string) {
  if (line.includes('=')) return null
  const heading = /^#{1,6}\s/.test(line)
  let s = line.replace(/^[#=*_\-•\s]+/, '').replace(/[#=*_\s]+$/, '')
  const colon = /:\s*$/.test(s)
  s = s.replace(/\s*:\s*$/, '').trim()
  if (s.length < 2 || s.length > 60 || /^\d/.test(s) || s.includes(':')) return null
  if (SECTION_STOPWORDS.test(s)) return null
  const first = s.match(/^\p{L}+/u)?.[0]
  if (!first) return null
  // Premier mot en majuscules : « CORPS », « OREILLES (x2) », « MUSEAU — pointe »
  if (first.length >= 2 && first === first.toUpperCase() && first !== first.toLowerCase()) return s
  // Sinon : titre court terminé par « : » ou titre Markdown (« Tête : », « ## Bras »)
  if ((colon || heading) && s.length <= 40 && /^\p{Lu}/u.test(s) && !/[.!?…]$/.test(s)) return s
  return null
}

/** Nombre d'exemplaires d'une pièce indiqué dans son titre : « OREILLES (x2) » → 2. */
export function sectionCopies(section: string | null | undefined) {
  const m = section?.match(/(?:^|[\s(])[x×]\s*(\d)(?!\w)|\((\d)\s*(?:pi[eè]ces?|exemplaires?|pieces?)\)/i)
  const n = m ? parseInt(m[1] || m[2], 10) : 1
  return Math.max(1, Math.min(n, 6))
}

/** Nombre de tailles proposées par le patron : « (80, 88, 96) » → 3. */
export function detectSizes(text: string | null | undefined) {
  let n = 1
  for (const line of (text || '').split(/\r?\n/)) {
    if (!ROUND_RE.test(line)) continue
    const tail = line.match(SIZES_COUNT_RE)
    if (tail) n = Math.max(n, tail[1].split(/[,/]/).length)
    for (const m of line.matchAll(INLINE_SIZES_RE)) n = Math.max(n, m[2].split(/[,/]/).length + 1)
  }
  return Math.min(n, 8)
}

function pickSize(values: string[], size: number) {
  return values[Math.min(size, values.length - 1)]
}

function slug(s: string | null) {
  return normalizeWord((s || '').replace(/\s+/g, '-')).slice(0, 24) || 'patron'
}

function parseInstruction(instruction: string, prevCount: number, expected: number | null, map: Record<string, StitchType>): StitchType[] {
  const each = instruction.match(EACH_STITCH_RE)
  if (!each) {
    const stitches: StitchType[] = []
    expandSegment(instruction, stitches, map)
    return stitches
  }
  // « X dans chaque maille » : l'unité (dernière clause avant l'expression) est répétée
  // pour couvrir le rang précédent.
  const at = each.index ?? 0
  const before = splitTopLevel(instruction.slice(0, at))
  const unitStr = before.pop() ?? ''
  const prefix: StitchType[] = []
  for (const part of before) expandSegment(part, prefix, map)
  const unit: StitchType[] = []
  expandSegment(unitStr, unit, map)
  const suffix: StitchType[] = []
  expandSegment(instruction.slice(at + each[0].length), suffix, map)
  if (unit.length === 0) return [...prefix, ...suffix]

  const all = [...prefix, ...unit, ...suffix]
  const structuralOnly = isStructuralOnly(all)
  const unitConsumed = stitchConsumed(unit, structuralOnly)
  let reps = 1
  if (prevCount > 0 && unitConsumed > 0) {
    const target = prevCount - stitchConsumed(prefix, structuralOnly) - stitchConsumed(suffix, structuralOnly)
    reps = Math.round(target / unitConsumed)
  } else if (expected != null) {
    const unitProduced = stitchCount(unit)
    if (unitProduced > 0) reps = Math.round((expected - stitchCount([...prefix, ...suffix])) / unitProduced)
  }
  reps = Math.max(1, Math.min(reps, 500))
  const stitches = [...prefix]
  for (let i = 0; i < reps; i++) stitches.push(...unit)
  stitches.push(...suffix)
  return stitches
}

/**
 * @param {string} text
 * @param {{ notation?: 'auto' | 'us' | 'uk', size?: number }} [options]
 * @returns {Round[]}
 *   valid : le compte calculé correspond au compte attendu « (N) » (ou pas de compte indiqué)
 *   fits  : les mailles consommées correspondent au rang précédent de la même pièce (null si inconnu)
 */
export function parsePattern(text: string | null | undefined, options: ParseOptions = {}): Round[] {
  if (!text) return []
  const notation = options.notation && options.notation !== 'auto' ? options.notation : detectNotation(text)
  const map = notation === 'uk' ? UK_MAP : BASE_MAP
  const size = Math.max(0, (options.size ?? 0) | 0)
  const rounds: Round[] = []
  const keys = new Map<string, number>()
  let section: string | null = null
  let piece = -1
  let prevInSection: Round | null = null
  const legend = colorLegend(text)
  // couleur en cours dans la pièce (null : couleur de la pièce)
  let color: string | null = null

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const rm = line.match(ROUND_RE)
    if (!rm) {
      const sec = sectionName(line)
      if (sec) {
        // « CORPS (suite du museau) » prolonge la pièce précédente
        if (!(CONTINUES_RE.test(sec) && prevInSection)) {
          prevInSection = null
          piece++
          color = null
        }
        section = sec
      } else if (CHANGE_LINE_RE.test(line)) {
        // « Changer pour le fil blanc. » entre deux rangs
        color = colorIn(line, legend) ?? color
      }
      continue
    }
    if (piece < 0) piece = 0

    let instruction = rm[4]
    color = colorIn(instruction, legend) ?? color
    const flat = /^rows?$/i.test(rm[1]) || TURN_RE.test(instruction)
    const inSpace = CHAIN_SPACE_RE.test(instruction)
    const loop = BLO_RE.test(instruction) ? 'blo' : FLO_RE.test(instruction) ? 'flo' : null
    let expected = null
    const sm = instruction.match(SIZES_COUNT_RE)
    const cm = sm ? null : instruction.match(COUNT_RE)
    if (sm) {
      expected = parseInt(pickSize(sm[1].split(/[,/]/), size), 10)
      instruction = instruction.slice(0, sm.index)
    } else if (cm) {
      expected = parseInt(cm[1] || cm[2], 10)
      instruction = instruction.slice(0, cm.index)
    }
    instruction = instruction.replace(INLINE_SIZES_RE, (_, first, rest) => pickSize([first, ...rest.split(/[,/]/)], size).trim())
    instruction = preprocess(instruction, notation)

    const from = parseInt(rm[2], 10)
    let to = rm[3] != null ? parseInt(rm[3], 10) : from
    if (to < from || to - from >= 50) to = from

    for (let r = from; r <= to; r++) {
      const prevCount = prevInSection ? prevInSection.count : 0
      const stitches = parseInstruction(instruction, prevCount, expected, map)
      const count = stitchCount(stitches)
      const consumed = stitchConsumed(stitches)
      const label = `R${r}`
      let key = `round-${slug(section)}-${r}`
      const seen = keys.get(key) || 0
      keys.set(key, seen + 1)
      if (seen) key += `-${seen + 1}`
      const round: Round = {
        key,
        label,
        number: r,
        text: line,
        section,
        piece,
        flat,
        loop,
        stitches,
        count,
        consumed,
        prevCount: prevInSection ? prevCount : null,
        expected,
        color,
        valid: expected == null || count === expected,
        fits: prevInSection && stitches.length && !inSpace && !isStructuralOnly(stitches) ? consumed === prevCount : null,
      }
      rounds.push(round)
      prevInSection = round
    }
  }
  return rounds
}

const CORD_RE = /\b(?:cha[iî]ner|cha[iî]nette\s+de|monter|chain|ch)\s*(\d{1,3})\s*(?:ml|mailles?\s+en\s+l['’]air|ch|chains?|sts?)?\b/i

/**
 * Chaînettes décrites hors des rangs dans une section sans rang (« QUEUE — Chaîner 40 ml »).
 * Utilisé par l'aperçu 3D pour les queues, cordons et ficelles.
 */
export function parseCords(text: string | null | undefined): Cord[] {
  if (!text) return []
  const found = new Map<string | null, { length: number, rounds: number }>()
  let section: string | null = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const entry = found.get(section) ?? { length: 0, rounds: 0 }
    if (ROUND_RE.test(line)) {
      entry.rounds++
      found.set(section, entry)
      continue
    }
    const sec = sectionName(line)
    if (sec) {
      section = sec
      continue
    }
    const m = line.match(CORD_RE)
    if (m && !entry.length) {
      entry.length = parseInt(m[1], 10)
      found.set(section, entry)
    }
  }
  return [...found.entries()]
    .filter(([sec, e]) => sec !== null && e.rounds === 0 && e.length >= 4)
    .map(([sec, e]) => ({ section: sec, length: e.length }))
}

/** Texte de chaque section (lignes jusqu'au titre suivant), clé null pour le préambule. */
export function splitSections(text: string | null | undefined): Map<string | null, string> {
  const out = new Map<string | null, string>()
  let section: string | null = null
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (line && !ROUND_RE.test(line)) {
      const sec = sectionName(line)
      if (sec) {
        section = sec
        if (!out.has(section)) out.set(section, '')
        continue
      }
    }
    out.set(section, `${out.get(section) ?? ''}${raw}\n`)
  }
  return out
}

/** Options de parsing enregistrées sur un patron. */
export function parseOptions(pattern: { notation?: Notation, size?: number } | null | undefined): ParseOptions {
  return { notation: pattern?.notation || 'auto', size: pattern?.size || 0 }
}

/**
 * Après modification du texte, retrouve les rangs cochés dans la nouvelle version :
 * même clé si elle existe encore, sinon même position (n° de pièce, n° de rang, occurrence).
 * @param {Round[]} oldRounds @param {Round[]} newRounds @param {string[]} doneKeys
 * @returns {string[]}
 */
export function remapRoundKeys(oldRounds: Round[], newRounds: Round[], doneKeys: string[]): string[] {
  const newKeys = new Set(newRounds.map((r) => r.key))
  const position = (rounds: Round[]) => {
    const seen = new Map<string, number>()
    const sections: string[] = []
    return rounds.map((r) => {
      const sec = r.section ?? ''
      if (sections[sections.length - 1] !== sec) sections.push(sec)
      const base = `${sections.length}:${r.number}`
      const n = (seen.get(base) || 0) + 1
      seen.set(base, n)
      return `${base}:${n}`
    })
  }
  const oldPos = new Map(position(oldRounds).map((p, i) => [oldRounds[i].key, p]))
  const newByPos = new Map(position(newRounds).map((p, i) => [p, newRounds[i].key]))
  const out = new Set<string>()
  for (const k of doneKeys) {
    if (newKeys.has(k)) out.add(k)
    else {
      const pos = oldPos.get(k)
      const mapped = pos ? newByPos.get(pos) : undefined
      if (mapped) out.add(mapped)
    }
  }
  return [...out]
}

/** Résumé utile pour l'interface : nombre de rangs, de pièces et d'anomalies. */
export function patternStats(rounds: Round[]) {
  return {
    rounds: rounds.length,
    sections: new Set(rounds.map((r) => r.section ?? '')).size,
    pieces: new Set(rounds.map((r) => r.piece)).size,
    invalid: rounds.filter((r) => !r.valid).length,
    misfit: rounds.filter((r) => r.fits === false).length,
  }
}
