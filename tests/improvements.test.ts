import { test, expect } from 'vitest'
import { normalizePattern } from '../src/storage/patterns'
import { estimateSize, resize, statedSize } from '../src/domain/size'
import { buildPieces, findDetails } from '../src/domain/pieces'
import { estimateYarn } from '../src/domain/yarn'
import { outlineText, parsePattern } from '../src/domain/parser'
import { textLines } from '../src/features/pattern/textLines'
import { buildModel, modelExtent } from '../src/render3d/model'

const ball = 'BALLE\nR1 : 6 ms dans un anneau magique (6)\nR2 : 6 aug (12)\nR3 : *1 ms, aug* x6 (18)\nR4-R6 : 18 ms (18)\nR7 : *1 ms, dim* x6 (12)\nR8 : 6 dim (6)'

test('taille annoncée : cm, mm, pouces, formulations courantes', () => {
  expect(statedSize('Final length: 14cm')).toBe(14)
  expect(statedSize('Approx. size: 10”')).toBe(25.4)
  expect(statedSize('Taille finale : environ 12,5 cm')).toBe(12.5)
  expect(statedSize('hauteur 180 mm')).toBe(18)
  expect(statedSize('Mesure environ 20 cm de haut')).toBe(20)
  expect(statedSize('Crochet 3 mm, fil coton')).toBeNull()
  expect(statedSize('')).toBeNull()
})

test('taille estimée : proportionnelle au crochet, étalonnée par la taille annoncée', () => {
  const small = estimateSize(normalizePattern({ hook: '2 mm', text: ball }))!
  const big = estimateSize(normalizePattern({ hook: '4 mm', text: ball }))!
  expect(small.stated).toBe(false)
  expect(big.dims[0]).toBeCloseTo(small.dims[0] * 2, 0)
  // une balle : à peu près aussi large que haute
  expect(small.dims[2] / small.dims[0]).toBeGreaterThan(0.6)
  const stated = estimateSize(normalizePattern({ hook: '3 mm', description: 'Taille finale : 8 cm', text: ball }))!
  expect(stated.stated).toBe(true)
  expect(stated.dims[0]).toBe(8)
  expect(estimateSize(normalizePattern({ text: 'Rien à crocheter' }))).toBeNull()
})

test('changer de crochet : taille et fil suivent, épaisseur de fil assortie', () => {
  const base = estimateSize(normalizePattern({ hook: '3 mm', description: 'Taille finale : 10 cm', text: ball }))!
  const r = resize(base, 6)
  expect(r.dims[0]).toBe(20)
  expect(r.meters).toBeCloseTo(base.meters * 2)
  expect(r.weight.category).not.toBe(resize(base, 2).weight.category)
})

test('couleur supposée : signalée seulement quand le patron ne la donne pas', () => {
  const stated = buildPieces(normalizePattern({ yarn: 'coton rose', text: ball }))
  expect(stated[0].colorGuessed).toBe(false)
  const twoYarns = normalizePattern({ yarn: 'coton rose et blanc', text: `${ball}\n\nOREILLE\nR1 : 6 ms dans un anneau magique (6)` })
  const pieces = buildPieces(twoYarns)
  expect(pieces.some((p) => p.colorGuessed)).toBe(true)
  // une couleur choisie à la main n'est plus une supposition
  const chosen = buildPieces({ ...twoYarns, pieceColors: Object.fromEntries(pieces.map((p) => [p.label, '#123456'])) })
  expect(chosen.every((p) => !p.colorGuessed)).toBe(true)
  const yarn = estimateYarn({ ...twoYarns, pieceColors: Object.fromEntries(pieces.map((p) => [p.label, '#123456'])) })
  expect(yarn.byColor.every((c) => !c.guessed)).toBe(true)
})

test('lignes du texte : chaque rang garde sa ligne d\'origine, titres repérés', () => {
  const text = 'Petit mot\n\nBALLE\nR1 : 6 ms dans un anneau magique (6)\nR2-R3 : 6 ms (6)\nFermer.'
  const rounds = parsePattern(text)
  expect(rounds.map((r) => r.line)).toEqual([3, 4, 4])
  expect(outlineText(text).find((o) => o.kind === 'section')?.index).toBe(2)
  const lines = textLines(text, rounds)
  expect(lines).toHaveLength(6)
  expect(lines[2].title).toBe('BALLE')
  expect(lines[4].rounds?.map((r) => r.label)).toEqual(['R2', 'R3'])
  expect(lines[5].rounds).toBeNull()
})

test('encombrement du modèle 3D : boîte englobante des pièces placées', () => {
  const pattern = normalizePattern({ text: ball })
  const model = buildModel(buildPieces(pattern), [], findDetails(pattern.text), { assembled: true })
  const { min, max } = modelExtent(model.parts)
  const size = [0, 1, 2].map((k) => max[k] - min[k])
  expect(size.every((s) => s > 0 && Number.isFinite(s))).toBe(true)
})
