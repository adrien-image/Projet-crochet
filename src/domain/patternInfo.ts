// Nom, crochet et fil devinés à partir du texte d'un patron (PDF importé), pour pré-remplir le formulaire.
import { looksLikeRound } from './parser'

export interface PatternInfo {
  name: string | null
  hook: string | null
  yarn: string | null
}

const HOOK_RES = [
  /(\d+(?:[.,]\d+)?)\s*mm\s+(?:crochet\s+)?hook/i,
  /\bhook(?:\s+size)?(?:\s+used)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*mm/i,
  /\bcrochet(?:\s+de)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*mm/i,
  /\b(?:aiguille|crochet)\s+n°?\s*(\d+(?:[.,]\d+)?)/i,
]
const YARN_LINE_RE = /^(?:materials?|mat[ée]riel(?:s)?|fournitures|yarns?|fils?|laines?)\s*:\s*(.*)$/i
const NOT_A_NAME_RE = /^(?:crochet\s+pattern|patron|pattern|free\s+pattern|amigurumi|by\b|par\b|design)/i

export function guessPatternInfo(text: string): PatternInfo {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  // le titre : première ligne courte qui n'est ni un rang ni une mention générique
  const name = lines.slice(0, 5).find((l) => l.length >= 3 && l.length <= 60 && !looksLikeRound(l) && !NOT_A_NAME_RE.test(l) && !/[:@]/.test(l)) ?? null

  let hook: string | null = null
  for (const re of HOOK_RES) {
    const m = text.match(re)
    if (m) {
      hook = `${m[1].replace('.', ',')} mm`
      break
    }
  }

  let yarn: string | null = null
  for (let i = 0; i < lines.length && !yarn; i++) {
    const m = lines[i].match(YARN_LINE_RE)
    if (!m) continue
    const content = (m[1] || lines[i + 1] || '')
      // le crochet et le rembourrage ne font pas partie du fil
      .split(/,\s*(?=\d+(?:[.,]\d+)?\s*mm|crochet|hook|fiberfill|stuffing|rembourrage|ouate)/i)[0]
      .trim()
    if (content) yarn = content.length > 90 ? `${content.slice(0, 87)}…` : content
  }
  return { name, hook, yarn }
}
