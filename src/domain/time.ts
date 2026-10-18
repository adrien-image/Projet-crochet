// Chronomètre de travail par patron.
import type { Pattern } from './types'

/** Au-delà, une séance oubliée (chronomètre resté lancé) est plafonnée. */
export const MAX_SESSION = 4 * 3600

export function runningSeconds(p: Pick<Pattern, 'timerStartedAt'>, now = Date.now()): number {
  if (!p.timerStartedAt) return 0
  return Math.min(MAX_SESSION, Math.max(0, Math.round((now - Date.parse(p.timerStartedAt)) / 1000)))
}

export function totalSeconds(p: Pick<Pattern, 'timeSpent' | 'timerStartedAt'>, now = Date.now()): number {
  return p.timeSpent + runningSeconds(p, now)
}

export function startTimer<T extends Pattern>(p: T, now = Date.now()): T {
  return p.timerStartedAt ? p : { ...p, timerStartedAt: new Date(now).toISOString() }
}

export function stopTimer<T extends Pattern>(p: T, now = Date.now()): T {
  if (!p.timerStartedAt) return p
  const seconds = runningSeconds(p, now)
  const sessions = seconds >= 30 ? [...p.sessions, { start: p.timerStartedAt, seconds }].slice(-60) : p.sessions
  return { ...p, timeSpent: p.timeSpent + seconds, timerStartedAt: null, sessions }
}

/** « 2 h 05 », « 12 min », « 45 s » */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}

/** Temps passé sur les 7 derniers jours (séances terminées + séance en cours). */
export function lastWeekSeconds(p: Pattern, now = Date.now()): number {
  const since = now - 7 * 86400 * 1000
  return p.sessions.filter((s) => Date.parse(s.start) >= since).reduce((n, s) => n + s.seconds, 0) + runningSeconds(p, now)
}
