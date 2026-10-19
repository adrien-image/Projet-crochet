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
  // ES : punto bajo, punto alto, medio punto alto, punto deslizado, cadeneta, aumento, disminución
  pb: 'sc', pa: 'dc', mpa: 'hdc', pd: 'sl', pr: 'sl', cad: 'ch', cadeneta: 'ch', aum: 'inc', aumento: 'inc', dism: 'dec', dis: 'dec', disminucion: 'dec',
  // PT : ponto baixo, ponto alto, meio ponto alto, ponto baixíssimo, correntinha
  pbx: 'sl', corr: 'ch', correntinha: 'ch', dim2: 'dec',
  // DE : feste Masche, Stäbchen, halbes Stäbchen, Kettmasche, Luftmasche, zunehmen, abnehmen
  fm: 'sc', stb: 'dc', hstb: 'hdc', dstb: 'tr', kettm: 'sl', km: 'sl', lm: 'ch', zun: 'inc', zunahme: 'inc', abn: 'dec', abnahme: 'dec',
  // IT : maglia bassa, maglia alta, mezza maglia alta, maglia bassissima, catenella
  mb: 'sc', ma: 'dc', mma: 'hdc', mbss: 'sl', cat: 'ch', catenella: 'ch',
  // NL : vaste, stokje, half stokje, halve vaste, losse, meerderen, minderen
  vaste: 'sc', stk: 'dc', hstk: 'hdc', hv: 'sl', losse: 'ch', meerd: 'inc', meerderen: 'inc', mind: 'dec', minderen: 'dec',
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
  [/\b(?:anneau|cercle)\s+magique\b|\bmagic\s+(?:ring|circle|loop)\b|\banillo\s+m[áa]gico\b|\banel\s+m[áa]gico\b|\banello\s+magico\b|\bmagischer?\s+(?:ring|kreis)\b|\bfadenring\b|\bmagische\s+ring\b/gi, ''],
  // formes longues des autres langues → abréviations du dictionnaire
  [/\bmedio\s+punto\s+alto\b|\bmeio\s+ponto\s+alto\b/gi, 'mpa'],
  [/\bpuntos?\s+bajos?\b|\bpontos?\s+baixos?\b/gi, 'pb'],
  [/\bpuntos?\s+altos?\b|\bpontos?\s+altos?\b/gi, 'pa'],
  [/\bpuntos?\s+(?:deslizados?|enanos?)\b|\bpontos?\s+baix[íi]ssimos?\b/gi, 'pd'],
  // « jede M verdoppeln » : une augmentation dans chaque maille
  [/\b(?:jede|alle)\s+m(?:aschen?)?\s+verdoppel\w*/gi, 'zun in jede M'],
  [/\bfeste[n]?\s+maschen?\b/gi, 'fm'],
  [/\bhalbe[ns]?\s+st[äa]bchen\b/gi, 'hstb'],
  [/\bst[äa]bchen\b/gi, 'stb'],
  [/\bluftmaschen?\b/gi, 'lm'],
  [/\bkettmaschen?\b/gi, 'km'],
  [/\bmezz[ae]\s+magli[ae]\s+alt[ae]\b/gi, 'mma'],
  [/\bmagli[ae]\s+bassissim[ae]\b/gi, 'mbss'],
  [/\bmagli[ae]\s+bass[ae]\b/gi, 'mb'],
  [/\bmagli[ae]\s+alt[ae]\b/gi, 'ma'],
  [/\bhalf\s+stokjes?\b/gi, 'hstk'],
  [/\bstokjes?\b/gi, 'stk'],
  [/\bhalve\s+vasten?\b/gi, 'hv'],
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

/**
 * Plafond de mailles par rang : bien au-delà d'un vrai rang (une couverture fait quelques centaines de
 * mailles), mais assez bas pour qu'un texte collé comme « (((sc) x200) x200) x200 » (8 millions de
 * mailles) ne fige pas l'onglet — diagrammes, tissu et 3D sont dessinés maille par maille.
 */
