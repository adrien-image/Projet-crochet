import { test, expect } from 'vitest'
import { assetIds, duplicatePattern, MAX_GALLERY, needsAssetMigration, normalizePattern } from '../src/storage/patterns'
import { photosOf, setPhotos } from '../src/features/pattern/actions'
import { beePattern, samplePattern } from '../src/storage/samples'
import { parsePattern } from '../src/domain/parser'
import { buildPieces } from '../src/domain/pieces'
import { estimateYarn } from '../src/domain/yarn'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

test('photos : couverture puis galerie, réordonnées et retirées', () => {
  const p = normalizePattern({ imageId: 'a', thumb: null, gallery: [{ id: 'b', thumb: null }, { id: 'c', thumb: null }] })
  expect(photosOf(p).map((x) => x.id)).toEqual(['a', 'b', 'c'])
  const [a, b, c] = photosOf(p)
  const cover = setPhotos(p, [c, a, b])
  expect(cover.imageId).toBe('c')
  expect(cover.gallery.map((g) => g.id)).toEqual(['a', 'b'])
  const none = setPhotos(p, [])
  expect(none.imageId).toBeNull()
  expect(none.gallery).toEqual([])
  expect(photosOf(normalizePattern({}))).toEqual([])
})

test('photos : validation, plafond, fichiers référencés', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `g${i}`, thumb: 'javascript:alert(1)' }))
  const p = normalizePattern({ imageId: 'cover', fileId: 'file', gallery: [...many, { id: 'g1' }, 'nope', { data: 'data:text/html,x' }],
    roundNotes: { k: { text: 'x', photoId: 'note' } } })
  expect(p.gallery.length).toBe(MAX_GALLERY)
  expect(p.gallery.every((g) => g.thumb === null)).toBe(true)
  expect(assetIds(p)).toEqual(expect.arrayContaining(['cover', 'file', 'g0', 'note']))
  expect(needsAssetMigration(p)).toBe(false)
  expect(needsAssetMigration(normalizePattern({ gallery: [{ data: PNG }] }))).toBe(true)
  expect(needsAssetMigration(normalizePattern({ roundNotes: { k: { text: '', photoData: PNG } } }))).toBe(true)
})

test('duplication : de zéro ou avec la progression, photos partagées', () => {
  const src = { ...samplePattern(), imageId: 'img', gallery: [{ id: 'g', thumb: null }], timeSpent: 300, timerStartedAt: new Date().toISOString(),
    roundNotes: { x: { text: 'note', photoId: null, photoThumb: null } }, stitchCounter: 4 }
  const fresh = duplicatePattern(src, false, 'Souris 2')
  expect(fresh.id).not.toBe(src.id)
  expect(fresh.name).toBe('Souris 2')
  expect(fresh.roundsDone).toEqual([])
  expect(fresh.checklist.every((i) => !i.done)).toBe(true)
  expect(fresh.checklist.map((i) => i.text)).toEqual(src.checklist.map((i) => i.text))
  expect(fresh.checklist.some((i, k) => i.id === src.checklist[k].id)).toBe(false)
  expect([fresh.timeSpent, fresh.stitchCounter, fresh.timerStartedAt, fresh.roundNotes]).toEqual([0, 0, null, {}])
  expect(fresh.imageId).toBe('img')
  expect(fresh.gallery).toEqual(src.gallery)
  expect(fresh.gallery).not.toBe(src.gallery)
  const kept = duplicatePattern(src, true, 'Souris bis')
  expect(kept.roundsDone).toEqual(src.roundsDone)
  expect(kept.checklist.map((i) => i.done)).toEqual(src.checklist.map((i) => i.done))
  expect([kept.timeSpent, kept.stitchCounter, kept.timerStartedAt]).toEqual([300, 4, null])
  expect(kept.roundNotes.x.text).toBe('note')
})

test('exemple multicolore : rayures, ailes blanches, fil par couleur', () => {
  const bee = beePattern()
  const rounds = parsePattern(bee.text)
  expect(rounds.every((r) => r.valid !== false && r.fits !== false)).toBe(true)
  const body = rounds.filter((r) => r.section?.startsWith('CORPS')).map((r) => r.color)
  expect(new Set(body.filter(Boolean))).toEqual(new Set(['#2a2a2d', '#e8c34a']))
  const pieces = buildPieces(bee)
  expect(pieces.map((p) => [p.label, p.color, p.copies])).toEqual([['CORPS', '#e8c34a', 1], ['AILES', '#f4f1ea', 2]])
  expect(estimateYarn(bee).byColor.map((c) => c.color).sort()).toEqual(['#2a2a2d', '#e8c34a', '#f4f1ea'])
})
