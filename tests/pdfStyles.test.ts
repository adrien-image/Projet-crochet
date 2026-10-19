// Mises en forme de patrons rencontrées dans des PDF (textes originaux écrits pour les tests).
import { test, expect } from 'vitest'
import { parsePattern, patternStats } from '../src/domain/parser'
import { buildPieces } from '../src/domain/pieces'
import { normalizePattern } from '../src/storage/patterns'
import { countTableRounds, joinWrappedRounds, stripPhotoRefs } from '../src/storage/countTable'
import { cleanOcrLine, garbledText, pageLines, pdfTitle, readingBlocks, type TextPiece } from '../src/storage/pdfText'

const counts = (text: string) => parsePattern(text).map((r) => [r.label, r.count, r.valid && r.fits !== false])

test('style fabricant : « 1st rnd: », rangs coupés, « Join. 20 sc. », « As 4th rnd. », couleurs MC / A', () => {
  const pdf = `Materials
Main Color (MC) Coral 1 ball
Contrast A Cream 1 ball
Muzzle
With A, make magic loop.
1st rnd: Ch 1. 6 sc in magic loop.
Join 6 sc.
2nd rnd: Ch 1. 2 sc in same sp as
sl st. 1 sc in next sc. *2 sc in next sc.
1 sc in next sc. Rep from * around.
Join. 9 sc.
Fasten off.
Body (worked in one piece)
With MC, make magic loop.
1st rnd: Ch 1. 8 sc in magic loop.
Join. 8 sc.
2nd rnd: Ch 1. 2 sc in each sc
around. Join. 16 sc.
3rd rnd: Ch 1. 1 sc in each sc
around. Join.
4th to 6th rnds: As 3rd rnd.
7th rnd: Ch 1. *Sc2tog. 1 sc in each
of next 2 sc. Rep from * around.
Join MC with sl st to first sc. Break A.
12 sts.
8th rnd: Ch 1. (Sc2tog) 6 times.
6 sts. Fasten off. Finish stuffing.`
  const text = joinWrappedRounds(pdf)
  expect(text).toContain('2nd rnd: Ch 1. 2 sc in same sp as sl st. 1 sc in next sc. *2 sc in next sc. 1 sc in next sc. Rep from * around. Join. 9 sc.')
  expect(text).toContain('\nFasten off.\nBody (worked in one piece)')
  expect(counts(text)).toEqual([
    ['R1', 6, true], ['R2', 9, true],
    ['R1', 8, true], ['R2', 16, true], ['R3', 16, true], ['R4', 16, true], ['R5', 16, true], ['R6', 16, true], ['R7', 12, true], ['R8', 6, true],
  ])
  const pieces = buildPieces(normalizePattern({ text }))
  expect(pieces.map((p) => p.label)).toEqual(['Muzzle', 'Body'])
})

test('style blog : « 1 sc in next sc », « sc 2 around », compte « (6 sc) »', () => {
  const text = `LITTLE FISH
Round 1: 4 sc in magic ring (4 st)
Round 2: (1 sc in next sc, 2 sc in next st) 2 times (6 st)
Round 3: sc around (6)
Round 4: (sc2tog, sc 1 into next sc) 2 times (4 sc)
Round 5: sc 2 around (8 sc)
Round 6: (sc 1 into next sc, then sc 2 into next) 4 times (12 sc)`
  expect(counts(text)).toEqual([['R1', 4, true], ['R2', 6, true], ['R3', 6, true], ['R4', 4, true], ['R5', 8, true], ['R6', 12, true]])
})

test('style marque-page : renvois aux photos, picots, comptes entre crochets, chaînette de base', () => {
  const pdf = `Notes: small numbers in brackets denote the photographs.
Bookmark:
1. [1]Ch3 (counts as a Dc). Work 3Dc into
magic ring. [2]Ch4, [3]Slst into 4th Ch from
Hk (creates picot). [4]3Dc. Slst to the top of the Ch3 to close. [7 Dc, 1 Picot]
2. [5]Ch10. Work 6Tr into the 4th Ch from Hk.
[6]
3. [7]Tr into next Ch. Dc into next 2Ch. Sc into next 2 Chs. Slst into last Ch.
4. Slst across 4 Tr.`
  const text = joinWrappedRounds(stripPhotoRefs(pdf))
  expect(text).not.toMatch(/\[\d\]/)
  const rounds = parsePattern(text)
  expect(rounds.map((r) => r.section)).toEqual(['Bookmark', 'Bookmark', 'Bookmark', 'Bookmark'])
  expect(rounds[0].count).toBe(7)
  expect(rounds[0].expected).toBe(7)
  expect(rounds[1].count).toBe(6)
  expect(rounds[2].count).toBe(5)
  expect(rounds[3].stitches).toEqual(['sl', 'sl', 'sl', 'sl'])
  expect(patternStats(rounds)).toMatchObject({ invalid: 0, misfit: 0 })
})

