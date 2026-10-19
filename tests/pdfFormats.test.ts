import { test, expect } from 'vitest'
import { parsePattern, patternStats } from '../src/domain/parser'
import { buildCords, buildPieces, findDetails } from '../src/domain/pieces'
import { guessPatternInfo } from '../src/domain/patternInfo'
import { ballsFor, estimateYarn, yarnMaterial, yarnWeight } from '../src/domain/yarn'
import { buildModel, type Part } from '../src/render3d/model'
import { normalizePattern } from '../src/storage/patterns'
import { pdfTitle, readingBlocks, type TextPiece } from '../src/storage/pdfText'

// Patrons originaux écrits pour les tests, dans les mises en forme rencontrées dans des PDF réels.

// style « magazine » anglophone : comptes « = 12 sc », plages « R3 - 5 (3 rnds) », couleurs par code,
// titres suivis de consignes, pièce plate cousue sur le ventre, rangs repris plus loin
const BUNNY = `Snow bunny
Material
Plush yarn - Soft Velvet
1 ball in each color #101 stone and #102 white
Crochet hook B-1/2.25
mm
Body
Body and head
Use color #101 stone
Crochet in the round. Close rnds with 1 sl st.
Make a magic ring.
R1: 6 sc inside of magic ring.
R2: 6 inc = 12 sc
R3: 1 sc, 1 inc = 18 sc
R4 - 6 (3 rnds) = 18 sc in each rnd.
R7: 1 sc, 1 dec = 12 sc
Fasten off.
Belly patch
Use color #102 white
Ch 4. Crochet back and forth.
R1: 3 sc
R2: 3 sc, ch 2
R3: 2 sc into chains, 3 sc
R4: 3 sc
Make 2 more rnds joining this part into body:
R8 & 9: 12 sc in each rnd.
Fasten off.
Head
Use color #101 stone
Make a magic ring.
R1: 6 sc inside of magic ring.
R2: 6 inc = 12 sc
R3: 1 sc, 1 inc = 18 sc
R4 - 5 (2 rnds) = 18 sc in each rnd.
Switch to color #102 white
R6 & 7: 18 sc in each rnd.
Attach safety eyes between R4 & 5, 4 sc apart.
Snout
Use color #102 white
Make a magic ring.
R1: 6 sc inside of magic ring.
R2: 6 inc = 12 sc
Attach safety nose onto snout.
Arms (make 2)
Use color #102 white
Make a magic ring.
R1: 6 sc inside of magic ring.
R2: 6 sc
Switch to color #101 stone
R3 & 4: 6 sc in each rnd.
Fasten off.`

// style « tutoriel » francophone : pièces plates en deux couches de couleurs différentes
const RAY = `Raie bébé
Matériel
Crochet n°4
Fil coton
Rembourrage
Aile x2 (bleu, blanc)
Blanc :
R1 : ch 2, 1 aug, ch 1, tourne le projet
R2 : 2 aug, ch 1, tourne (4)
R3 : 1 aug, 2 ms, 1 aug, ch 1, tourne (6)
R4 : 1 aug, 4 ms, 1 aug, ch 1, tourne (8)
Fais une deuxième aile en bleu
Tête (bleu, blanc)
Pique ton crochet dans la maille nº3 de l'aile et fais :
R1-2 : 4 ms, ch 1, tourne le projet
Queue
ch 12, 11 ms dans ch
Assemblage
Positionne l'aile bleue sur l'aile blanche, rembourre et ferme.
Brode plusieurs traits en blanc sur le dessus.
Yeux : découpe 2 cercles noirs en feutrine.`

