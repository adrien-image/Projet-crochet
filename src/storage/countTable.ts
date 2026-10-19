// Mise en forme des rangs d'un PDF : rangs coupés sur plusieurs lignes, tableaux de comptes.
import { looksLikeRound } from '../domain/parser'

// suite d'un rang sur la ligne suivante : minuscule, reprise (« Join. », « Rep from * »), mailles…
const CONTINUES_RE = /^(?:(?:join|rep(?:eat)?|work(?:ing)?|sc|hdc|dc|tr|ch|sl|inc|dec|sc2tog|ms|aug|dim|ml|mc|br|db)\b|\d+\s*(?:sc|hdc|dc|tr|sts?|inc|dec|ch|ms|aug|dim|ml|mc|br|db)\b)/i
const MID_PHRASE_RE = /(?:,|\b(?:in|into|of|as|the|a|an|next|each|from|to|with|and|then|first|same|last|around|through|dans|de|la|le|les|et|puis|chaque))\s*$/i
const LOWER_START_RE = /^[a-zà-ÿ(*[]/
const continues = (line: string) => LOWER_START_RE.test(line) || CONTINUES_RE.test(line)
// rang terminé : compte en fin (« (18) », « = 18 sc », « Join. 20 sc. », « 5 sts. »)
const ENDED_RE = /(?:[([]\s*\d+[^)\]]{0,24}[)\]]|=\s*\d+\s*[\p{L}.]*|(?:^|[.;]\s*)(?:join\.?\s*\d+\s*(?:sc|sts?|stitches|dc|hdc|mailles|ms)\.?|\d+\s*(?:sc|sts?|stitches|dc|hdc|mailles|ms)\.))\s*$/iu
const MAX_WRAP = 6

/**
 * Renvois aux photos du patron (« [1]Ch3 … [2]Ch4, [3]Slst … ») : sans eux, « [8] » en fin de rang
 * ne passe pas pour un compte. Seulement quand le patron en est plein (collés aux mailles).
 */
export function stripPhotoRefs(text: string): string {
  if ((text.match(/\[\d{1,2}\](?=\s?[A-Za-z])/g)?.length ?? 0) < 3) return text
  return text.split('\n').map((l) => l.replace(/\s*\[\d{1,2}\]\s*/g, ' ').replace(/ {2,}/g, ' ').trim()).join('\n')
}

/**
 * Rangs coupés par la mise en page (« 2nd rnd: Ch 1. 2 sc in each sc » / « around. Join. 20 sc. ») :
 * la suite est remise sur la ligne du rang, jusqu'au compte final ou au rang suivant.
 */
export function joinWrappedRounds(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    if (looksLikeRound(line)) {
      let n = 0
      while (n < MAX_WRAP && i + 1 < lines.length && !ENDED_RE.test(line)) {
        const next = lines[i + 1].trim()
        if (!next || looksLikeRound(next) || /^note\b/i.test(next)) break
        // la ligne s'arrête au milieu d'une phrase (« … 1 sc in each »), ou la suivante la continue
        // sans mot de reprise, seulement une phrase coupée au milieu (« … 2 hdc in next », « …, »)
        if (!continues(next) && !MID_PHRASE_RE.test(line)) break
        line = `${line.trimEnd()} ${next}`
        i++
        n++
      }
    }
    out.push(line)
  }
  return out.join('\n')
}

// Tableau de comptes (« round # | stitch count », « 1 | 22 sts ») des patrons en diagramme : sans
// instructions écrites, chaque rang est déduit de son compte et de celui du rang précédent.
import { patternLanguage } from '../domain/language'