export const MAX_STITCHES = 2000
/** nombre maximal de rangs d'une plage « R2-R300 » */
const MAX_RANGE = 400

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
    for (let i = 0; i < count && out.length < MAX_STITCHES; i++) out.push(type)
    if (out.length >= MAX_STITCHES) return
  }
}

const OPENERS: Record<string, string> = { '*': '*', '(': ')', '[': ']' }
const MULT_RE = /^\s*[,;]?\s*(?:(?:x|×)\s*(\d+)|(\d+)\s*(?:x|×|fois|times|veces|vezes|mal|volte|keer)(?![a-z])|(?:r[ée]p[ée]ter|repeat|rep|r[ée]p)\.?\s+(encore\s+)?(\d+)\s*(more\s+times|more|fois\s+de\s+plus|autres\s+fois|fois|times|x)?)/i

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
    for (let i = 0; i < n && out.length < MAX_STITCHES; i++) expandSegment(g.inner, out, map, depth + 1)
    if (out.length >= MAX_STITCHES) return
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

// FR, EN, ES (vuelta, hilera), PT (carreira, volta), DE (Runde, Reihe), IT (giro), NL (toer)
const ROUND_WORD = '(?:rounds?|rangs?|rnds?|rows?|rds?|rgs?|tours?|vueltas?|vtas?|hileras?|carreiras?|carr|voltas?|runden?|reihen?|giros?|toer(?:en)?|r|v|g|t)'
const ROUND_RE = new RegExp(
  `^\\s*[-•·]?\\s*(${ROUND_WORD})\\.?\\s*(\\d+)` +
  // plages « R4-R6 », « Rangs 4 à 6 », « R14 & 15 », « Rnds 3 and 4 »
  `(?:\\s*(?:[-–—&]|à|to|au|and|et)\\s*(?:${ROUND_WORD}\\.?\\s*)?(\\d+))?` +
  '\\s*[:.)]?\\s*(.+)$',
  'i',
)
// « (18) », « = 16 sc », « = 54 sc in each rnd. » (en fin de rang)
const COUNT_RE = /(?:[([]\s*(\d+)\s*(?:m(?:ailles)?|ms|sts?|stitches|pb|pts?|puntos|pontos|fm|maschen|maglie|mb|steken|p)?\.?\s*[)\]]|[=→]\s*(\d+)\s*(?:[a-zà-ÿ]{1,9}\.?)?(?:\s+(?:in|en|dans)\s+(?:e\s?ach|every|chaque)\s+(?:rnds?|rounds?|rows?|rangs?|tours?))?)\s*[.;]?\s*$/i
const EACH_STITCH_RE = /(?:(?:\b(?:dans|sur)|(?:^|\s)[àa])\s+(?:chaque|toutes\s+les)\s+(?:mailles?|points?|m)\b(?:\s+(?:suivantes?|du\s+tour|du\s+rang|autour))?|\btout\s+(?:le\s+)?(?:tour|autour)\b|\bautour\b|\b(?:in|into)\s+(?:each|every)\s+(?:st(?:itch)?|sp|sc)\b(?:\s+(?:around|across))?|\b(?:all\s+)?around\b|\bacross\b|\b(?:en|em)\s+cada\s+(?:punto|ponto|pt|p)\b|\bin\s+(?:jede|ogni|elke)\s+(?:masche|maglia|punto|steek|st|m)\b|\b(?:alrededor|rundherum|rondom)\b|\bem\s+volta\b|\btutto\s+intorno\b)/i
const SIZES_COUNT_RE = /[([]\s*(\d+(?:\s*[,/]\s*\d+)+)\s*(?:m(?:ailles)?|ms|sts?|stitches)?\.?\s*[)\]]\s*[.;]?\s*$/i
// « 6 (7, 8) ms » : une valeur par taille ; une seule valeur entre parenthèses doit être suivie d'une maille
const INLINE_SIZES_RE = /(?<![x×\d*])(\d+)\s*\(\s*(\d+(?:\s*[,/]\s*\d+)+|\d+(?=\s*\)\s*[A-Za-z]))\s*\)/g
// mailles travaillées dans un arceau : la consommation n'est pas calculable
const CHAIN_SPACE_RE = /\b(?:ch-?\d*[\s-]*sp(?:ace)?s?|arceaux?|espaces?\s+de\s+ch|(?:into|in)\s+(?:the\s+)?(?:chains?|ch)\b|dans\s+les\s+(?:ml|ch|mailles\s+en\s+l['’]air))/i
// pièce travaillée en rangs (consigne de la section) : « Crochet back and forth », « en aller-retour »
const FLAT_SECTION_RE = /\b(?:back\s+and\s+forth|aller[-\s]retour|in\s+rows|en\s+rangs)\b/i
const TURN_RE = /\b(?:turn|tourner|tournez|tourne)\b/i
const BLO_RE = /\b(?:blo|back\s+loops?(?:\s+only)?|brins?\s+arri[eè]res?|bra)\b/i
const FLO_RE = /\b(?:flo|front\s+loops?(?:\s+only)?|brins?\s+avant|bav)\b/i
// --- changements de couleur --------------------------------------------------
// « Couleur A : rose », « MC: grey », « CC1 = white »
const LEGEND_RE = /^\s*(?:(?:couleur|coloris|colou?r|fil)\s+([A-Z]\d?|\d)|(MC|CC\d?|CP|CS))\s*[:=–—-]\s*(.+)$/i
// « en rose », « avec le fil blanc », « in pink », « change to white », « (rose) »
const INLINE_COLOR_RE = /\b(?:en|avec(?:\s+le)?(?:\s+fil)?|au\s+fil|fil|couleur|coloris|colou?r|in|with|using|change\s+to|switch\s+to|changer\s+(?:pour|en|de\s+couleur\s*:?)|passer\s+(?:au|à|en)|prendre\s+le\s+fil)\s+(?:le\s+|la\s+|l['’]|du\s+|de\s+la\s+|the\s+)?([^,;.()\n]{2,40})/gi
const PAREN_COLOR_RE = /\(([^()]{2,24})\)/g
const CHANGE_LINE_RE = /\b(?:changer|change|switch|passer\s+au|prendre\s+le\s+fil|joindre\s+le\s+fil|attach|join\s+(?:new\s+)?(?:yarn|colou?r)|use\s+(?:colou?r|yarn)|using|utilise[rz]?|work\s+with|avec\s+le\s+fil)\b/i
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
const SECTION_STOPWORDS = /^(?:pattern|patron|instructions?|notes?|mat[ée]riel|fournitures|abr[ée]viations?|l[ée]gende|astuces?|conseils?|remarques?|materials?|supplies|abbreviations?|tips?|gauge|[ée]chantillon|taille|size)\b/i

/** Détecte la notation employée par un texte : 'uk' si termes britanniques, sinon 'us'. */
export function detectNotation(text: string | null | undefined): 'us' | 'uk' {
  if (!text) return 'us'
  if (/\b(?:uk\s+terms?|termes?\s+(?:uk|anglais|britanniques?)|british\s+terms?)\b/i.test(text)) return 'uk'
  if (/\bhtr\b/i.test(text)) return 'uk'
  return 'us'
}

/** « Blanc : », « Bleu » seul sur sa ligne : la couleur du fil des rangs suivants (pas une pièce). */
function colorLabel(line: string): string | null {
  const m = line.match(/^\s*[-•]?\s*(\p{L}+(?:\s+\p{L}+)?)\s*:?\s*$/u)
  return m ? findYarnColor(m[1]) : null
}

function sectionName(line: string) {
  if (line.includes('=') || colorLabel(line)) return null
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
const WORD_NUMBERS: Record<string, number> = { two: 2, three: 3, four: 4, deux: 2, trois: 3, quatre: 4 }

export function sectionCopies(section: string | null | undefined) {
  const m = section?.match(/(?:^|[\s(])[x×]\s*(\d)(?!\w)|\((\d)\s*(?:pi[eè]ces?|exemplaires?|pieces?)\)|\b(?:make|faire|r[ée]aliser|crocheter|crochet)\s+(\d|two|three|four|deux|trois|quatre)\b|\b(\d)\s*[x×](?!\w)/i)
  const raw = m ? (m[1] || m[2] || m[3] || m[4]).toLowerCase() : '1'
  const n = WORD_NUMBERS[raw] ?? (parseInt(raw, 10) || 1)
  return Math.max(1, Math.min(n, 6))
}

// Rangs numérotés sans préfixe : « 1 – 6 sc… », « 4 to 7 – 18 sc », « 18 and 19 – … », « 3 e 4 – … »
const BARE_ROUND_RE = /^\s*(\d{1,3})(?:\s*(?:[-–—]|to|and|et|e|y|à|au|a)\s*(\d{1,3}))?\s*(?:[–—:.)]|-(?!\d))\s*(.+)$/i
// un rang sans préfixe doit contenir une maille (sinon : liste numérotée d'étapes, quantités…)
const STITCH_HINT_RE = /\b(?:sc|hdc|dc|tr|trc|htr|ss|sl\s*st|slst|ch|inc|dec|invdec|ms|db|dB|br|dbr|mc|ml|aug|dim|pb|mr|magic\s+(?:ring|circle)|anneau)\b/i

interface RoundMatch { word: string, from: number, to: number | null, instruction: string }
type ScannedLine =
  | { kind: 'round', line: string, round: RoundMatch }
  | { kind: 'section', line: string, name: string }
  | { kind: 'text', line: string }

/** une consigne, pas un titre : « Use color… », « Make a magic ring », « Pique ton crochet… » */
const INSTRUCTION_LINE_RE = /^\s*(?:use|using|switch|change|crochet|make|join|attach|sew|insert|stuff|fasten|ch\b|chain|start|with|work|leave|cut|note|repeat|continue|pick|turn|place|do\b|don['’]t|close|weave|pull|skip|r[ée]p[ée]te[rz]?|utilise[rz]?|prends?|commence[rz]?|fais|faire|pique|coupe[rz]?|couds?|coudre|rembourre[rz]?|bourre[rz]?|ferme[rz]?|tourne[rz]?|croch[eè]te[rz]?|continue[rz]?|laisse[rz]?|positionne[rz]?|brode[rz]?|colle[rz]?|d[ée]coupe[rz]?|monte[rz]?|travaille[rz]?|attache[rz]?|r[ée]alise[rz]?)\b/i
// une chaînette de départ (queue, antennes) : « ch 26, 25 ms dans ch », « Chaîner 40 ml »
const CORD_START_RE = /^\s*(?:ch|chain|cha[iî]ner|cha[iî]nette(?:\s+de)?|monter)\s*\d/i

/**
 * Titre « souple » (casse mixte, sans « : » final) : seulement juste avant un rang 1, comme
 * « Front legs – make 2 » ou « Body: start at the top of the snout ».
 */
function looseSectionName(line: string): string | null {
  const s = line.replace(/^[#=*_\-•\s]+/, '').replace(/[#=*_\s]+$/, '').trim()
  if (s.length < 2 || s.length > 70 || !/^\p{Lu}/u.test(s) || /[.!?…]$/.test(s) || SECTION_STOPWORDS.test(s)) return null
  // « Body: start at the top » → « Body (start at the top) »
  const m = s.match(/^([^:]{2,30}):\s*(.*)$/)
  if (m) return m[2] ? `${m[1].trim()} (${m[2].replace(/\s*:\s*$/, '')})` : m[1].trim()
  return s
}

const TABLE_LABEL_RE = new RegExp(`^(?:(${ROUND_WORD})\\.?\\s*)?(\\d{1,3}(?:\\s*(?:[-–—&]|to|à|and|et)\\s*\\d{1,3})?)\\s*[:.)]?$`, 'i')

/**
 * Ligne de tableau (« R1 | 6 sc in a magic ring | 6 », cellules séparées par « | » à l'extraction d'un
 * PDF ou par des tabulations collées depuis un tableur) → « R1: 6 sc in a magic ring (6) ». Une autre
 * ligne à cellules (rang suivi d'une légende de photo) garde sa première cellule et les cellules à mailles.
 */
function tableLine(line: string): string {
  if (!line.includes('|') && !line.includes('\t')) return line
  const cells = line.split(/\s*\|\s*|\t+/).map((c) => c.trim()).filter(Boolean)
  if (cells.length < 2) return cells.join(' ')
  const label = cells[0].match(TABLE_LABEL_RE)
  if (label) {
    const rest = cells.slice(1)
    const count = rest.length > 1 && /^\(?\d{1,4}\)?$/.test(rest[rest.length - 1]) ? rest.pop()!.replace(/[()]/g, '') : null
    return `${label[1] ?? 'R'}${label[2]}: ${rest.join(', ')}${count ? ` (${count})` : ''}`
  }
  return [cells[0], ...cells.slice(1).filter((c) => STITCH_HINT_RE.test(c))].join(' ')
}

/** Classe chaque ligne du texte : rang, titre de pièce ou texte libre. */
function scanLines(text: string | null | undefined): ScannedLine[] {
  const out: ScannedLine[] = []
  // numéro attendu pour le prochain rang sans préfixe de la pièce en cours
  let bareNext: number | null = null
  for (const raw of (text || '').split(/\r?\n/)) {
    // espaces regroupés : aucune expression ne s'emballe sur « 6 sc =1          x »
    const line = tableLine(raw.trim()).replace(/\s+/g, ' ')
    if (!line) continue
    const rm = line.match(ROUND_RE)
    if (rm) {
      out.push({ kind: 'round', line, round: { word: rm[1], from: parseInt(rm[2], 10), to: rm[3] != null ? parseInt(rm[3], 10) : null, instruction: rm[4] } })
      continue
    }
    const bm = line.match(BARE_ROUND_RE)
    if (bm && STITCH_HINT_RE.test(bm[3])) {
      const from = parseInt(bm[1], 10)
      const to = bm[2] != null ? parseInt(bm[2], 10) : null
      if (from === 1 || from === bareNext) {
        out.push({ kind: 'round', line, round: { word: '', from, to, instruction: bm[3] } })
        bareNext = (to ?? from) + 1
        continue
      }
    }
    const name = sectionName(line)
    if (name) {
      bareNext = null
      out.push({ kind: 'section', line, name })
    } else out.push({ kind: 'text', line })
  }
  // titres souples : avant un rang 1 (ou une chaînette), parmi les lignes de texte qui le précèdent
  // (« Ears (make 2) / Use color… / Crochet in the round… / Make a magic ring. / R1 : … »), le dernier
  // titre plausible — ni une consigne, ni une phrase
  for (let i = 0; i < out.length; i++) {
    const cur = out[i]
    const anchor = (cur.kind === 'round' && cur.round.from === 1) || (cur.kind === 'text' && CORD_START_RE.test(cur.line))
    if (!anchor) continue
    let found = -1
    for (let j = i - 1; j >= 0 && out[j].kind === 'text' && i - j <= 8; j--) {
      const l = out[j].line
      if (looseSectionName(l) && !INSTRUCTION_LINE_RE.test(l) && !/[:.;!?]$/.test(l) && l.split(':')[0].split(/\s+/).length <= 8) {
        found = j
        break
      }
    }
    if (found >= 0) out[found] = { kind: 'section', line: out[found].line, name: looseSectionName(out[found].line)! }
  }
  return out
}

const ROWS_NOTE_RE = /\(\s*\d+\s*(?:rows?|rounds?|rnds?|rangs?|tours?)\s*\)/gi

/**
 * Retire les remarques d'un rang : « 18 sc (2 rows) – stuff the head » → « 18 sc »,
 * « BLO – 18 sc » → « 18 sc ». Les morceaux séparés par un tiret espacé sans maille sont ignorés.
 */
function stripRoundRemarks(instruction: string): string {
  const cleaned = instruction.replace(ROWS_NOTE_RE, ' ')
  const parts = cleaned.split(/\s+[–—-]\s+/)
  if (parts.length === 1) return cleaned.trim()
  const kept = parts.filter((p) => STITCH_HINT_RE.test(p))
  return (kept.length ? kept.join(', ') : cleaned).trim()
}

// une répétition est déjà écrite : pas de répétition implicite
const EXPLICIT_REPEAT_RE = /[x×*]\s*\d|\d\s*[x×]|\brep(?:eat)?\b|\bfois\b|\btimes\b|around|autour|chaque|\beach\b|\bevery\b|across/i

/** La ligne est-elle un rang (« R3 : … », « 3 – 1 sc, 1 inc (18) ») ? */
export function looksLikeRound(line: string): boolean {
  if (ROUND_RE.test(line)) return true
  const bm = line.match(BARE_ROUND_RE)
  return !!bm && STITCH_HINT_RE.test(bm[3])
}

/** Nombre de tailles proposées par le patron : « (80, 88, 96) » → 3. */
export function detectSizes(text: string | null | undefined) {
  let n = 1
  for (const { kind, line } of scanLines(text)) {
    if (kind !== 'round') continue
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
  reps = Math.max(1, Math.min(reps, 500, Math.floor(MAX_STITCHES / unit.length)))
  const stitches = [...prefix]
  for (let i = 0; i < reps; i++) stitches.push(...unit)
  stitches.push(...suffix)
  return stitches.slice(0, MAX_STITCHES)
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
  // numéro de la dernière pièce ouverte (une pièce reprise plus loin ne fait pas reculer la numérotation)
  let lastPiece = -1
  let sectionFlat = false
  let prevInSection: Round | null = null
  const legend = colorLegend(text)
  // couleur en cours dans la pièce (null : couleur de la pièce)
  let color: string | null = null

  for (const scanned of scanLines(text)) {
    const { line } = scanned
    if (scanned.kind !== 'round') {
      const sec = scanned.kind === 'section' ? scanned.name : null
      if (sec) {
        // « CORPS (suite du museau) » prolonge la pièce précédente
        if (!(CONTINUES_RE.test(sec) && prevInSection)) {
          prevInSection = null
          piece = ++lastPiece
          color = null
          sectionFlat = false
        }
        section = sec
      } else if (CHANGE_LINE_RE.test(line)) {
        // « Changer pour le fil blanc. », « Use color #8008 rock corey » entre deux rangs
        color = colorIn(line, legend) ?? color
      } else {
        // « Blanc : »
        color = colorLabel(line) ?? color
      }
      if (FLAT_SECTION_RE.test(line)) sectionFlat = true
      continue
    }
    if (piece < 0) piece = lastPiece = 0

    const rm = scanned.round
    let instruction = rm.instruction
    color = colorIn(instruction, legend) ?? color
    const flat = /^rows?$/i.test(rm.word) || TURN_RE.test(instruction) || sectionFlat
    const inSpace = CHAIN_SPACE_RE.test(instruction)
    const loop = BLO_RE.test(instruction) ? 'blo' : FLO_RE.test(instruction) ? 'flo' : null
    // espaces regroupés : les expressions de fin de rang (« = 16 sc », « (12) ») ne peuvent plus
    // s'emballer sur une longue suite d'espaces (texte collé, PDF)
    instruction = stripRoundRemarks(instruction).replace(/\s+/g, ' ')
    let expected = null
    const sm = instruction.match(SIZES_COUNT_RE)
    const cm = sm ? null : instruction.match(COUNT_RE)
    if (sm) {
      expected = parseInt(pickSize(sm[1].split(/[,/]/), size), 10)
      instruction = instruction.slice(0, sm.index)
    } else if (cm) {
      expected = parseInt(cm[1] || cm[2], 10)
      const before = instruction.slice(0, cm.index)
      // « R8 - 14 (7 rnds) = 48 sc in each rnd » : rien avant « = », le compte est l'instruction
      instruction = cm[2] && !STITCH_HINT_RE.test(before) ? cm[0].replace(/^\s*[=→]\s*/, '').replace(/\s+(?:in|en|dans)\s+(?:e\s?ach|every|chaque)\s+\S+\s*\.?\s*$/i, '') : before
    }
    instruction = instruction.replace(INLINE_SIZES_RE, (_, first, rest) => pickSize([first, ...rest.split(/[,/]/)], size).trim())
    instruction = preprocess(instruction, notation)

    // « R25 & 26 » placés après une autre pièce (« Make 2 more rnds joining this part into body ») :
    // ils continuent la pièce qui s'était arrêtée au rang 24, si le compte s'y raccorde
    if (prevInSection && rm.from > prevInSection.number + 2) {
      const earlier = [...rounds].reverse().find((r) => r.number === rm.from - 1 && r.piece !== piece)
      if (earlier && stitchConsumed(parseInstruction(instruction, earlier.count, expected, map)) === earlier.count) {
        piece = earlier.piece
        section = earlier.section
        prevInSection = earlier
      }
    }
    const from = rm.from
    let to = rm.to ?? from
    // « Rows 2-60 » (écharpe, couverture) : une longue plage reste une plage, dans la limite du raisonnable
    if (to < from) to = from
    to = Math.min(to, from + MAX_RANGE)

    for (let r = from; r <= to; r++) {
      const prevCount = prevInSection ? prevInSection.count : 0
      let stitches = parseInstruction(instruction, prevCount, expected, map)
      // « 3 – 1 sc, 1 inc (18) » : la séquence se répète tout le tour (le compte annoncé le confirme)
      const once = stitchConsumed(stitches)
      if (expected != null && once > 0 && prevCount > once && prevCount % once === 0 && !EXPLICIT_REPEAT_RE.test(instruction)
        && stitchCount(stitches) * (prevCount / once) === expected && stitchCount(stitches) !== expected) {
        stitches = Array.from({ length: prevCount / once }, () => stitches).flat().slice(0, MAX_STITCHES)
      }
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
        // certains patrons comptent les mailles coulées dans le total (« 2 hdc, 1 sc, 1 ss (4) »)
        valid: expected == null || count === expected || count + stitches.filter((x) => x === 'sl').length === expected,
        // un tour qui finit par une maille coulée peut s'arrêter avant la fin (« 2 hdc, 1 sc, 1 ss », puis arrêter)
        // à plat, laisser des mailles non travaillées en fin de rang est courant (mise en forme)
        fits: prevInSection && stitches.length && !inSpace && !isStructuralOnly(stitches)
          ? consumed === prevCount || ((stitches[stitches.length - 1] === 'sl' || flat) && consumed < prevCount)
          : null,
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
  for (const scanned of scanLines(text)) {
    const { line } = scanned
    const entry = found.get(section) ?? { length: 0, rounds: 0 }
    if (scanned.kind === 'round') {
      entry.rounds++
      found.set(section, entry)
      continue
    }
    if (scanned.kind === 'section') {
      section = scanned.name
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
  for (const scanned of scanLines(text)) {
    if (scanned.kind === 'section') {
      section = scanned.name
      if (!out.has(section)) out.set(section, '')
      continue
    }
    out.set(section, `${out.get(section) ?? ''}${scanned.line}\n`)
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
