// @ts-check
import { parsePattern, parseOptions } from './patternParser.js'

/** @type {Map<string, import('./patternParser.js').Round[]>} */
const cache = new Map()

/** Rangs d'un patron, mis en cache par texte et options. @param {any} pattern */
export function roundsOf(pattern) {
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

/** Progression combinée : rangs terminés + étapes libres cochées. @param {any} pattern */
export function patternProgress(pattern) {
  const rounds = roundsOf(pattern)
  const done = new Set(pattern.roundsDone)
  const roundsDone = rounds.filter((r) => done.has(r.key)).length
  const stepsDone = pattern.checklist.filter((/** @type {{done: boolean}} */ i) => i.done).length
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
