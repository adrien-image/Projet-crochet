import { test, expect } from 'vitest'
import { parsePattern, patternStats, splitSections } from '../src/domain/parser'
import { buildCords, buildPieces, findDetails, rowsFor } from '../src/domain/pieces'
import { guessPatternInfo } from '../src/domain/patternInfo'
import { buildModel, type Part } from '../src/render3d/model'
import { normalizePattern } from '../src/storage/patterns'
import { pageLines, piecesToText, removeRunningPieces, type TextPiece } from '../src/storage/pdfText'

// Patron original écrit pour les tests, dans la mise en forme de nombreux PDF anglophones :
// rangs numérotés sans « R », plages « 4 to 6 », « 9 and 10 », remarques après un tiret, « make 2 ».
const DRAGON = `Little sleepy dragon
Crochet pattern
Materials:
Cotton yarn in teal and cream, 2,5mm crochet hook, fiberfill, black thread for the eyes.
Abbreviations:
Sc – single crochet
Pattern:
Body: start at the tip of the nose
1 – 6 sc into a magic ring (6)
2 – 6 inc (12)
3 – 1 sc, 1 inc (18)
4 to 6 – 18 sc (3 rows)
7 – 2 sc, 1 inc (24)
8 – BLO – 24 sc
9 and 10 – 24 sc (2 rows) – stuff the head
11 – 2 sc, 1 dec (18)
12 – 1 sc, 1 dec (12) – Stuff the body
13 – 6 dec (6) - Fasten off
Legs – make 2
1 – 6 sc into a magic ring (6)
2 e 3 – 6 sc (2 rows)
4 – 2 hdc, 1 sc, 1 ss (4) – Leave tail for sewing
Back spikes – make 2
1 – 4 sc into a magic ring (4)
2 – (1 sc, 1 inc) x2 (6)
3 – 6 sc – Do not stuff
Assembly:
- Sew the legs between rows 9 and 10 of the body.
- Sew the spikes on the back: rows 5 to 6 - rows 10 to 11.
- Embroider the eyes between rows 3 and 4.
1. Weave in all ends.
2 – Take a photo of your dragon!`

test('PDF anglophone : rangs sans préfixe, plages, répétition implicite, remarques', () => {
  const rounds = parsePattern(DRAGON)
  const stats = patternStats(rounds)
  expect(stats.rounds).toBe(13 + 4 + 3)
  expect(stats.invalid).toBe(0)
  const body = rounds.filter((r) => r.section?.startsWith('Body'))
  expect(body.map((r) => r.count)).toEqual([6, 12, 18, 18, 18, 18, 24, 24, 24, 24, 18, 12, 6])
  expect(body[7].loop).toBe('blo')
  // « 3 – 1 sc, 1 inc (18) » : la séquence fait le tour
  expect(body[2].valid).toBe(true)
  // une maille coulée comptée dans le total annoncé
  expect(rounds.find((r) => r.section?.startsWith('Legs') && r.number === 4)?.valid).toBe(true)
  // une liste numérotée après les rangs n'est pas un rang
  expect(rounds.some((r) => r.text.startsWith('1. Weave') || r.text.includes('photo'))).toBe(false)
})

test('PDF anglophone : titres de pièces en casse mixte, nombre d\'exemplaires, rembourrage', () => {
  const p = normalizePattern({ text: DRAGON, yarn: 'teal' })
  const pieces = buildPieces(p)
  expect(pieces.map((x) => [x.label, x.copies])).toEqual([['Body', 1], ['Legs', 2], ['Back spikes', 2]])
  // « flatten » absent, « Stuff the body » : rembourré ; « Do not stuff » : creux
  expect(pieces.map((x) => x.stuffed)).toEqual([true, true, false])
  expect([...splitSections(DRAGON).keys()]).toContain('Body (start at the tip of the nose)')
})

test('PDF anglophone : nom, crochet et fil devinés', () => {
  expect(guessPatternInfo(DRAGON)).toEqual({ name: 'Little sleepy dragon', hook: '2,5 mm', yarn: 'Cotton yarn in teal and cream' })
  expect(guessPatternInfo('Crochet pattern\nBunny\nCrochet 3,5 mm, fil coton rose').hook).toBe('3,5 mm')
})

