import type { Round } from '../../domain/types'
import { outlineText } from '../../domain/parser'

export interface TextLine {
  line: string
  /** rangs décrits par cette ligne (« R4-R6 » en donne trois), sinon null */
  rounds: Round[] | null
  /** titre de pièce, débarrassé de sa mise en forme */
  title: string | null
}

/** Le texte du patron, ligne par ligne, avec ses rangs et ses titres (aperçu, impression, vérification). */
export function textLines(text: string, rounds: Round[]): TextLine[] {
  const outline = new Map(outlineText(text).map((o) => [o.index, o]))
  const byLine = new Map<number, Round[]>()
  for (const r of rounds) byLine.set(r.line, [...(byLine.get(r.line) ?? []), r])
  return text.split(/\r?\n/).map((line, i) => {
    const o = outline.get(i)
    const title = o?.kind === 'section' ? line.trim().replace(/^#+\s*/, '').replace(/\s*:\s*$/, '').replace(/[#=*_\s]+$/, '') : null
    return { line, rounds: byLine.get(i) ?? null, title }
  })
}
