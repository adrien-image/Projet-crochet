import { test, expect } from 'vitest'
import { applyStoredAssets, assetIds, duplicatePattern, exportBackup, importBackup, MAX_GALLERY, needsAssetMigration, normalizePattern, storeInlineAssets } from '../src/storage/patterns'
import { collectGarbage, getAsset, putAsset } from '../src/storage/assets'
import { photosOf, setPhotos } from '../src/features/pattern/actions'
import { beePattern, samplePattern } from '../src/storage/samples'
import { colorLegend, headingColor, parsePattern } from '../src/domain/parser'
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


test('migration : appliquée à l\'état actuel, les modifications faites entre-temps sont gardées', async () => {
  const before = normalizePattern({ gallery: [{ data: PNG }], roundNotes: { k: { text: 'avant', photoData: PNG } } })
  const stored = (await storeInlineAssets(before))!
  // pendant l'enregistrement : une photo ajoutée, la note modifiée
  const current = { ...before, gallery: [...before.gallery, { id: 'new', thumb: null }], roundNotes: { k: { ...before.roundNotes.k, text: 'après' } } }
  const after = applyStoredAssets(current, stored)
  expect(after.gallery.map((g) => [!!g.id, !!g.data])).toEqual([[true, false], [true, false]])
  expect(after.gallery[1].id).toBe('new')
  expect(after.roundNotes.k.text).toBe('après')
  expect(after.roundNotes.k.photoId).toBe(after.gallery[0].id)
  expect(after.roundNotes.k.photoData).toBeUndefined()
  expect(needsAssetMigration(after)).toBe(false)
})

test('fichiers : identifiant tiré du contenu, jamais supprimés pendant la session qui les a créés', async () => {
  const a = await putAsset(PNG)
  expect(await putAsset(PNG)).toBe(a)
  expect(a).toMatch(/^h_[0-9a-f]{32}$/)
  await collectGarbage(new Set())
  expect(await getAsset(a)).not.toBeNull()
})

test('duplication : la séance de chronomètre en cours est comptée', () => {
  const t0 = Date.parse('2026-05-01T10:00:00Z')
  const src = { ...normalizePattern({ timeSpent: 60 }), timerStartedAt: new Date(t0).toISOString() }
  const copy = duplicatePattern(src, true, 'x', t0 + 30 * 60e3)
  expect(copy.timeSpent).toBe(60 + 30 * 60)
  expect(copy.timerStartedAt).toBeNull()
  expect(copy.sessions.length).toBe(1)
  expect(duplicatePattern(src, false, 'y', t0 + 30 * 60e3).timeSpent).toBe(0)
})

test('photos : une couverture sans fichier (miniature seule) reste dans la galerie après rechargement', () => {
  const p = normalizePattern({ thumb: PNG.replace('png', 'jpeg') })
  const [legacy] = photosOf(p)
  const moved = setPhotos(p, [{ id: 'new', thumb: null }, legacy])
  expect(normalizePattern(JSON.parse(JSON.stringify(moved))).gallery.length).toBe(1)
})

test('couleurs : référence de légende dans un titre en majuscules, « mc » reste une maille', () => {
  const legend = colorLegend('Couleur C : blanc\nMC: grey')
  expect(headingColor('AILES (X2, COULEUR C)', legend)).toBe('#f4f1ea')
  expect(headingColor('BODY (MC)', legend)).toBe('#9b9a9c')
  expect(parsePattern('MC: grey\nCORPS\nR1 : 6 mc dans la boucle (6)')[0].color).toBeNull()
})

test('sauvegarde : import sans data: dans la bibliothèque, synchronisation sans les grandes photos', async () => {
  const imported = await importBackup(new Blob([JSON.stringify({ patterns: [{ name: 'i', gallery: [{ data: PNG }], roundNotes: { k: { text: '', photoData: PNG } } }] })]))
  expect(needsAssetMigration(imported[0])).toBe(false)
  expect(imported[0].gallery[0].id).toBeTruthy()
  const p = normalizePattern({ gallery: [{ id: imported[0].gallery[0].id, thumb: null }], roundNotes: { k: { text: 'n', photoId: imported[0].gallery[0].id } } })
  const full = JSON.parse(await (await exportBackup([p])).text()).patterns[0]
  expect(full.gallery[0].data).toMatch(/^data:image\/png/)
  expect(full.roundNotes.k.photoData).toMatch(/^data:image\/png/)
  const light = JSON.parse(await (await exportBackup([p], { photos: false })).text()).patterns[0]
  expect(light.gallery[0]).toEqual({ id: p.gallery[0].id, thumb: null })
  expect(light.roundNotes.k.photoData).toBeUndefined()
  expect(light.roundNotes.k.photoId).toBe(p.gallery[0].id)
})