test('diagramme : tableau de comptes changé en rangs, compte illisible déduit de la progression', () => {
  const text = countTableRounds(`Base
round # | stitch count
5 | 46 sts
4 | 40 sts
3 | ???
2 | 28 sts
1 | 22 sts
ch10 to begin`)
  expect(text).toBe(`Base
R1 : 22 sc (22)
R2 : 6 inc, 16 sc (28)
R3 : 6 inc, 22 sc (34)
R4 : 6 inc, 28 sc (40)
R5 : 6 inc, 34 sc (46)
ch10 to begin`)
  expect(patternStats(parsePattern(text))).toMatchObject({ rounds: 5, invalid: 0, misfit: 0 })
  // lignes perdues (OCR) : déduites de la progression régulière
  // (sans titre au-dessus du tableau : « Rounds », pour ne pas prendre le titre d'une autre pièce)
  expect(countTableRounds('round # | stitch count\n5 | 46 sts\n2 | 28 sts\n1 | 22 sts')).toBe(['Rounds', ...text.split('\n').slice(1, 6)].join('\n'))
  // en français : ms / aug / dim ; un tableau sans en-tête ni suite depuis 1 n'est pas touché
  expect(countTableRounds('Fond (crochet 3 mm, fil coton)\nRang | mailles\n1 | 12 m\n2 | 18 m\n3 | 18 m\n4 | 12 m\nArrêter et rentrer les mailles.'))
    .toContain('R2 : 6 aug, 6 ms (18)\nR3 : 18 ms (18)\nR4 : 6 dim, 6 ms (12)')
  expect(countTableRounds('Prix\n2 | 10 m\n3 | 12 m\n4 | 14 m')).toBe('Prix\n2 | 10 m\n3 | 12 m\n4 | 14 m')
})

test('PDF : texte illisible (police sans table de caractères), bordure pointillée lue par l\'OCR', () => {
  const piece = (s: string): TextPiece => ({ s, x: 0, y: 0, w: 10, h: 10 })
  expect(garbledText([piece('!"#$#% & \'() () ) *+ , -% & ./$$012(345 6*36$ 71 -, +89# : /7')])).toBe(true)
  expect(garbledText([piece('R1: 6 sc in a magic ring (6) — R2: 6 inc (12) — R3: (1 sc, 1 inc) x6 (18)')])).toBe(false)
  expect(cleanOcrLine(': Bottom: Work chain to begin. Crochet as shown in chart. | :')).toBe('Bottom: Work chain to begin. Crochet as shown in chart.')
  // une ligne sans bordure ne perd pas son « : » (numéro de rang illisible)
  expect(cleanOcrLine(': 2 aug, ch 1, tourne')).toBe(': 2 aug, ch 1, tourne')
})

test('PDF : exposant ordinal rattaché à sa ligne, encadré en bas à gauche lu après la colonne', () => {
  const line = pageLines([
    { s: 'Slst into the 4', x: 50, y: 700, w: 70, h: 10 },
    { s: 'th', x: 120.5, y: 704, w: 6, h: 6 },
    { s: 'Ch from Hk.', x: 129, y: 700, w: 50, h: 10 },
  ])
  expect(line).toEqual(['Slst into the 4th Ch from Hk.'])
  const column = Array.from({ length: 12 }, (_, i) => ({ s: `${i + 1}. Row text that is long enough`, x: 300, y: 780 - i * 40, w: 200, h: 10 }))
  const sidebar = Array.from({ length: 4 }, (_, i) => ({ s: `Follow me line ${i + 1} here`, x: 40, y: 200 - i * 14, w: 150, h: 10 }))
  const blocks = readingBlocks([...sidebar, ...column])
  expect(blocks[0][0].s).toMatch(/^1\. Row/)
})

test('titre : une citation en grand n\'est pas un titre ; titre répété en en-tête', () => {
  const quote = [
    { s: 'Ideas are like cats. They', x: 200, y: 700, w: 200, h: 16 },
    { s: 'follow you around the house', x: 200, y: 680, w: 200, h: 16 },
    { s: 'all day long. - Someone', x: 200, y: 660, w: 200, h: 16 },
    { s: 'Materials:', x: 50, y: 400, w: 60, h: 11 },
  ]
  expect(pdfTitle(null, quote, 'Cat_bookmark.pdf')).toBe('Cat bookmark')
  const header = [
    { s: 'SPOTTY PUPPY CROCHET-ALONG: PART 1', x: 40, y: 800, w: 260, h: 10 },
    { s: 'Designed by Someone Else', x: 400, y: 800, w: 150, h: 10 },
  ]
  expect(pdfTitle(null, [{ s: '4', x: 40, y: 700, w: 10, h: 30 }], 'x.pdf', header)).toBe('SPOTTY PUPPY CROCHET-ALONG: PART 1')
})