test('style magazine : comptes « = N sc », plages, couleurs par code, titres avant les consignes', () => {
  const rounds = parsePattern(BUNNY)
  const stats = patternStats(rounds)
  expect(stats.invalid).toBe(0)
  expect(stats.misfit).toBe(0)
  const p = normalizePattern({ text: BUNNY })
  const pieces = buildPieces(p)
  expect(pieces.map((x) => [x.label, x.copies])).toEqual([['Body and head', 1], ['Belly patch', 1], ['Head', 1], ['Snout', 1], ['Arms', 2]])
  const body = pieces[0]
  // « R8 & 9 » placés après le plastron reprennent le corps (R7 à 12 mailles)
  expect(body.rounds.map((r) => r.label)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'])
  expect(body.rounds.map((r) => r.count)).toEqual([6, 12, 18, 18, 18, 18, 12, 12, 12])
  // « Use color #101 stone » : gris ; « Switch to color #102 white » en cours de pièce
  expect(body.color).toBe('#9b9a9c')
  const head = pieces[2]
  expect(head.rounds.map((r) => r.color)).toEqual(['#9b9a9c', '#9b9a9c', '#9b9a9c', '#9b9a9c', '#9b9a9c', '#f4f1ea', '#f4f1ea'])
  expect(pieces[4].rounds.map((r) => r.color)).toEqual(['#f4f1ea', '#f4f1ea', '#9b9a9c', '#9b9a9c'])
  // le plastron se travaille à plat (« back and forth »)
  expect(pieces[1].flat).toBe(true)
  const details = findDetails(BUNNY)
  expect(details.eyes?.gap).toBe(4)
  expect(details.nose).not.toBeNull()
  expect(guessPatternInfo(BUNNY)).toMatchObject({ hook: '2,25 mm', yarn: 'Plush yarn - Soft Velvet' })
})

test('style magazine en 3D : tête retournée sur le corps, museau et truffe, plastron cousu, mains au bout des bras', () => {
  const p = normalizePattern({ text: BUNNY })
  const model = buildModel(buildPieces(p), buildCords(p), findDetails(p.text), { assembled: true })
  const lathes = model.parts.filter((x): x is Extract<Part, { kind: 'lathe' }> => x.kind === 'lathe')
  const head = lathes.find((x) => x.label === 'Head')!
  // la tête finit ouverte (12 mailles) : cousue par son ouverture, donc retournée
  expect(head.transform.rotation[0]).toBeCloseTo(Math.PI)
  const body = lathes.find((x) => x.label === 'Body and head')!
  expect(head.transform.position[1]).toBeGreaterThan(body.transform.position[1])
  // le plastron est posé sur le corps, pas à côté
  const patch = model.parts.find((x) => x.label === 'Belly patch')
  expect(patch?.kind).toBe('panel')
  expect(patch && 'transform' in patch && Math.abs(patch.transform.position[0])).toBeLessThan(2)
  // la truffe est au bout du museau, devant la tête
  const nose = model.parts.find((x) => x.label === 'Nez')
  expect(nose && 'position' in nose && nose.position[2]).toBeGreaterThan(3)
  // bras cousus par leur dernier rang : le rang 1 (main, blanc) pend vers le bas
  const arm = lathes.find((x) => x.label === 'Arms')!
  expect(arm.transform.position[1]).toBeLessThan(body.transform.position[1] + 20)
})

test('style tutoriel : deux couches de couleurs, tête prolongeant l\'aile, queue en chaînette', () => {
  const p = normalizePattern({ text: RAY })
  expect(patternStats(parsePattern(RAY))).toMatchObject({ invalid: 0, misfit: 0 })
  const pieces = buildPieces(p)
  expect(pieces.map((x) => [x.label, x.copies, x.copyColors])).toEqual([
    ['Aile', 2, ['#4a72b0', '#f4f1ea']],
    ['Tête', 2, ['#4a72b0', '#f4f1ea']],
  ])
  expect(pieces.every((x) => x.flat)).toBe(true)
  expect(buildCords(p)).toMatchObject([{ label: 'Queue', length: 12, color: '#4a72b0' }])
  const details = findDetails(RAY)
  expect(details.stuffed).toBe(true)
  expect(details.stripes?.color).toBe('#f4f1ea')
  const model = buildModel(pieces, buildCords(p), details, { assembled: true })
  const panels = model.parts.filter((x): x is Extract<Part, { kind: 'panel' }> => x.kind === 'panel')
  // un seul coussin : aile + tête, bleu dessus, blanc dessous
  expect(panels.length).toBe(1)
  expect(panels[0].puff).toMatchObject({ top: '#4a72b0', bottom: '#f4f1ea' })
  expect(panels[0].rows.length).toBe(4 + 2)
  expect(model.parts.filter((x) => x.label === 'Broderie').length).toBeGreaterThan(0)
  expect(model.parts.filter((x) => x.kind === 'bead').length).toBe(2)
  const tail = model.parts.find((x) => x.label === 'Queue')
  expect(tail?.kind === 'cord' && tail.points[tail.points.length - 1][2]).toBeLessThan(-3)
  // fil : une couleur par couche
  expect(estimateYarn(p).byColor.map((c) => c.color).sort()).toEqual(['#4a72b0', '#f4f1ea'])
})

test('fiche des fils : noms du patron, pièces, épaisseur, matière, grammes', () => {
  const est = estimateYarn(normalizePattern({ text: BUNNY, yarn: 'Plush yarn - Soft Velvet', hook: '2,25 mm' }))
  const stone = est.byColor.find((c) => c.color === '#9b9a9c')!
  expect(stone.name).toBe('#101 stone')
  expect(stone.pieces).toEqual(expect.arrayContaining(['Body and head', 'Head', 'Arms']))
  expect(yarnWeight(2.25).category).toBe(1)
  expect(yarnWeight(3).category).toBe(2)
  expect(yarnWeight(5).category).toBe(4)
  expect(yarnMaterial('Plush yarn - Soft Velvet')).toBe('chenille')
  expect(yarnMaterial('Coton peigné')).toBe('coton')
  const { grams, balls } = ballsFor(100, yarnWeight(4), null)
  expect(grams).toBeGreaterThan(40)
  expect(balls).toBe(1)
})

test('piquants sans couleur : 2e couleur du fil', () => {
  const p = normalizePattern({ yarn: 'cotton in green and beige', text: 'Body\n1 – 6 sc into a magic ring (6)\n2 – 6 inc (12)\nSpikes – make 2\n1 – 4 sc into a magic ring (4)\n2 – 4 inc (8)' })
  expect(buildPieces(p).map((x) => x.color)).toEqual(['#5e9a58', '#d9c3a0'])
})

const piece = (s: string, x: number, y: number, h = 10): TextPiece => ({ s, x, y, w: s.length * 5, h })

test('PDF en colonnes : chaque colonne lue entière, l\'en-tête d\'abord', () => {
  const lines = (col: number, texts: string[]) => texts.map((s, i) => piece(s, 40 + col * 180, 700 - i * 14))
  const page = [
    piece('Snow bunny – a free pattern for you', 40, 780),
    ...lines(0, ['Material', 'Plush yarn', 'Crochet hook 2.25 mm', 'Stitch glossary']),
    ...lines(1, ['Body', 'R1: 6 sc (6)', 'R2: 6 inc = 12 sc', 'R3: 12 sc']),
    ...lines(2, ['Head', 'R1: 6 sc (6)', 'R2: 6 inc = 12 sc', 'Fasten off.']),
  ]
  const order = readingBlocks(page).flat().map((p) => p.s)
  expect(order.slice(0, 1)).toEqual(['Snow bunny – a free pattern for you'])
  expect(order.indexOf('R3: 12 sc')).toBeLessThan(order.indexOf('Head'))
  expect(order.indexOf('Stitch glossary')).toBeLessThan(order.indexOf('Body'))
  // une étiquette « R1: » alignée à gauche de ses instructions ne fait pas une colonne
  const labelled = [0, 1, 2, 3].flatMap((i) => [piece(`R${i + 1}:`, 40, 700 - i * 14), piece('6 sc around the ring (6)', 70, 700 - i * 14)])
  expect(readingBlocks(labelled).length).toBe(1)
})

test('PDF : nom du patron (métadonnées, grand titre, nom du fichier)', () => {
  expect(pdfTitle('Pattern Raie Géante', [], 'x.pdf')).toBe('Raie Géante')
  expect(pdfTitle(null, [piece('Sleeping baby dino', 100, 700, 22), piece('Crochet pattern', 100, 670, 22), piece('by me', 100, 600, 11)], 'x.pdf')).toBe('Sleeping baby dino')
  expect(pdfTitle('Microsoft Word - doc1.docx', [piece('P a t t e r n', 10, 700, 70)], 'Wolf_Pup.pdf')).toBe('Wolf Pup')
  expect(pdfTitle(null, [piece('Little dragon - by Test Designer', 40, 800, 11)], null)).toBe('Little dragon')
  expect(pdfTitle(null, [], null)).toBeNull()
})

test('patrons en espagnol, portugais, allemand, italien et néerlandais', () => {
  const samples: Record<string, string> = {
    es: 'CABEZA\nV1: 6 pb en anillo mágico (6)\nV2: 6 aum (12)\nV3: (1 pb, 1 aum) x 6 (18)\nV4: 1 pb en cada punto (18)\nV5: (1 pb, 1 dism) 6 veces (12)',
    pt: 'CABEÇA\nCarreira 1: 6 pb no anel mágico (6)\nCarreira 2: 6 aum (12)\nCarr 3: *1 pb, 1 aum* 6 vezes (18)\nCarr 4: 18 pb (18)',
    de: 'KOPF\nRd. 1: 6 fM in den Fadenring (6)\nRd. 2: jede M verdoppeln (12)\nRd. 3: *1 fM, 1 zun* 6 mal (18)\nRd. 4: 18 fM (18)\nRd. 5: *1 fM, 1 abn* x6 (12)',
    it: 'TESTA\nGiro 1: 6 mb nell\'anello magico (6)\nGiro 2: 6 aum (12)\nGiro 3: (1 mb, 1 aum) x6 (18)\nG4: 18 mb (18)',
    nl: 'HOOFD\nToer 1: 6 vaste in een magische ring (6)\nToer 2: 6 meerd (12)\nT3: (1 vaste, 1 meerd) x6 (18)\nT4: 18 vaste (18)',
  }
  for (const [lang, text] of Object.entries(samples)) {
    const rounds = parsePattern(text)
    expect(rounds.length, lang).toBeGreaterThanOrEqual(4)
    expect(rounds.every((r) => r.valid && r.fits !== false), lang).toBe(true)
  }
})

test('rangs en tableau (PDF ou copié depuis un tableur)', () => {
  const rounds = parsePattern('HEAD\nRound | Instructions | Stitch count\n1 | 6 sc in a magic ring | 6\n2 | inc in each st | 12\nRnd 3-4 | 12 sc | 12\nR5\t(sc, inc) x6\t18')
  expect(rounds.map((r) => [r.label, r.count, r.expected])).toEqual([['R1', 6, 6], ['R2', 12, 12], ['R3', 12, 12], ['R4', 12, 12], ['R5', 18, 18]])
  // une colonne de numéros de rang alignée sur les instructions : un tableau, lu ligne par ligne
  const cells = [0, 1, 2, 3].flatMap((i) => [piece(String(i + 1), 40, 700 - i * 14), piece(`${6 * (i + 1)} sc around the ring`, 120, 700 - i * 14), piece(String(6 * (i + 1)), 360, 700 - i * 14)])
  expect(readingBlocks(cells).length).toBe(1)
})
