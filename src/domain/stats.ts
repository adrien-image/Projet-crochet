// Statistiques de la bibliothèque : temps passé, rythme, fil utilisé.
import type { Pattern } from './types'
import { parsePattern, parseOptions } from './parser'
import { estimateYarn } from './yarn'
import { runningSeconds, totalSeconds } from './time'

export interface PatternStats {
  id: string
  name: string
  seconds: number
  roundsDone: number
  rounds: number
  /** rangs terminés par heure de chronomètre (null : trop peu de temps compté) */
  perHour: number | null
  /** fil des rangs terminés (m), et du patron entier */
  metersUsed: number
  meters: number
}

export interface WeekStats {
  /** lundi de la semaine (AAAA-MM-JJ) */
  week: string
  seconds: number
  rounds: number
  meters: number
}

export interface LibraryStats {
  seconds: number
  roundsDone: number
  finished: number
  inProgress: number
  metersUsed: number
  patterns: PatternStats[]
  /** dernières semaines, de la plus ancienne à la plus récente */
  weeks: WeekStats[]
}

const DAY = 86400 * 1000

/** Lundi (heure locale) de la semaine d'une date. */
function monday(t: number): Date {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function libraryStats(patterns: Pattern[], now = Date.now(), weekCount = 12): LibraryStats {
  const first = monday(now)
  first.setDate(first.getDate() - 7 * (weekCount - 1))
  const weeks: WeekStats[] = Array.from({ length: weekCount }, (_, i) => {
    const d = new Date(first)
    d.setDate(d.getDate() + 7 * i)
    return { week: isoDay(d), seconds: 0, rounds: 0, meters: 0 }
  })
  const weekOf = (t: number) => {
    const i = Math.floor((monday(t).getTime() - first.getTime() + DAY / 2) / (7 * DAY))
    return i >= 0 && i < weekCount ? weeks[i] : null
  }

  const stats = patterns.map((p): PatternStats => {
    const rounds = parsePattern(p.text, parseOptions(p))
    const done = new Set(p.roundsDone)
    const finished = rounds.filter((r) => done.has(r.key))
    const meters = estimateYarn(p).meters
    // le fil d'un rang : sa part des mailles du patron
    const stitches = rounds.reduce((n, r) => n + r.count, 0) || 1
    const metersOf = (count: number) => (meters * count) / stitches
    const seconds = totalSeconds(p, now)
    for (const s of p.sessions) {
      const w = weekOf(Date.parse(s.start))
      if (w) w.seconds += s.seconds
    }
    const running = runningSeconds(p, now)
    if (running) weekOf(now)!.seconds += running
    for (const r of finished) {
      const at = p.roundsDoneAt?.[r.key]
      const w = at ? weekOf(Date.parse(at)) : null
      if (!w) continue
      w.rounds++
      w.meters += metersOf(r.count)
    }
    return {
      id: p.id,
      name: p.name,
      seconds,
      roundsDone: finished.length,
      rounds: rounds.length,
      perHour: seconds >= 600 && finished.length ? finished.length / (seconds / 3600) : null,
      metersUsed: metersOf(finished.reduce((n, r) => n + r.count, 0)),
      meters,
    }
  })
  return {
    seconds: stats.reduce((n, s) => n + s.seconds, 0),
    roundsDone: stats.reduce((n, s) => n + s.roundsDone, 0),
    finished: stats.filter((s) => s.rounds > 0 && s.roundsDone === s.rounds).length,
    inProgress: stats.filter((s) => s.roundsDone > 0 && s.roundsDone < s.rounds).length,
    metersUsed: stats.reduce((n, s) => n + s.metersUsed, 0),
    patterns: stats.sort((a, b) => b.seconds - a.seconds || b.roundsDone - a.roundsDone),
    weeks,
  }
}