test('3D : positions lues dans l\'assemblage (rangs), piquants sur le dos', () => {
  const p = normalizePattern({ text: DRAGON, yarn: 'teal' })
  const details = findDetails(p.text)
  expect(rowsFor('Legs', details.rows)).toEqual([9.5])
  // « rows 5 to 6 - rows 10 to 11 » : la 2e mention reprend le sujet de la 1re
  expect(rowsFor('Back spikes', details.rows, 2)).toEqual([5.5, 10.5])
  // pour deux exemplaires, si le premier mot ne suffit pas, les suivants sont essayés
  expect(rowsFor('Small spikes', [{ before: 'the small one', row: 3 }, { before: 'spikes', row: 3 }, { before: 'spikes', row: 8 }], 2)).toEqual([3, 8])
  expect(rowsFor('eyes', details.rows)).toEqual([3.5])
  const model = buildModel(buildPieces(p), buildCords(p), details, { assembled: true })
  const lathes = model.parts.filter((x): x is Extract<Part, { kind: 'lathe' }> => x.kind === 'lathe')
  expect(lathes.map((x) => x.label)).toEqual(['Body', 'Legs', 'Legs', 'Back spikes', 'Back spikes'])
  // corps couché, tête vers +z : les piquants sont au-dessus, l'un derrière l'autre
  const [s1, s2] = lathes.filter((x) => x.label === 'Back spikes').map((x) => x.transform.position)
  const body = lathes[0]
  const top = Math.max(...body.rings.map((r) => r.r))
  expect(s1[1]).toBeGreaterThan(top * 0.5)
  expect(s2[1]).toBeGreaterThan(top * 0.5)
  expect(Math.abs(s1[2] - s2[2])).toBeGreaterThan(1)
  // jambes de part et d'autre, en dessous
  const [l1, l2] = lathes.filter((x) => x.label === 'Legs').map((x) => x.transform.position)
  expect(Math.sign(l1[0])).toBe(-Math.sign(l2[0]))
  expect(model.parts.filter((x) => x.kind === 'bead').length).toBe(2)
})

const piece = (s: string, x: number, y: number, w = s.length * 5, h = 10): TextPiece => ({ s, x, y, w, h })

test('PDF : lignes reconstituées, colonnes séparées, en-têtes répétés retirés', () => {
  // un rang à gauche, une légende de photo loin à droite sur la même ligne
  expect(pageLines([piece('36 –', 50, 700), piece('36 sc', 75, 700), piece('After row 35 –', 400, 701)]))
    .toEqual(['36 – 36 sc', 'After row 35 –'])
  // même séparées par l'« espace » géante que pdf.js insère entre deux colonnes
  expect(pageLines([piece('4 to 6 - 18 sc', 50, 700, 70), piece(' ', 120, 700, 260), piece('After row 6 -', 380, 700)]))
    .toEqual(['4 to 6 - 18 sc', 'After row 6 -'])
  // fragments collés (sans espace) ou séparés
  expect(pageLines([piece('Hel', 50, 600, 15), piece('lo', 65, 600, 10), piece('world', 80, 600)])).toEqual(['Hello world'])
  const header = (n: number) => [piece('Little dragon – by Me', 50, 800), piece(`Page ${n} of 3`, 400, 800)]
  const pages = [
    [...header(1), piece('Little dragon', 50, 700)],
    [...header(2), piece('Body', 50, 700), piece('1 – 6 sc into a magic ring (6)', 50, 680)],
    [...header(3), piece('2 – 6 inc (12)', 50, 700)],
  ]
  expect(removeRunningPieces(pages).flat().map((p) => p.s)).toEqual(['Little dragon', 'Body', '1 – 6 sc into a magic ring (6)', '2 – 6 inc (12)'])
  const text = piecesToText(pages)
  expect(text).not.toContain('Page')
  expect(parsePattern(text).map((r) => r.count)).toEqual([6, 12])
})

test('rangs sans préfixe : pas de faux positifs dans du texte courant', () => {
  const text = 'Materials:\n2 – skeins of yarn\n1. Cut the yarn\n3 – 4 cm of ribbon\nHEAD\nR1 : 6 ms (6)'
  expect(parsePattern(text).map((r) => r.text)).toEqual(['R1 : 6 ms (6)'])
  // un rang sans préfixe doit commencer à 1 ou suivre le précédent
  expect(parsePattern('Notes\n7 – 18 sc\nBody\n1 – 6 sc (6)\n2 – 6 inc (12)\n5 – 12 sc').map((r) => r.number)).toEqual([1, 2])
})

test('un dernier tour partiel qui finit par une maille coulée n\'est pas une erreur', () => {
  const [, , last] = parsePattern('Leg\n1 – 6 sc into a magic ring (6)\n2 – 6 sc\n3 – 2 hdc, 1 sc, 1 ss (4)')
  expect([last.valid, last.fits]).toEqual([true, true])
  // sans maille coulée finale, un tour incomplet reste signalé
  expect(parsePattern('Leg\n1 – 6 sc into a magic ring (6)\n2 – 4 sc (4)')[1].fits).toBe(false)
})
