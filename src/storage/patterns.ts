// Patrons : lecture / écriture dans localStorage, normalisation et migration des anciennes
// données, sauvegarde complète (export / import JSON).
import type { ChecklistItem, Pattern, PatternPhoto, Placement, Round, RoundNote, WorkSession } from '../domain/types'
import { parsePattern, parseOptions } from '../domain/parser'
import { stopTimer } from '../domain/time'
import { putAsset, getAssetDataUrl } from './assets'
import { makeThumbnail } from './images'
import { samplePatterns } from './samples'
import { uid } from './util'

export { uid }

export const STORAGE_KEY = 'crochet.patterns.v1'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const HEX = /^#[0-9a-f]{6}$/i
/** clés venues d'un fichier ou d'un lien : jamais celles qui modifieraient le prototype de l'objet */
const safeKey = (k: string) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype'
const THUMB = /^data:image\/(?:jpeg|png|webp);/
const IMAGE_DATA = /^data:image\/(?:jpeg|png|webp|gif);/
/** au-delà, les miniatures pèseraient trop dans localStorage */
export const MAX_GALLERY = 24

/**
 * Complète les champs manquants (données anciennes ou importées), vérifie leurs types,
 * sépare la progression des rangs des étapes libres et migre les identifiants « round-{index} ».
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizePattern(p: any): Pattern {
  const now = new Date().toISOString()
  const pattern: Pattern = {
    id: str(p.id) || uid(),
    name: str(p.name).trim() || 'Patron sans nom',
    description: str(p.description),
    tags: Array.isArray(p.tags) ? [...new Set(p.tags.map(String).filter(Boolean))] as string[] : [],
    createdAt: str(p.createdAt) || now,
    updatedAt: str(p.updatedAt) || str(p.createdAt) || now,
    hook: str(p.hook),
    yarn: str(p.yarn),
    notation: p.notation === 'us' || p.notation === 'uk' ? p.notation : 'auto',
    size: Number.isInteger(p.size) && p.size > 0 ? p.size : 0,
    text: str(p.text),
    checklist: [],
    roundsDone: Array.isArray(p.roundsDone) ? p.roundsDone.filter((k: unknown) => typeof k === 'string') : [],
    stitchCounter: Number.isInteger(p.stitchCounter) && p.stitchCounter > 0 ? p.stitchCounter : 0,
    pieceColors: {},
    roundNotes: {},
    placements: {},
    timeSpent: Number.isFinite(p.timeSpent) && p.timeSpent > 0 ? Math.round(p.timeSpent) : 0,
    timerStartedAt: typeof p.timerStartedAt === 'string' && !Number.isNaN(Date.parse(p.timerStartedAt)) ? p.timerStartedAt : null,
    sessions: Array.isArray(p.sessions)
      ? p.sessions.filter((x: WorkSession) => x && typeof x.start === 'string' && Number.isFinite(x.seconds)).slice(-60)
      : [],
    imageId: str(p.imageId) || null,
    // seule une image JPEG/PNG en data: est acceptée comme miniature
    thumb: THUMB.test(str(p.thumb)) ? p.thumb : null,
    gallery: [],
    fileId: str(p.fileId) || null,
    fileName: str(p.fileName) || null,
    fileType: str(p.fileType) || null,
  }
  if (p.pieceColors && typeof p.pieceColors === 'object') {
    for (const [k, v] of Object.entries(p.pieceColors)) if (safeKey(k) && typeof v === 'string' && HEX.test(v)) pattern.pieceColors[k] = v
  }
  if (p.roundNotes && typeof p.roundNotes === 'object') {
    for (const [k, v] of Object.entries(p.roundNotes as Record<string, Partial<RoundNote>>)) {
      if (!safeKey(k) || !v || typeof v !== 'object') continue
      const note: RoundNote = {
        text: str(v.text).slice(0, 4000),
        photoId: str(v.photoId) || null,
        photoThumb: THUMB.test(str(v.photoThumb)) ? str(v.photoThumb) : null,
      }
      if (IMAGE_DATA.test(str(v.photoData))) note.photoData = str(v.photoData)
      if (note.text || note.photoId || note.photoThumb || note.photoData) pattern.roundNotes[k] = note
    }
  }
  if (Array.isArray(p.gallery)) {
    for (const raw of p.gallery as Partial<PatternPhoto>[]) {
      if (!raw || typeof raw !== 'object') continue
      const photo: PatternPhoto = { id: str(raw.id), thumb: THUMB.test(str(raw.thumb)) ? str(raw.thumb) : null }
      if (IMAGE_DATA.test(str(raw.data))) photo.data = str(raw.data)
      if ((photo.id || photo.data || photo.thumb) && !pattern.gallery.some((g) => g.id && g.id === photo.id)) pattern.gallery.push(photo)
    }
    pattern.gallery = pattern.gallery.slice(0, MAX_GALLERY)
  }
  if (p.placements && typeof p.placements === 'object') {
    const vec = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((x) => Number.isFinite(x))
    for (const [k, v] of Object.entries(p.placements as Record<string, Partial<Placement>>)) {
      if (safeKey(k) && v && vec(v.point) && vec(v.normal)) pattern.placements[k] = { point: v.point, normal: v.normal }
    }
  }
  if (str(p.image).startsWith('data:')) pattern.image = p.image
  if (str(p.fileData).startsWith('data:')) pattern.fileData = p.fileData

  const items: unknown[] = Array.isArray(p.checklist) ? p.checklist : []
  let rounds: Round[] | null = null
  const done = new Set(pattern.roundsDone)
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const item: ChecklistItem = { id: str(r.id) || uid(), text: String(r.text ?? ''), done: !!r.done }
    // les rangs cochés étaient auparavant mélangés aux étapes
    if (item.id.startsWith('round-')) {
      const legacy = item.id.match(/^round-(\d+)$/)
      if (legacy) {
        rounds ??= parsePattern(pattern.text, parseOptions(pattern))
        const round = rounds[parseInt(legacy[1], 10)]
        if (round && item.done) done.add(round.key)
      } else if (item.done) done.add(item.id)
      continue
    }
    pattern.checklist.push(item)
  }
  pattern.roundsDone = [...done]
  return pattern
}

export function loadPatterns(): Pattern[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data)) return data.filter((p) => p && typeof p === 'object').map(normalizePattern)
    }
  } catch {
    // stockage corrompu ou inaccessible : on repart des exemples
  }
  const initial = samplePatterns()
  savePatterns(initial)
  return initial
}

/** @returns false si le navigateur a refusé l'écriture (quota dépassé…) */
export function savePatterns(patterns: Pattern[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns))
    return true
  } catch {
    return false
  }
}

