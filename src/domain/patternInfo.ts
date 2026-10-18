// Nom, crochet et fil devinés à partir du texte d'un patron (PDF importé), pour pré-remplir le formulaire.
import { looksLikeRound } from './parser'
import { hookMm } from './yarn'

export interface PatternInfo {
  name: string | null
  hook: string | null
  yarn: string | null
}

// « Materials: … », « Material » seul (le fil à la ligne suivante), « Référence des pelotes »
const YARN_LINE_RE = /^(?:materials?|mat[ée]riel(?:s)?|fournitures|yarns?(?:\s+used)?|fils?|laines?|r[ée]f[ée]rences?\s+des\s+pelotes|pelotes)\s*(?::\s*(.*)|$)/i
const NOT_A_NAME_RE = /^(?:crochet\s+pattern|patron|pattern|free\s+pattern|amigurumi|by\b|par\b|design)/i

export function guessPatternInfo(text: string): PatternInfo {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  // le titre : première ligne courte qui n'est ni un rang ni une mention générique
  const name = lines.slice(0, 5).find((l) => l.length >= 3 && l.length <= 60 && !looksLikeRound(l) && !NOT_A_NAME_RE.test(l) && !/[:@]/.test(l)) ?? null

  // même lecture que l'estimation du fil ; « Crochet hook C-2/2.75 ⏎ mm » coupé en fin de ligne
  const mm = hookMm(text.replace(/\s+/g, ' '))
  const hook = mm ? `${String(mm).replace('.', ',')} mm` : null

  let yarn: string | null = null
  for (let i = 0; i < lines.length && !yarn; i++) {
    const m = lines[i].match(YARN_LINE_RE)
    if (!m) continue
    // le fil sur la ligne suivante, éventuellement coupé en deux (« Circulo yarns - Amigurumi ⏎ Pelucia »)
    const next = lines[i + 2] && /^\p{L}[\p{L}\s'’-]{0,20}$/u.test(lines[i + 2]) ? ` ${lines[i + 2]}` : ''
    const content = (m[1] || (lines[i + 1] ? lines[i + 1] + next : ''))
      .replace(/\s*:\s*$/, '')
      // le crochet et le rembourrage ne font pas partie du fil
      .split(/,\s*(?=\d+(?:[.,]\d+)?\s*mm|crochet|hook|fiberfill|stuffing|rembourrage|ouate)/i)[0]
      .trim()
    if (content) yarn = content.length > 90 ? `${content.slice(0, 87)}…` : content
  }
  return { name, hook, yarn }
}
