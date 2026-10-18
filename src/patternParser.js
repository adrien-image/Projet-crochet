const STITCH_MAP = {
  // FR
  ms: 'sc', m: 'sc',
  bs: 'dc', b: 'dc',
  mc: 'sl',
  aug: 'inc', augmentation: 'inc',
  dim: 'dec', diminution: 'dec',
  ml: 'ch', maille: 'ch',
  // US/UK
  sc: 'sc',
  dc: 'dc', tr: 'dc', hdc: 'dc',
  slst: 'sl', ss: 'sl',
  inc: 'inc', increase: 'inc',
  dec: 'dec', decrease: 'dec', sc2tog: 'dec', dc2tog: 'dec',
  ch: 'ch',
  // XVA (notation asiatique)
  x: 'sc',
  v: 'inc',
  a: 'dec',
  w: 'inc',
  //multiplication implicite
}

export const STITCH_INFO = {
  sc: { label: 'Maille serrée', symbol: '✕' },
  dc: { label: 'Bride simple', symbol: 'T' },
  sl: { label: 'Maille coulée', symbol: '·' },
  inc: { label: 'Augmentation', symbol: 'V' },
  dec: { label: 'Diminution', symbol: '∧' },
  ch: { label: 'Maille en l’air (chaîne)', symbol: '○' },
}

function normalizeWord(w) {
  return w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '')
}

function parseTokens(str, out) {
  const tokRe = /(\d+)\s*([a-zA-Z\u00c0-\u00ff]+)|([a-zA-Z\u00c0-\u00ff]+)/g
  let m
  while ((m = tokRe.exec(str))) {
    const word = normalizeWord(m[2] || m[3])
    const type = STITCH_MAP[word]
    if (!type) continue
    const count = m[1] ? parseInt(m[1], 10) : 1
    for (let i = 0; i < count; i++) out.push(type)
  }
}

function expandSegment(str, out) {
  const repeatRe = /\*([^*]+)\*(?:\s*(?:x|×)\s*(\d+))?/i
  let rest = str
  let m
  while ((m = repeatRe.exec(rest))) {
    if (m.index > 0) parseTokens(rest.slice(0, m.index), out)
    const n = m[2] ? parseInt(m[2], 10) : 1
    for (let i = 0; i < n; i++) expandSegment(m[1], out)
    rest = rest.slice(m.index + m[0].length)
  }
  if (rest) parseTokens(rest, out)
}

const ROUND_RE = /^\s*(?:r(?:ang|ond)?\.?|rnd\.?|row\.?|tour\.?)\s*(\d+(?:\s*[-–]\s*(?:r(?:nd|ang|ond)?\.?\s*)?\d+)?)\s*[:.)]?\s*(.+)$/i
const SECTION_RE = /^\s*([A-Z\u00c0-\u00dd][^\n:]{2,60})\s*$/
const COUNT_RE = /\((\d+)\)\s*$/

const STITCH_WEIGHT = { sc: 1, dc: 1, sl: 1, ch: 1, inc: 2, dec: 1 }
const STITCH_CONSUME = { sc: 1, dc: 1, sl: 1, ch: 1, inc: 1, dec: 2 }

const EACH_STITCH_RE = /\b(?:dans chaque (?:maille|point|st)|in each (?:st(?:itch)?|sp))(?:\s*(?:autour|around))?\b/i

export function stitchCount(stitches) {
  return stitches.reduce((sum, s) => sum + (STITCH_WEIGHT[s] ?? 1), 0)
}

export function parsePattern(text) {
  if (!text) return []
  const rounds = []
  let section = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const rm = line.match(ROUND_RE)
    if (rm) {
      let instruction = rm[2]
      let expected = null
      const cm = instruction.match(COUNT_RE)
      if (cm) {
        expected = parseInt(cm[1], 10)
        instruction = instruction.slice(0, cm.index)
      }
      const stitches = []
      const eachMatch = instruction.match(EACH_STITCH_RE)
      const prev = rounds.length ? rounds[rounds.length - 1] : null
      const prevCount = prev ? stitchCount(prev.stitches) : 0
      if (eachMatch) {
        const base = instruction.slice(0, eachMatch.index)
        expandSegment(base, stitches)
        const unit = [...stitches]
        const unitCount = stitchCount(unit)
        const consumedPerUnit = unit.reduce((s, t) => s + (STITCH_CONSUME[t] ?? 1), 0)
        const target = prevCount > 0 ? prevCount : (expected != null ? expected : 0)
        const reps = consumedPerUnit > 0 ? Math.round(target / consumedPerUnit) : 0
        stitches.length = 0
        for (let i = 0; i < reps; i++) stitches.push(...unit)
      } else {
        expandSegment(instruction, stitches)
      }
      const count = stitchCount(stitches)

      const rangeMatch = rm[1].match(/^(\d+)\s*[-–]\s*(?:r(?:nd|ang|ond)?\.?\s*)?(\d+)$/i)
      if (rangeMatch) {
        const from = parseInt(rangeMatch[1], 10)
        const to = parseInt(rangeMatch[2], 10)
        if (to >= from && to - from < 50) {
          for (let r = from; r <= to; r++) {
            rounds.push({
              label: `R${r}`,
              section,
              stitches,
              expected,
              valid: expected == null || count === expected,
            })
          }
          continue
        }
      }
      rounds.push({
        label: `R${rm[1].replace(/\s*[-–]\s*(?:r(?:nd|ang|ond)?\.?\s*)?/i, '-')}`,
        section,
        stitches,
        expected,
        valid: expected == null || count === expected,
      })
      continue
    }
    const sec = line.match(SECTION_RE)
    if (sec && !/^\d/.test(line)) {
      section = sec[1].trim()
    }
  }
  return rounds
}