/** Fichiers (IndexedDB) utilisés par un patron : couverture, photos, fichier joint, photos de rangs. */
export function assetIds(p: Pattern): string[] {
  const ids = [p.imageId, p.fileId, ...p.gallery.map((g) => g.id), ...Object.values(p.roundNotes).map((n) => n.photoId)]
  return ids.filter((id): id is string => !!id)
}

/** Des fichiers sont-ils encore en data: (ancien format, import) ? */
export const needsAssetMigration = (p: Pattern) => !!p.image || !!p.fileData
  || p.gallery.some((g) => g.data) || Object.values(p.roundNotes).some((n) => n.photoData)

/**
 * Copie d'un patron, à reprendre de zéro ou avec la progression actuelle. Les photos et le
 * fichier joint sont partagés (les fichiers ne sont supprimés que quand plus aucun patron ne les utilise).
 */
export function duplicatePattern(p: Pattern, keepProgress: boolean, name: string, nowMs = Date.now()): Pattern {
  const now = new Date(nowMs).toISOString()
  // la séance en cours compte dans le temps passé de la copie
  const base = keepProgress ? stopTimer(p, nowMs) : p
  const copy: Pattern = {
    ...structuredClone(base),
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    timerStartedAt: null,
  }
  copy.checklist = copy.checklist.map((i) => ({ ...i, id: uid(), done: keepProgress && i.done }))
  if (!keepProgress) {
    copy.roundsDone = []
    copy.stitchCounter = 0
    copy.timeSpent = 0
    copy.sessions = []
    copy.roundNotes = {}
  }
  return copy
}

/** data: → fichier enregistré dans IndexedDB (et sa miniature), ou null s'il est illisible */
export type StoredAssets = Map<string, { id: string, thumb: string | null } | null>

/** Enregistre dans IndexedDB les fichiers encore en data: (ancien format, import, synchronisation). */
export async function storeInlineAssets(p: Pattern): Promise<StoredAssets | null> {
  if (!needsAssetMigration(p)) return null
  const stored: StoredAssets = new Map()
  const put = async (data: string, thumbSize: number | null) => {
    if (stored.has(data)) return
    try {
      stored.set(data, { id: await putAsset(data), thumb: thumbSize ? await makeThumbnail(data, thumbSize) : null })
    } catch {
      // base64 abîmé, encodage invalide : seul ce fichier est abandonné, pas tout l'import
      stored.set(data, null)
    }
  }
  if (p.image) await put(p.image, 320)
  if (p.fileData) await put(p.fileData, null)
  for (const g of p.gallery) if (g.data) await put(g.data, 240)
  for (const n of Object.values(p.roundNotes)) if (n.photoData) await put(n.photoData, 200)
  return stored
}

/**
 * Remplace les data: déjà enregistrés par leurs identifiants, sur l'état actuel du patron :
 * ce que l'utilisateur a modifié pendant l'enregistrement (photo ajoutée, note…) est conservé.
 */
