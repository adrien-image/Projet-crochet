import type { Pattern, Round } from './types'
import { parsePattern, parseOptions } from './parser'

const cache = new Map<string, Round[]>()

type Parsable = Pick<Pattern, 'text'> & Partial<Pick<Pattern, 'notation' | 'size'>>

/** Rangs d'un patron, mis en cache par texte et options (le parseur est appelé à chaque rendu). */
export function roundsOf(pattern: Parsable): Round[] {
  const opts = parseOptions(pattern)
  const key = `${opts.notation}|${opts.size}|${pattern.text}`
  let rounds = cache.get(key)
  if (!rounds) {
    rounds = parsePattern(pattern.text, opts)
    if (cache.size > 50) cache.delete(cache.keys().next().value ?? '')
    cache.set(key, rounds)
  }
  return rounds
}

export interface Progress {
  rounds: { done: number, total: number }
  steps: { done: number, total: number }
  done: number
  total: number
  pct: number
}

/** Progression combinée : rangs terminés + étapes libres cochées. */
export function patternProgress(pattern: Pattern): Progress {
  const rounds = roundsOf(pattern)
  const done = new Set(pattern.roundsDone)
  const roundsDone = rounds.filter((r) => done.has(r.key)).length
  const stepsDone = pattern.checklist.filter((i) => i.done).length
  const total = rounds.length + pattern.checklist.length
  const doneAll = roundsDone + stepsDone
  return {
    rounds: { done: roundsDone, total: rounds.length },
    steps: { done: stepsDone, total: pattern.checklist.length },
    done: doneAll,
    total,
    pct: total ? Math.round((doneAll / total) * 100) : 0,
  }
}

export const percent = (p: { done: number, total: number }) => (p.total ? Math.round((p.done / p.total) * 100) : 0)
