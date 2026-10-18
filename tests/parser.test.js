import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePattern, patternStats, sectionCopies, detectNotation } from '../src/patternParser.js'
import { samplePattern, heartPattern } from '../src/storage.js'

const one = (text) => parsePattern(text)
const counts = (text) => parsePattern(text).map((r) => r.count)

test('patrons d\'exemple : rangs, sections et comptes cohérents', () => {
  const mouse = patternStats(parsePattern(samplePattern().text))
  assert.deepEqual(mouse, { rounds: 27, sections: 3, invalid: 0, misfit: 0 })
  const heart = patternStats(parsePattern(heartPattern().text))
  assert.deepEqual(heart, { rounds: 35, sections: 3, invalid: 0, misfit: 0 })
})

test('notation française, répétitions et « dans chaque maille »', () => {
  const r = one('R1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)\nR4 : (2 ms, aug) x 6 [24]\nR5 : *2 ms, dim* répéter 6 fois (18)\nR6 : dim dans chaque maille (9)')
  assert.deepEqual(r.map((x) => x.count), [6, 12, 18, 24, 18, 9])
  assert.ok(r.every((x) => x.valid && x.fits !== false))
})

test('notation US', () => {
  const r = one('Rnd 1: 6 sc in magic ring (6)\nRnd 2: inc around (12)\nRound 3: (sc, inc) x6 (18)\nRnd 4: ch 1, *sc, inc* around, sl st to join (27)\nRnd 5: *sc, sc2tog* 9 times (18)\nRow 6: 2 sc in each st around (36)')
  assert.deepEqual(r.map((x) => x.count), [6, 12, 18, 27, 18, 36])
  assert.ok(r.every((x) => x.valid))
  assert.equal(r[4].stitches[1], 'dec')
  assert.deepEqual(counts('R1: 12 sc\nR2: sc2tog 6 times (6)'), [12, 6])
})

test('notation XVA (asiatique)', () => {
  const r = one('R1: 6X\nR2: 6V (12)\nR3: (X, V) x6 (18)\nR4: 9A (9)')
  assert.deepEqual(r.map((x) => x.count), [6, 12, 18, 9])
  assert.ok(r.every((x) => x.valid))
})

test('termes UK : dc = maille serrée', () => {
  const text = 'UK terms\nR1: 6 dc in magic ring (6)\nR2: 2 dc in each st (12)\nR3: 1 htr in each st (12)'
  assert.equal(detectNotation(text), 'uk')
  const r = one(text)
  assert.deepEqual(r.map((x) => x.stitches[0]), ['sc', 'inc', 'hdc'])
  assert.ok(r.every((x) => x.valid))
})

test('le « à » français et les lettres isolées ne sont pas des mailles', () => {
  assert.deepEqual(counts('R1 : 6 ms à travailler dans le brin arrière'), [6])
  assert.deepEqual(counts('R1 : 6 ms (6)\nR2 : 1 ms à chaque maille (6)'), [6, 6])
})

test('plages de rangs', () => {
  for (const text of ['R5-R9 : 36 ms', 'R5-9: 36 sc', 'Rnd 5-Rnd 9: 36 sc', 'Rangs 5 à 9 : 36 ms', 'Rounds 5 to 9: 36 sc']) {
    const r = one(text)
    assert.deepEqual(r.map((x) => x.label), ['R5', 'R6', 'R7', 'R8', 'R9'], text)
    assert.ok(r.every((x) => x.count === 36))
  }
})

test('sections : majuscules ou titre avec « : », pas les phrases', () => {
  const r = one('TÊTE\nR1 : 6 ms\nCommencer à bourrer\nR2 : aug dans chaque maille\nBras (x2) :\nR1 : 6 ms\n## Queue\nR1 : 4 ms\nMatériel : coton\nR2 : 4 ms')
  assert.deepEqual(r.map((x) => x.section), ['TÊTE', 'TÊTE', 'Bras (x2)', 'Queue', 'Queue'])
})

test('détection des incohérences', () => {
  const [, r2] = one('R1 : 6 ms (6)\nR2 : *1 ms, aug* x6 (12)')
  assert.equal(r2.valid, false) // 18 calculées, 12 annoncées
  assert.equal(r2.fits, false) // consomme 12 mailles alors que R1 en a 6
})

test('clés de rang stables et uniques', () => {
  const r = parsePattern(samplePattern().text)
  assert.equal(new Set(r.map((x) => x.key)).size, r.length)
})

test('nombre d\'exemplaires d\'une pièce', () => {
  assert.equal(sectionCopies('OREILLES (x2, grandes oreilles rondes)'), 2)
  assert.equal(sectionCopies('BRAS × 2'), 2)
  assert.equal(sectionCopies('PATTES (4 pièces)'), 4)
  assert.equal(sectionCopies('CORPS'), 1)
  assert.equal(sectionCopies(null), 1)
})

test('entrée vide', () => {
  assert.deepEqual(parsePattern(''), [])
  assert.deepEqual(parsePattern(null), [])
})