export function applyStoredAssets(p: Pattern, stored: StoredAssets): Pattern {
  // `null` : fichier illisible, retiré (sinon la migration recommencerait à chaque démarrage)
  const next: Pattern = { ...p }
  const cover = p.image ? stored.get(p.image) : undefined
  if (cover) Object.assign(next, { imageId: cover.id, thumb: cover.thumb ?? p.thumb, image: undefined })
  else if (cover === null) next.image = undefined
  const file = p.fileData ? stored.get(p.fileData) : undefined
  if (file) Object.assign(next, { fileId: file.id, fileType: p.fileData!.match(/^data:([^;,]+)/)?.[1] ?? p.fileType, fileData: undefined })
  else if (file === null) Object.assign(next, { fileData: undefined, fileName: null, fileType: null })
  next.gallery = p.gallery.flatMap((g) => {
    const s = g.data ? stored.get(g.data) : undefined
    if (s === null) return g.thumb ? [{ id: '', thumb: g.thumb }] : []
    return [s ? { id: s.id, thumb: g.thumb ?? s.thumb } : g]
  })
  next.roundNotes = Object.fromEntries(Object.entries(p.roundNotes).map(([k, n]) => {
    const s = n.photoData ? stored.get(n.photoData) : undefined
    if (s === undefined) return [k, n]
    const { photoData: _data, ...note } = n
    return [k, s ? { ...note, photoId: s.id, photoThumb: note.photoThumb ?? s.thumb } : note]
  }))
  return next
}

async function withStoredAssets(p: Pattern): Promise<Pattern> {
  const stored = await storeInlineAssets(p)
  return stored ? applyStoredAssets(p, stored) : p
}

/**
 * Sauvegarde complète : les fichiers sont réintégrés en data: pour être portables.
 * `photos: false` (synchronisation, réécrite à chaque modification) : la galerie et les photos de
 * rang ne gardent que leurs miniatures ; seules la couverture et le fichier joint sont inclus.
 */
export async function exportBackup(patterns: Pattern[], { photos = true, cache }: { photos?: boolean, cache?: Map<string, string> } = {}): Promise<Blob> {
  // fichiers déjà encodés (synchronisation) : leurs identifiants sont tirés du contenu, ils ne changent pas
  const dataUrl = async (id: string | null | undefined) => {
    if (!id) return null
    const known = cache?.get(id)
    if (known) return known
    const d = await getAssetDataUrl(id)
    if (d && cache) cache.set(id, d)
    return d
  }
  const full = []
  for (const p of patterns) {
    const { imageId, fileId, thumb: _thumb, ...rest } = p
    let gallery: PatternPhoto[] = p.gallery
    let roundNotes: Record<string, RoundNote> = p.roundNotes
    if (photos) {
      gallery = []
      for (const g of p.gallery) {
        const data = g.data || (await getAssetDataUrl(g.id))
        if (data) gallery.push({ id: '', thumb: g.thumb, data })
        else if (g.thumb) gallery.push({ id: '', thumb: g.thumb })
      }
      roundNotes = {}
      for (const [k, n] of Object.entries(p.roundNotes)) {
        const data = n.photoData || (await getAssetDataUrl(n.photoId))
        roundNotes[k] = { ...n, photoId: null, ...(data ? { photoData: data } : {}) }
      }
    }
    full.push({
      ...rest,
      ...(photos ? {} : { thumb: p.thumb }),
      gallery,
      roundNotes,
      image: p.image || (await dataUrl(imageId)),
      fileData: p.fileData || (await dataUrl(fileId)),
    })
  }
  return new Blob([JSON.stringify({ app: 'mon-crochet', version: 2, patterns: full }, null, 2)], { type: 'application/json' })
}

/** Lit un fichier de sauvegarde (format d'export, ou simple tableau de patrons). */
export async function importBackup(file: Blob): Promise<Pattern[]> {
  const data = JSON.parse(await file.text())
  const list = Array.isArray(data) ? data : data?.patterns
  if (!Array.isArray(list)) throw new Error('Format de fichier non reconnu')
  // fichiers enregistrés avant d'entrer dans la bibliothèque : localStorage ne reçoit jamais les photos en data:
  const patterns = []
  for (const p of list.filter((x) => x && typeof x === 'object').map(normalizePattern)) patterns.push(await withStoredAssets(p))
  return patterns
}

/** Patrons d'un fichier de synchronisation, fichiers enregistrés dans IndexedDB. */
export async function readPatternList(list: unknown[]): Promise<Pattern[]> {
  const patterns = []
  for (const p of list.filter((x) => x && typeof x === 'object').map(normalizePattern)) patterns.push(await withStoredAssets(p))
  return patterns
}
