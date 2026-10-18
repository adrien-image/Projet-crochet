import { test, expect } from 'vitest'
import { buildPieces, buildCords, findDetails } from '../src/domain/pieces'
import { findYarnColor, shade } from '../src/domain/colors'
import { safeMimeType } from '../src/storage/assets'
import { normalizePattern } from '../src/storage/patterns'
import { samplePattern, heartPattern } from '../src/storage/samples'

test('couleurs de fil lues dans le texte', () => {
  expect(findYarnColor('Coton gris, un peu de rose')).toBe('#9b9a9c')
  expect(findYarnColor('laine bleu clair')).toBe('#9cc3e6')
  expect(findYarnColor('yarn: light pink')).toBe('#f2c4cf')
  expect(findYarnColor('aucune')).toBeNull()
  expect(shade('#808080', 0.5)).toBe('#404040')
})

test('pièces : regroupement, exemplaires, état ouvert / aplati, couleur', () => {
  const pieces = buildPieces(samplePattern())
  expect(pieces.map((p) => [p.label, p.copies, p.open, p.flattened])).toEqual([
    ['MUSEAU + CORPS', 1, false, false],
    ['OREILLES', 2, true, true],
  ])
  const heart = buildPieces(heartPattern())
  expect(heart.map((p) => p.joinedStart)).toEqual([false, false, true])
  expect(heart.every((p) => p.color === '#c3323c')).toBe(true)
  // une couleur choisie par l'utilisateur l'emporte
  const custom = buildPieces({ ...samplePattern(), pieceColors: { OREILLES: '#123456' } })
  expect(custom[1].color).toBe('#123456')
})

test('la couleur des yeux ou du nez ne déteint pas sur les pièces', () => {
  const p = normalizePattern({ yarn: 'beige', text: 'CORPS\nR1 : 6 ms (6)\nR2 : 6 ms\nBroder le nez noir et les yeux noirs.' })
  expect(buildPieces(p)[0].color).toBe('#d9c3a0')
  expect(findDetails(p.text)).toMatchObject({ eyes: { color: '#141416' }, nose: { color: '#2a2a2d' } })
})

test('queue de la souris', () => {
  expect(buildCords(samplePattern())).toEqual([{ label: 'QUEUE', length: 40, color: '#9b9a9c' }])
})

test('sécurité : seuls les types de fichiers inoffensifs sont servis tels quels', () => {
  expect(safeMimeType('application/pdf')).toBe('application/pdf')
  expect(safeMimeType('image/png')).toBe('image/png')
  expect(safeMimeType('text/plain;charset=utf-8')).toBe('text/plain')
  for (const t of ['text/html', 'image/svg+xml', 'application/xhtml+xml', 'text/javascript', '', null]) {
    expect(safeMimeType(t)).toBe('application/octet-stream')
  }
})

test('import : une miniature non-image est refusée, les couleurs sont validées', () => {
  const p = normalizePattern({ name: 'x', thumb: 'javascript:alert(1)', pieceColors: { A: '#ff0000', B: 'red; background:url(x)' } })
  expect(p.thumb).toBeNull()
  expect(p.pieceColors).toEqual({ A: '#ff0000' })
})
