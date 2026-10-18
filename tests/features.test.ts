import { test, expect } from 'vitest'
import { estimateYarn, formatMeters, hookMm } from '../src/domain/yarn'
import { formatDuration, lastWeekSeconds, MAX_SESSION, startTimer, stopTimer, totalSeconds } from '../src/domain/time'
import { normalizePattern } from '../src/storage/patterns'
import { decodeShare, encodeShare } from '../src/storage/share'
import { mergeLibraries } from '../src/storage/sync'
import { defaultSettings, needsBackupReminder } from '../src/storage/settings'
import { cleanPdfText } from '../src/storage/pdfText'
import { buildModel, placementKey } from '../src/render3d/model'
import { latheGeometry, panelGeometry } from '../src/render3d/geometry'
import { buildCords, buildPieces, findDetails } from '../src/domain/pieces'
import { samplePattern } from '../src/storage/samples'
import type { Pattern } from '../src/domain/types'

const DAY = 86400e3
const at = (ms: number) => new Date(ms).toISOString()

test('fil : taille de crochet lue, longueur proportionnelle au crochet et aux mailles', () => {
  expect(hookMm('3,5 mm')).toBe(3.5)
  expect(hookMm('crochet 4mm')).toBe(4)
  expect(hookMm('US G')).toBeNull()
  const small = estimateYarn(normalizePattern({ hook: '2 mm', text: 'R1: 6 ms (6)\nR2: 6 aug (12)' }))
  const big = estimateYarn(normalizePattern({ hook: '4 mm', text: 'R1: 6 ms (6)\nR2: 6 aug (12)' }))
  expect(big.meters).toBeCloseTo(small.meters * 2, 5)
  expect(small.assumedHook).toBe(false)
  // 6 ms + 6 aug (×2) = 18 unités × 0,5 cm × 2 mm = 18 cm
  expect(small.meters).toBeCloseTo(0.18, 5)
  const bridesHigher = estimateYarn(normalizePattern({ hook: '2 mm', text: 'R1: 12 br (12)' }))
  expect(bridesHigher.meters).toBeGreaterThan(estimateYarn(normalizePattern({ hook: '2 mm', text: 'R1: 12 ms (12)' })).meters)
  expect(estimateYarn(normalizePattern({ text: 'R1: 6 ms (6)' })).assumedHook).toBe(true)
})

test('fil : répartition par couleur quand le patron change de fil', () => {
  const p = normalizePattern({ hook: '4 mm', yarn: 'beige', text: 'TÊTE\nR1: 6 ms (6)\nR2: 6 aug en rose (12)\nR3: 12 ms (12)' })
  const est = estimateYarn(p)
  expect(est.byColor.length).toBe(2)
  expect(est.byColor.reduce((n, c) => n + c.meters, 0)).toBeCloseTo(est.meters, 5)
  expect(formatMeters(3.2)).toBe('3 m')
  expect(formatMeters(47)).toBe('45 m')
  expect(formatMeters(1530, 'en')).toBe('1.5 km')
})

test('chronomètre : séances cumulées, plafonnées, courtes ignorées', () => {
  const t0 = Date.parse('2026-01-10T10:00:00Z')
  let p = normalizePattern({ name: 'x' })
  p = startTimer(p, t0)
  expect(startTimer(p, t0 + 5000)).toBe(p)
  expect(totalSeconds(p, t0 + 90e3)).toBe(90)
  p = stopTimer(p, t0 + 90e3)
  expect(p.timeSpent).toBe(90)
  expect(p.timerStartedAt).toBeNull()
  expect(p.sessions).toEqual([{ start: at(t0), seconds: 90 }])
  // séance de 10 s : comptée mais pas enregistrée comme séance
  p = stopTimer(startTimer(p, t0 + 100e3), t0 + 110e3)
  expect(p.timeSpent).toBe(100)
  expect(p.sessions.length).toBe(1)
  // chronomètre oublié toute la nuit
  p = stopTimer(startTimer(p, t0), t0 + 12 * 3600e3)
  expect(p.timeSpent).toBe(100 + MAX_SESSION)
  expect(lastWeekSeconds(p, t0 + 8 * DAY)).toBe(0)
  expect(lastWeekSeconds(p, t0 + DAY)).toBe(90 + MAX_SESSION)
  expect(formatDuration(45)).toBe('45 s')
  expect(formatDuration(12 * 60 + 5)).toBe('12 min')
  expect(formatDuration(2 * 3600 + 5 * 60)).toBe('2 h 05')
})

test('normalisation : notes, placements et chronomètre validés', () => {
  const p = normalizePattern({
    roundNotes: { a: { text: 'marqueur', photoId: 'x', photoThumb: 'javascript:alert(1)' }, b: 'nope', c: { text: 'y'.repeat(5000) } },
    placements: { 'OREILLES#0': { point: [1, 2, 3], normal: [0, 1, 0] }, bad: { point: [1, 'a', 3], normal: [0, 1, 0] } },
    timeSpent: -5, timerStartedAt: 'pas une date', sessions: [{ start: '2026-01-01T00:00:00Z', seconds: 60 }, { start: 3 }],
  })
  expect(Object.keys(p.roundNotes).sort()).toEqual(['a', 'c'])
  expect(p.roundNotes.a.photoThumb).toBeNull()
  expect(p.roundNotes.c.text.length).toBe(4000)
  expect(Object.keys(p.placements)).toEqual(['OREILLES#0'])
  expect(p.timeSpent).toBe(0)
  expect(p.timerStartedAt).toBeNull()
  expect(p.sessions).toEqual([{ start: '2026-01-01T00:00:00Z', seconds: 60 }])
})

