import { test, expect } from 'vitest'
import { buildModel, latheProfile, orient, pieceKind, type Part } from '../src/render3d/model'
import { buildCords, buildPieces, findDetails } from '../src/domain/pieces'
import { parsePattern } from '../src/domain/parser'
import { normalizePattern } from '../src/storage/patterns'
import { samplePattern, heartPattern } from '../src/storage/samples'
import type { Pattern } from '../src/domain/types'

const model = (p: Pattern, assembled = true) => buildModel(buildPieces(p), buildCords(p), findDetails(p.text), { assembled })
const labels = (parts: Part[]) => parts.map((x) => `${x.kind}:${x.label}`)

test('profil : 6 augmentations par rang donnent un disque presque plat, un tube reste droit', () => {
  const disc = latheProfile(parsePattern('R1: 6 sc\nR2: inc around (12)\nR3: (sc, inc) x6 (18)\nR4: (2 sc, inc) x6 (24)'), { stuffed: false, closeStart: false, closeEnd: false })
  const tube = latheProfile(parsePattern('R1: 24 sc\nR2: 24 sc\nR3: 24 sc\nR4: 24 sc'), { stuffed: false, closeStart: false, closeEnd: false })
  const height = (r: { y: number }[]) => r[r.length - 1].y - r[0].y
  expect(height(disc)).toBeLessThan(height(tube) / 2)
  // rayon = circonférence / 2π
  expect(tube[0].r).toBeCloseTo(24 / (2 * Math.PI), 1)
})

test('orientation : l\'axe local +Y est envoyé sur la direction voulue', () => {
  // rotation Euler XYZ appliquée à (0, 1, 0)
  const apply = ([x, y, z]: number[], [a, b, c]: number[]) => {
    const rz = [x * Math.cos(c) - y * Math.sin(c), x * Math.sin(c) + y * Math.cos(c), z]
    const ry = [rz[0] * Math.cos(b) + rz[2] * Math.sin(b), rz[1], -rz[0] * Math.sin(b) + rz[2] * Math.cos(b)]
    return [ry[0], ry[1] * Math.cos(a) - ry[2] * Math.sin(a), ry[1] * Math.sin(a) + ry[2] * Math.cos(a)]
  }
  for (const n of [[1, 0, 0], [0, -1, 0], [0.3, 0.8, -0.5]]) {
    const len = Math.hypot(...n)
    const out = apply([0, 1, 0], orient(n as [number, number, number], [0, 0, 1]))
    out.forEach((v, i) => expect(v).toBeCloseTo(n[i] / len, 5))
  }
})

test('souris assemblée : corps, deux oreilles, queue, yeux et nez', () => {
  const m = model(samplePattern())
  expect(labels(m.parts)).toEqual([
    'lathe:MUSEAU + CORPS', 'lathe:OREILLES', 'lathe:OREILLES', 'cord:QUEUE', 'bead:Yeux', 'bead:Yeux', 'bead:Nez',
  ])
  const nose = m.parts.find((p) => p.label === 'Nez')
  expect(nose?.kind === 'bead' && nose.color).toBe('#e99aae') // « nez rose »
  const body = m.parts[0]
  expect(body.kind === 'lathe' && body.color).toBe('#9b9a9c') // fil gris
})

test('cœur : les lobes sont posés sur le corps retourné', () => {
  const m = model(heartPattern())
  expect(labels(m.parts)).toEqual(['lathe:CORPS DU CŒUR', 'lathe:LOBE GAUCHE', 'lathe:LOBE DROIT'])
  const [body, left, right] = m.parts
  expect(body.kind === 'lathe' && body.transform.rotation[0]).toBeCloseTo(Math.PI)
  if (left.kind !== 'lathe' || right.kind !== 'lathe') throw new Error('lobes')
  expect(left.transform.position[1]).toBeGreaterThan(0)
  expect(left.transform.position[0]).toBeLessThan(0)
  expect(right.transform.position[0]).toBeGreaterThan(0)
})

test('ourson : la tête se pose sur le corps, les membres autour', () => {
  const bear = normalizePattern({
    yarn: 'marron',
    text: 'TÊTE\nR1 : 6 ms (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)\nR4-R8 : 18 ms\nR9 : *1 ms, dim* x6 (12)\nR10 : dim dans chaque maille (6)\n'
      + 'CORPS\nR1 : 6 ms (6)\nR2 : aug dans chaque maille (12)\nR3-R6 : 12 ms\n'
      + 'BRAS (x2)\nR1 : 6 ms (6)\nR2-R4 : 6 ms\nJAMBES (x2)\nR1 : 6 ms (6)\nR2-R3 : 6 ms\nOREILLES (x2)\nR1 : 6 ms (6)\nR2 : 6 ms',
  })
  const m = model(bear)
  expect(labels(m.parts).slice(0, 2)).toEqual(['lathe:CORPS', 'lathe:TÊTE'])
  expect(m.parts.filter((p) => p.label === 'BRAS')).toHaveLength(2)
  expect(m.parts.filter((p) => p.label === 'JAMBES')).toHaveLength(2)
  const head = m.parts[1]
  const legs = m.parts.filter((p) => p.label === 'JAMBES')
  if (head.kind !== 'lathe') throw new Error('tête')
  for (const leg of legs) if (leg.kind === 'lathe') expect(leg.transform.position[1]).toBeLessThan(head.transform.position[1])
})

test('pièces séparées, panneau à plat et construction partielle', () => {
  expect(model(samplePattern(), false).parts.filter((p) => p.kind === 'lathe')).toHaveLength(3)
  const scarf = normalizePattern({ text: 'Row 1: 20 sc, turn (20)\nRows 2-8: sc across, turn (20)' })
  expect(model(scarf).parts.map((p) => p.kind)).toEqual(['panel'])
  const p = samplePattern()
  const partial = buildModel(buildPieces(p), buildCords(p), findDetails(p.text), { assembled: true, upTo: 5 })
  expect(partial.parts).toHaveLength(1)
  const only = partial.parts[0]
  expect(only.kind === 'lathe' && only.open).toBe(true) // pièce commencée : encore ouverte
})

test('type de pièce d\'après son nom', () => {
  expect(pieceKind('OREILLES')).toBe('ear')
  expect(pieceKind('MUSEAU + CORPS')).toBe('body')
  expect(pieceKind('Pattes arrière')).toBe('leg')
  expect(pieceKind('Bras')).toBe('arm')
  expect(pieceKind('Écharpe')).toBe('other')
})
