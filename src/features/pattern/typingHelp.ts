import type { Round } from '../../domain/types'
import { patternLanguage, type PatternLanguage } from '../../domain/language'

/** Abréviations et formules courantes, par langue, dans l'ordre où on les propose. */
const VOCABULARY: Record<PatternLanguage, string[]> = {
  fra: ['ms', 'aug', 'dim', 'ml', 'mc', 'db', 'br', 'dbr', 'anneau magique', 'dans chaque maille', 'brin arrière', 'brin avant', 'tourner', 'rembourrer'],
  eng: ['sc', 'inc', 'dec', 'ch', 'sl st', 'hdc', 'dc', 'tr', 'magic ring', 'in each stitch', 'back loop only', 'front loop only', 'turn', 'repeat', 'stuff'],
  spa: ['pb', 'aum', 'dism', 'cad', 'pd', 'mpa', 'pa', 'anillo mágico', 'en cada punto', 'rellenar'],
  deu: ['fM', 'zun', 'abn', 'Lm', 'Km', 'hStb', 'Stb', 'Fadenring', 'in jede M', 'füllen'],
  ita: ['mb', 'aum', 'dim', 'cat', 'mbss', 'mma', 'ma', 'anello magico', 'in ogni maglia', 'imbottire'],
  por: ['pb', 'aum', 'dim', 'corr', 'pbx', 'mpa', 'pa', 'anel mágico', 'em cada ponto', 'encher'],
  nld: ['vaste', 'meerd', 'mind', 'losse', 'hv', 'hstk', 'stk', 'magische ring', 'in elke steek', 'vullen'],
}

/** Mot en cours de frappe juste avant le curseur. */
export function wordBefore(text: string, caret: number): { start: number, word: string } {
  const m = text.slice(0, caret).match(/[\p{L}]+$/u)
  return m ? { start: caret - m[0].length, word: m[0] } : { start: caret, word: '' }
}

/** Abréviations qui complètent le mot en cours, dans la langue du patron (sinon celle de l'interface). */
export function suggestions(text: string, word: string, fallback: PatternLanguage): string[] {
  if (!word) return []
  const lang = patternLanguage(text) ?? fallback
  const w = word.toLowerCase()
  return VOCABULARY[lang].filter((v) => v.toLowerCase().startsWith(w) && v.toLowerCase() !== w).slice(0, 5)
}

/** Numéro de la ligne où se trouve le curseur. */
export function lineAt(text: string, caret: number): number {
  return text.slice(0, caret).split('\n').length - 1
}

/**
 * Début du rang suivant, écrit comme le rang précédent de la pièce : « R4 : », « Rnd 4: »,
 * « 4 – » ; null si aucun rang ne précède la ligne.
 */
export function nextRoundPrefix(text: string, line: number, rounds: Round[]): string | null {
  const before = rounds.filter((r) => r.line <= line)
  const last = before[before.length - 1]
  if (!last) return null
  const raw = text.split('\n')[last.line] ?? ''
  const n = last.number + 1
  // « R2-R3 : », « Rnd 2: », « 4 to 7 – »
  const m = raw.match(/^\s*([\p{L}]+\.?)?(\s*)\d+(?:\s*(?:-|à|&|to|and)\s*[\p{L}]*\s*\d+)?(\s*[:.–-]\s*)/u)
  if (!m) return `R${n} : `
  return `${m[1] ?? ''}${m[1] ? m[2] : ''}${n}${m[3]}`
}

/** Ce que l'on complète avec Tab : la première abréviation proposée. */
export function firstSuggestion(text: string, caret: number, fallback: PatternLanguage): { from: number, insert: string } | null {
  const { start, word } = wordBefore(text, caret)
  const [first] = suggestions(text, word, fallback)
  return first ? { from: start, insert: `${first} ` } : null
}
