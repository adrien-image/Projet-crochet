// Parseur de patrons de crochet : texte libre → liste de rangs structurés.
// Une instruction de rang par ligne ; les lignes de titre définissent la section courante.

// Abréviations de plusieurs lettres (après normalisation : minuscules, sans accents).
const BASE_MAP = {
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
  ch: 'ch', chain: 'ch',
}

// Termes UK : « dc » UK = maille serrée, « tr » UK = bride…
const UK_MAP = {
  ...BASE_MAP,
  dc: 'sc', htr: 'hdc', tr: 'dc', dtr: 'tr', ttr: 'tr',
  dc2tog: 'dec', htr2tog: 'dec', tr2tog: 'dec',
}

// Lettres seules : trop ambiguës dans du texte français (« à », « m »…),
// acceptées seulement en majuscule (notation XVA) ou collées à un nombre (« 6v », « 6 m »).
const SINGLE_MAP = { x: 'sc', v: 'inc', w: 'inc', a: 'dec', m: 'sc', b: 'dc' }

export const STITCH_INFO = {
  sc: { label: 'Maille serrée', abbr: 'ms / sc / X' },
  hdc: { label: 'Demi-bride', abbr: 'db / hdc' },
  dc: { label: 'Bride', abbr: 'br / dc' },
  tr: { label: 'Double bride', abbr: 'dbr / tr' },
  sl: { label: 'Maille coulée', abbr: 'mc / sl st' },
  inc: { label: 'Augmentation', abbr: 'aug / inc / V' },
  dec: { label: 'Diminution', abbr: 'dim / dec / A' },
  ch: { label: 'Maille en l’air (chaînette)', abbr: 'ml / ch' },
}

// Mailles « de structure » : chaînette de départ, maille coulée de jonction.
// Elles ne comptent que si le rang n'est composé que d'elles.
const STRUCTURAL = new Set(['ch', 'sl'])
const STITCH_WEIGHT = { inc: 2 } // mailles produites (1 par défaut)
const STITCH_CONSUME = { dec: 2 } // mailles du rang précédent consommées (1 par défaut)

function isStructuralOnly(stitches) {
  return stitches.length > 0 && stitches.every((s) => STRUCTURAL.has(s))
}

export function stitchCount(stitches) {
  const structuralOnly = isStructuralOnly(stitches)
  let sum = 0
  for (const s of stitches) {
    if (STRUCTURAL.has(s) && !structuralOnly) continue
    sum += STITCH_WEIGHT[s] ?? 1
  }
  return sum
}

export function stitchConsumed(stitches, structuralOnly = isStructuralOnly(stitches)) {
  let sum = 0
  for (const s of stitches) {
    if (s === 'ch') continue
    if (s === 'sl' && !structuralOnly) continue
    sum += STITCH_CONSUME[s] ?? 1
  }
  return sum
}

function normalizeWord(w) {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function lookup(word, map) {
  if (map[word]) return map[word]
  // pluriels : « augs », « dims », « incs »…
  if (word.length > 2 && word.endsWith('s') && map[word.slice(0, -1)]) return map[word.slice(0, -1)]
  return null
}

// Remplace les formes longues par leur abréviation avant la tokenisation.
const PHRASES = [
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
  // « 2 ms dans la même maille » = une augmentation
  [/\b2\s*(?:ms|sc|SC)\s+(?=(?:dans|in|into)\s+(?:chaque|each)\b)/gi, 'aug '],
  [/\b2\s*(?:ms|sc|SC)\s+(?:dans|in|into)\s+(?:la\s+m[eê]me(?:\s+maille)?|the\s+same\s+st(?:itch)?|same\s+st(?:itch)?|next\s+st(?:itch)?|la\s+maille\s+suivante)\b/gi, 'aug'],
]

function preprocess(str, notation) {
  // En termes UK, la maille serrée s'écrit « dc » : on la ramène à « SC » pour les règles ci-dessous.
  let s = notation === 'uk' ? str.replace(/\bdc\b(?!2)/gi, 'SC') : str
  for (const [re, rep] of PHRASES) s = s.replace(re, rep)
  return s
}

function parseTokens(str, out, map) {
  const tokRe = /(\d+)?(\s*)([A-Za-zÀ-ÿ][A-Za-z0-9À-ÿ]*)/g
  let m
  while ((m = tokRe.exec(str))) {
    const raw = m[3]
    const word = normalizeWord(raw)
    let type = null
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
      count = Math.min(count * parseInt(mult[1] || mult[2] || mult[3], 10), 500)
      tokRe.lastIndex += mult[0].length
    }
    for (let i = 0; i < count; i++) out.push(type)
  }
}

const OPENERS = { '*': '*', '(': ')', '[': ']' }
const MULT_RE = /^\s*,?\s*(?:(?:x|×)\s*(\d+)|(\d+)\s*(?:x|×|fois|times)(?![a-z])|(?:r[ée]p[ée]ter|repeat|rep)\s+(\d+)\s*(?:fois|times|x)?)/i

