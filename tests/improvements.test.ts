import { test, expect } from 'vitest'
import { normalizePattern } from '../src/storage/patterns'
import { estimateSize, resize, statedSize } from '../src/domain/size'
import { buildPieces, findDetails } from '../src/domain/pieces'
import { estimateYarn } from '../src/domain/yarn'
import { outlineText, parsePattern } from '../src/domain/parser'
import { textLines } from '../src/features/pattern/textLines'
import { buildModel, modelExtent } from '../src/render3d/model'
import { patternLanguage } from '../src/domain/language'
import { cleanOcrLine, ocrLabels, pageLayout, piecesToText, readingBlocks, type TextPiece } from '../src/storage/pdfText'
import { findOnPages, occurrenceOf } from '../src/features/pattern/pageMatch'

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

test('OCR : erreurs de lecture courantes corrigées', () => {
  expect(cleanOcrLine('R3: | aug, 6% ma, I aug, ch l, tourne (%8)')).toBe('R3: 1 aug, 64 ms, 1 aug, ch 1, tourne (48)')
  expect(cleanOcrLine('4to7—18sc(4rows)')).toBe('4 to 7 – 18 sc (4 rows)')
  expect(cleanOcrLine('2 —6 inc (12)')).toBe('2 – 6 inc (12)')
  expect(cleanOcrLine('21-24sc')).toBe('21 – 24 sc')
  expect(cleanOcrLine('1 – 6 scintoa magicring(6)')).toBe('1 – 6 sc into a magic ring (6)')
  expect(cleanOcrLine('o R12 : 1 aug, % ms (8)')).toBe('R12 : 1 aug, 4 ms (8)')
  expect(cleanOcrLine('© RI-6 : 32 ms')).toBe('R1-6 : 32 ms')
  // le texte courant n'est pas touché
  expect(cleanOcrLine('I like this pattern, 4-6 hours of work')).toBe('I like this pattern, 4-6 hours of work')
})

test('OCR : numéros de rang illisibles déduits du rang précédent', () => {
  const labels = ocrLabels()
  expect(['Ri : ch 2, 1 aug', ': 2 aug, ch 1', 'RS : 1 aug, 2 ms', 'R4 : 1 aug, 4 ms', '| : 1 aug, 6 ms', 'Coupe le fil :', 'RIO : 1 aug, 8 ms'].map(labels))
    .toEqual(['R1 : ch 2, 1 aug', 'R2 : 2 aug, ch 1', 'R3 : 1 aug, 2 ms', 'R4 : 1 aug, 4 ms', 'R5 : 1 aug, 6 ms', 'Coupe le fil :', 'R6 : 1 aug, 8 ms'])
})

test('OCR : un numéro illisible après les consignes d\'une nouvelle pièce repart à 1', () => {
  const labels = ocrLabels()
  expect(['R23: 2 sc, 1 dec (24)', 'R24: 24 sc', 'Fasten off.', 'Chest', 'Use white yarn.', 'Rl: 4 sc', 'R2: 4 sc, ch 3'].map(labels))
    .toEqual(['R23: 2 sc, 1 dec (24)', 'R24: 24 sc', 'Fasten off.', 'Chest', 'Use white yarn.', 'R1 : 4 sc', 'R2: 4 sc, ch 3'])
})

test('OCR : des mots espacés ne sont pas pris pour deux colonnes', () => {
  // une seule colonne de rangs, écrite large (mots isolés, espaces de 7 pt pour une police de 12)
  const rows = Array.from({ length: 6 }, (_, i) => [`R${i + 1}:`, '1', 'aug,', `${2 * i}`, 'ms'].map((s, k) => ({ s, x: 50 + k * 41, y: 700 - i * 20, w: 34, h: 12 })))
  const pieces: TextPiece[] = rows.flat()
  // aucun rang coupé en deux
  expect(readingBlocks(pieces, 0, true).every((b) => b.length % 5 === 0)).toBe(true)
  expect(piecesToText([pieces], new Set([0])).split('\n')[0]).toBe('R1: 1 aug, 0 ms')
})

test('langue d\'un patron d\'après son vocabulaire (OCR)', () => {
  expect(patternLanguage('TÊTE\nR1 : 6 ms dans un anneau magique (6)\nR2 : 6 aug (12)\nR3 : *1 ms, aug* x6 (18)')).toBe('fra')
  expect(patternLanguage('HEAD\nRnd 1: 6 sc in a magic ring (6)\nRnd 2: inc in each stitch (12)\nRnd 3: (sc, inc) x6 (18)')).toBe('eng')
  expect(patternLanguage('CABEZA\nVuelta 1: 6 pb en un anillo mágico (6)\nVuelta 2: 6 aum (12)\nVuelta 3: (1 pb, aum) x6 (18)')).toBe('spa')
  expect(patternLanguage('KOPF\nRunde 1: 6 fM in einen Fadenring (6)\nRunde 2: jede M verdoppeln (12)\nRunde 3: *1 fM, 1 zun* 6 mal (18)')).toBe('deu')
  expect(patternLanguage('TESTA\nGiro 1: 6 mb in un anello magico (6)\nGiro 2: 6 aum (12)\nGiro 3: (1 mb, aum) x6 (18)')).toBe('ita')
  expect(patternLanguage('CABEÇA\nCarreira 1: 6 pbx no anel mágico (6)\nCarreira 2: 6 aum (12)\nCarreira 3: (1 pbx, aum) 6 vezes (18)')).toBe('por')
  expect(patternLanguage('HOOFD\nToer 1: 6 vaste in een magische ring (6)\nToer 2: 6 meerd (12)\nToer 3: (1 vaste, meerd) 6 keer (18)')).toBe('nld')
  expect(patternLanguage('Bonjour')).toBeNull()
})

test('vérification : une ligne retrouvée sur sa page, même nettoyée', () => {
  const pieces: TextPiece[] = [
    { s: 'BODY', x: 50, y: 760, w: 40, h: 12 },
    { s: 'R1: 6 sc in a magic ring (6)', x: 50, y: 740, w: 200, h: 12 },
    { s: 'R2: 6 inc (12)', x: 50, y: 720, w: 100, h: 12 },
    { s: 'HEAD', x: 50, y: 400, w: 40, h: 12 },
    { s: 'R1: 6 sc in a magic ring (6)', x: 50, y: 380, w: 200, h: 12 },
  ]
  const layout = [pageLayout(pieces, [0, 0, 595, 842])]
  const second = findOnPages('R1: 6 sc in a magic ring (6)', layout, 1)!
  expect(second.page).toBe(0)
  expect(second.box[1]).toBeCloseTo((842 - 392) / 842, 2)
  // ligne corrigée à la main : la plus ressemblante
  expect(findOnPages('R2: 6 inc (12) — stuff', layout)?.box[1]).toBeCloseTo((842 - 732) / 842, 2)
  expect(findOnPages('Something else entirely', layout)).toBeNull()
  expect(occurrenceOf(['a', 'R1: x', 'b', 'R1: x'], 3)).toBe(1)
})