test('partage : aller-retour par lien, sans progression ni notes', async () => {
  const src: Pattern = { ...samplePattern(), roundsDone: ['x'], roundNotes: { x: { text: 'perso', photoId: null, photoThumb: null } }, timeSpent: 999 }
  const code = await encodeShare(src)
  expect(code).toMatch(/^[zj][A-Za-z0-9_-]+$/)
  // le lien reste raisonnablement court grâce à la compression
  expect(code.length).toBeLessThan(src.text.length)
  const back = await decodeShare(code)
  expect(back.id).not.toBe(src.id)
  expect(back.name).toBe(src.name)
  expect(back.text).toBe(src.text)
  expect(back.roundsDone).toEqual([])
  expect(back.roundNotes).toEqual({})
  expect(back.timeSpent).toBe(0)
  await expect(decodeShare('zAAAA')).rejects.toThrow()
})

test('synchronisation : le plus récent gagne, les suppressions se propagent', () => {
  const mk = (id: string, updatedAt: string, name = id) => normalizePattern({ id, name, updatedAt, createdAt: '2026-01-01T00:00:00Z' })
  const local = [mk('a', '2026-02-01T00:00:00Z', 'a-local'), mk('b', '2026-01-05T00:00:00Z'), mk('c', '2026-01-05T00:00:00Z')]
  const remote = [mk('a', '2026-01-20T00:00:00Z', 'a-remote'), mk('b', '2026-01-10T00:00:00Z', 'b-remote'), mk('d', '2026-01-03T00:00:00Z')]
  const { patterns, deleted, changed } = mergeLibraries(local, remote, {}, { c: '2026-01-06T00:00:00Z' })
  expect(patterns.map((p) => p.name)).toEqual(['a-local', 'b-remote', 'd'])
  expect(deleted.c).toBeDefined()
  expect(changed).toBe(true)
  // un patron modifié après sa suppression ailleurs est conservé
  const kept = mergeLibraries([mk('c', '2026-01-07T00:00:00Z')], [], {}, { c: '2026-01-06T00:00:00Z' })
  expect(kept.patterns.length).toBe(1)
  expect(kept.changed).toBe(false)
})

test('rappel de sauvegarde', () => {
  const now = Date.parse('2026-03-01T00:00:00Z')
  const s = { ...defaultSettings(), firstUseAt: at(now - 3 * DAY) }
  expect(needsBackupReminder(s, at(now - DAY), now)).toBe(false)
  expect(needsBackupReminder({ ...s, firstUseAt: at(now - 10 * DAY) }, at(now - DAY), now)).toBe(true)
  expect(needsBackupReminder({ ...s, firstUseAt: at(now - 10 * DAY) }, null, now)).toBe(false)
  const exported = { ...s, lastExportAt: at(now - 20 * DAY) }
  expect(needsBackupReminder(exported, at(now - DAY), now)).toBe(true)
  expect(needsBackupReminder(exported, at(now - 25 * DAY), now)).toBe(false)
  expect(needsBackupReminder({ ...exported, reminderSnoozedUntil: at(now + DAY) }, at(now - DAY), now)).toBe(false)
})

test('PDF : nettoyage du texte extrait', () => {
  const raw = 'TÊTE\n• R1 : 6 ms dans un an-\nneau magique (6)\nR2 : aug dans chaque\nmaille (12)\n3 / 12\nPage 4\nR3 : *1 ms, aug* x6 (18)\n\n\n\nCORPS'
  expect(cleanPdfText(raw)).toBe('TÊTE\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)\n\nCORPS')
})

test('3D : placement manuel d\'une pièce et symétrique du 2e exemplaire', () => {
  const p = samplePattern()
  const pieces = buildPieces(p)
  const model = (placements = {}) => buildModel(pieces, buildCords(p), findDetails(p.text), { assembled: true, placements })
  const auto = model()
  expect(auto.mainLabel).toBe('MUSEAU + CORPS')
  expect(auto.placeable).toEqual([{ label: 'OREILLES', copies: 2 }])
  const placed = model({ [placementKey('OREILLES', 0)]: { point: [2, 9, 1], normal: [0, 1, 0] } })
  const ears = placed.parts.filter((x) => x.label === 'OREILLES')
  expect(ears.length).toBe(2)
  const [e1, e2] = ears.map((x) => (x.kind === 'lathe' ? x.transform.position : [0, 0, 0]))
  expect(e1[0]).toBeCloseTo(2, 5)
  expect(e2[0]).toBeCloseTo(-2, 5)
  expect(e1[1]).toBeCloseTo(e2[1], 5)
  const autoEars = auto.parts.filter((x) => x.label === 'OREILLES').map((x) => (x.kind === 'lathe' ? x.transform.position : null))
  expect(autoEars[0]).not.toEqual(e1)
})

test('3D : couleurs par rang dans la géométrie', () => {
  const rings = [0, 1, 2].map((i) => ({ r: 1 + i, y: i, count: 6, row: i, color: i === 2 ? '#ff0000' : null, nr: 1, ny: 0 }))
  const mono = latheGeometry(rings.map((r) => ({ ...r, color: null })))
  expect(mono.getAttribute('color')).toBeUndefined()
  const g = latheGeometry(rings, '#ffffff')
  const c = g.getAttribute('color')
  expect(c).toBeDefined()
  const reds = Array.from({ length: c.count }, (_, i) => c.getX(i) > 0.9 && c.getY(i) < 0.1).filter(Boolean).length
  expect(reds).toBeGreaterThan(0)
  expect(reds).toBeLessThan(c.count)
  const panel = panelGeometry([{ w: 6, y: 0, count: 6 }, { w: 6, y: 1, count: 6, color: '#00ff00' }])
  expect(panel.getAttribute('color')).toBeDefined()
})