function findGroup(str, from) {
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
function expandSegment(str, out, map, depth = 0) {
  if (depth > 8) return
  let rest = str
  let g
  while ((g = findGroup(rest, 0))) {
    if (g.start > 0) parseTokens(rest.slice(0, g.start), out, map)
    let after = rest.slice(g.end + 1)
    const mm = after.match(MULT_RE)
    const n = mm ? Math.min(parseInt(mm[1] || mm[2] || mm[3], 10), 200) : 1
    if (mm) after = after.slice(mm[0].length)
    for (let i = 0; i < n; i++) expandSegment(g.inner, out, map, depth + 1)
    rest = after
  }
  if (rest) parseTokens(rest, out, map)
}

// Découpe sur les virgules de premier niveau (hors *…*, (…), […]).
function splitTopLevel(str) {
  const parts = []
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
  `^\\s*[-•·]?\\s*${ROUND_WORD}\\.?\\s*(\\d+)` +
  `(?:\\s*(?:[-–—]|à|to|au)\\s*(?:${ROUND_WORD}\\.?\\s*)?(\\d+))?` +
  '\\s*[:.)]?\\s*(.+)$',
  'i',
)
const COUNT_RE = /(?:[([]\s*(\d+)\s*(?:m(?:ailles)?|ms|sts?|stitches)?\.?\s*[)\]]|[=→]\s*(\d+)\s*(?:m(?:ailles)?|ms|sts?|stitches)?)\s*[.;]?\s*$/i
const EACH_STITCH_RE = /(?:(?:\b(?:dans|sur)|(?:^|\s)[àa])\s+(?:chaque|toutes\s+les)\s+(?:mailles?|points?|m)\b(?:\s+(?:suivantes?|du\s+tour|du\s+rang|autour))?|\btout\s+(?:le\s+)?(?:tour|autour)\b|\bautour\b|\b(?:in|into)\s+(?:each|every)\s+(?:st(?:itch)?|sp|sc)\b(?:\s+(?:around|across))?|\b(?:all\s+)?around\b|\bacross\b)/i
const SECTION_STOPWORDS = /^(?:notes?|mat[ée]riel|fournitures|abr[ée]viations?|l[ée]gende|astuces?|conseils?|remarques?|materials?|supplies|abbreviations?|tips?|gauge|[ée]chantillon|taille|size)\b/i

/** Détecte la notation employée par un texte : 'uk' si termes britanniques, sinon 'us'. */
export function detectNotation(text) {
  if (!text) return 'us'
  if (/\b(?:uk\s+terms?|termes?\s+(?:uk|anglais|britanniques?)|british\s+terms?)\b/i.test(text)) return 'uk'
  if (/\bhtr\b/i.test(text)) return 'uk'
  return 'us'
}

function sectionName(line) {
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
export function sectionCopies(section) {
  const m = section?.match(/(?:^|[\s(])[x×]\s*(\d)(?!\w)|\((\d)\s*(?:pi[eè]ces?|exemplaires?|pieces?)\)/i)
  const n = m ? parseInt(m[1] || m[2], 10) : 1
  return Math.max(1, Math.min(n, 6))
}

function slug(s) {
  return normalizeWord((s || '').replace(/\s+/g, '-')).slice(0, 24) || 'patron'
}

function parseInstruction(instruction, prevCount, expected, map) {
  const each = instruction.match(EACH_STITCH_RE)
  if (!each) {
    const stitches = []
    expandSegment(instruction, stitches, map)
    return stitches
  }
  // « X dans chaque maille » : l'unité (dernière clause avant l'expression) est répétée
  // pour couvrir le rang précédent.
  const before = splitTopLevel(instruction.slice(0, each.index))
  const unitStr = before.pop()
  const prefix = []
  for (const part of before) expandSegment(part, prefix, map)
  const unit = []
  expandSegment(unitStr, unit, map)
  const suffix = []
  expandSegment(instruction.slice(each.index + each[0].length), suffix, map)
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
 * @returns {{ key, label, number, section, stitches, count, consumed, prevCount, expected, valid, fits }[]}
 *   valid : le compte calculé correspond au compte attendu « (N) » (ou pas de compte indiqué)
 *   fits  : les mailles consommées correspondent au rang précédent de la même pièce (null si inconnu)
 */
export function parsePattern(text, options = {}) {
  if (!text) return []
  const notation = options.notation && options.notation !== 'auto' ? options.notation : detectNotation(text)
  const map = notation === 'uk' ? UK_MAP : BASE_MAP
  const rounds = []
  const keys = new Map()
  let section = null
  let prevInSection = null

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const rm = line.match(ROUND_RE)
    if (!rm) {
      const sec = sectionName(line)
      if (sec) {
        section = sec
        prevInSection = null
      }
      continue
    }

    let instruction = rm[3]
    let expected = null
    const cm = instruction.match(COUNT_RE)
    if (cm) {
      expected = parseInt(cm[1] || cm[2], 10)
      instruction = instruction.slice(0, cm.index)
    }
    instruction = preprocess(instruction, notation)

    const from = parseInt(rm[1], 10)
    let to = rm[2] != null ? parseInt(rm[2], 10) : from
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
      const round = {
        key,
        label,
        number: r,
        section,
        stitches,
        count,
        consumed,
        prevCount: prevInSection ? prevCount : null,
        expected,
        valid: expected == null || count === expected,
        fits: prevInSection && stitches.length && !isStructuralOnly(stitches) ? consumed === prevCount : null,
      }
      rounds.push(round)
      prevInSection = round
    }
  }
  return rounds
}

/** Résumé utile pour l'interface : nombre de rangs, de pièces et d'anomalies. */
export function patternStats(rounds) {
  const sections = new Set(rounds.map((r) => r.section ?? ''))
  return {
    rounds: rounds.length,
    sections: sections.size,
    invalid: rounds.filter((r) => !r.valid).length,
    misfit: rounds.filter((r) => r.fits === false).length,
  }
}