const HEADER_RE = /\b(?:round|rnd|row|rang|tour)s?\s*(?:#|n[°o]|no\.?)?\s*[|:]?\s*(?:stitch(?:es)?\s*count|sts|count|mailles|nombre)/i
const ROW_RE = /^\s*(\d{1,2})\s*[|:.)]?\s*(\d{1,3})\s*(?:sts?\b|stitch(?:es)?\b|st\.|mailles?\b|ms\b|sc\b|m\b)/i
/** ligne du tableau dont le compte est illisible (« 3| Derround ») */
const LOOSE_ROW_RE = /^\s*(\d{1,2})\s*[|:]/

const WORDS = {
  fra: { sc: 'ms', inc: 'aug', dec: 'dim', title: 'Rangs' },
  eng: { sc: 'sc', inc: 'inc', dec: 'dec', title: 'Rounds' },
}
/** titre de pièce juste au-dessus du tableau (« Bottom », « Fond ») */
const TITLE_RE = /^\p{Lu}[\p{L}' -]{1,30}:?$/u

/** Instruction qui fait passer de `prev` à `next` mailles (augmentations ou diminutions réparties). */
function instruction(prev: number, next: number, w: typeof WORDS.eng): string {
  const d = next - prev
  if (d === 0) return `${next} ${w.sc}`
  if (d > 0 && d <= prev) return prev - d ? `${d} ${w.inc}, ${prev - d} ${w.sc}` : `${d} ${w.inc}`
  if (d < 0 && -2 * d <= prev) return prev + 2 * d ? `${-d} ${w.dec}, ${prev + 2 * d} ${w.sc}` : `${-d} ${w.dec}`
  return `${next} ${w.sc}`
}

/** Remplace chaque tableau de comptes du texte par les rangs correspondants (« R2 : 6 inc, 16 sc (28) »). */
export function countTableRounds(text: string): string {
  const lines = text.split('\n')
  const w = patternLanguage(text) === 'fra' ? WORDS.fra : WORDS.eng
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const header = HEADER_RE.test(lines[i])
    const start = header ? i + 1 : i
    const rows = new Map<number, number | null>()
    let j = start
    for (; j < lines.length; j++) {
      const m = lines[j].match(ROW_RE)
      if (m) {
        rows.set(+m[1], +m[2])
        continue
      }
      const loose = lines[j].match(LOOSE_ROW_RE)
      if (loose && rows.size) {
        rows.set(+loose[1], rows.get(+loose[1]) ?? null)
        continue
      }
      break
    }
    const known = [...rows].filter((r): r is [number, number] => r[1] != null).sort((a, b) => a[0] - b[0])
    const listed = [...rows.keys()].sort((a, b) => a - b)
    // un vrai tableau : au moins trois rangs depuis le rang 1, à la suite (des lignes illisibles peuvent
    // manquer quand l'en-tête l'annonce)
    const consecutive = listed.every((n, k) => n === k + 1)
    if (known.length < 3 || listed[0] !== 1 || (!header && (known.length < 4 || !consecutive))) {
      out.push(lines[i])
      continue
    }
    // comptes illisibles : la progression régulière du tableau (« +6 sts per round »)
    const steps = known.slice(1).map(([n, c], k) => (c - known[k][1]) / (n - known[k][0]))
    const step = steps.every((s) => s === steps[0]) ? steps[0] : null
    const numbers = Array.from({ length: listed[listed.length - 1] }, (_, k) => k + 1)
    const counts = numbers.map((n) => rows.get(n) ?? (step != null ? known[0][1] + step * (n - known[0][0]) : null))
    if (counts.some((c) => c == null || c <= 0)) {
      out.push(lines[i])
      continue
    }
    // sans titre au-dessus (perdu à la lecture), les rangs ne prennent pas celui d'une autre pièce
    if (!TITLE_RE.test((out[out.length - 1] ?? '').trim())) out.push(w.title)
    counts.forEach((c, k) => out.push(`R${k + 1} : ${k === 0 ? `${c} ${w.sc}` : instruction(counts[k - 1]!, c!, w)} (${c})`))
    i = j - 1
  }
  return out.join('\n')
}
