const STITCH_MAP = {
  ms: 'sc', m: 'sc',
  bs: 'dc', b: 'dc',
  mc: 'sl',
  aug: 'inc', augmentation: 'inc',
  dim: 'dec', diminution: 'dec',
  ml: 'ch',
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
  const tokRe = /(\d+)\s*([a-zA-ZÀ-ÿ]+)|([a-zA-ZÀ-ÿ]+)/g
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

const ROUND_RE = /^\s*(?:r(?:ang|ond)?|tour|row|rnd)\.?\s*(\d+(?:\s*[-–]\s*r?\s*\d+)?)\s*[:.]\s*(.+)$/i
const SECTION_RE = /^\s*([A-ZÀ-Ý][A-ZÀ-Ýa-zà-ÿ0-9 '’()x×\-]{2,})\s*:?\s*$/
const COUNT_RE = /\((\d+)\)\s*$/

const STITCH_WEIGHT = { sc: 1, dc: 1, sl: 1, ch: 1, inc: 2, dec: 1 }

const EACH_STITCH_RE = /\bdans chaque (?:maille|point)\b/i

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
    const sec = line.match(SECTION_RE)
    if (sec && !ROUND_RE.test(line)) {
      section = sec[1].trim()
      continue
    }
    const m = line.match(ROUND_RE)
    if (!m) continue
    let instruction = m[2]
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
      const reps = prevCount > 0 ? prevCount : (expected != null && unitCount > 0 ? Math.round(expected / unitCount) : 0)
      stitches.length = 0
      for (let i = 0; i < reps; i++) stitches.push(...unit)
    } else {
      expandSegment(instruction, stitches)
    }
    const count = stitchCount(stitches)

    const rangeMatch = m[1].match(/^(\d+)\s*[-–]\s*r?\s*(\d+)$/i)
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
      label: `R${m[1].replace(/\s*[-–]\s*r?\s*/i, '-')}`,
      section,
      stitches,
      expected,
      valid: expected == null || count === expected,
    })
  }
  return rounds
}
