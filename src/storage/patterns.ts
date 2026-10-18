// Patrons : lecture / écriture dans localStorage, normalisation et migration des anciennes
// données, sauvegarde complète (export / import JSON).
import type { ChecklistItem, Pattern, Placement, Round, RoundNote, WorkSession } from '../domain/types'
import { parsePattern, parseOptions } from '../domain/parser'
import { putAsset, getAssetDataUrl } from './assets'
import { makeThumbnail } from './images'
import { samplePatterns } from './samples'
import { uid } from './util'

export { uid }

const STORAGE_KEY = 'crochet.patterns.v1'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const HEX = /^#[0-9a-f]{6}$/i

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
    thumb: /^data:image\/(?:jpeg|png|webp);/.test(str(p.thumb)) ? p.thumb : null,
    fileId: str(p.fileId) || null,
    fileName: str(p.fileName) || null,
    fileType: str(p.fileType) || null,
  }
  if (p.pieceColors && typeof p.pieceColors === 'object') {
    for (const [k, v] of Object.entries(p.pieceColors)) if (typeof v === 'string' && HEX.test(v)) pattern.pieceColors[k] = v
  }
  if (p.roundNotes && typeof p.roundNotes === 'object') {
    for (const [k, v] of Object.entries(p.roundNotes as Record<string, Partial<RoundNote>>)) {
      if (!v || typeof v !== 'object') continue
      const note: RoundNote = {
        text: str(v.text).slice(0, 4000),
        photoId: str(v.photoId) || null,
        photoThumb: /^data:image\/(?:jpeg|png|webp);/.test(str(v.photoThumb)) ? str(v.photoThumb) : null,
      }
      if (note.text || note.photoId || note.photoThumb) pattern.roundNotes[k] = note
    }
  }
  if (p.placements && typeof p.placements === 'object') {
    const vec = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((x) => Number.isFinite(x))
    for (const [k, v] of Object.entries(p.placements as Record<string, Partial<Placement>>)) {
      if (v && vec(v.point) && vec(v.normal)) pattern.placements[k] = { point: v.point, normal: v.normal }
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

/** Déplace les fichiers encore stockés en data: (ancien format, import) vers IndexedDB. */
export async function migratePatternAssets(p: Pattern): Promise<Partial<Pattern> | null> {
  if (!p.image && !p.fileData) return null
  const patch: Partial<Pattern> = { image: undefined, fileData: undefined }
  if (p.image) {
    patch.imageId = await putAsset(p.image)
    patch.thumb = await makeThumbnail(p.image)
  }
  if (p.fileData) {
    patch.fileId = await putAsset(p.fileData)
    patch.fileType = p.fileData.match(/^data:([^;,]+)/)?.[1] ?? null
  }
  return patch
}

/** Sauvegarde complète : les fichiers sont réintégrés en data: pour être portables. */
export async function exportBackup(patterns: Pattern[]): Promise<Blob> {
  const full = []
  for (const p of patterns) {
    const { imageId, fileId, thumb: _thumb, ...rest } = p
    full.push({
      ...rest,
      image: p.image || (await getAssetDataUrl(imageId)),
      fileData: p.fileData || (await getAssetDataUrl(fileId)),
    })
  }
  return new Blob([JSON.stringify({ app: 'mon-crochet', version: 2, patterns: full }, null, 2)], { type: 'application/json' })
}

/** Lit un fichier de sauvegarde (format d'export, ou simple tableau de patrons). */
export async function importBackup(file: Blob): Promise<Pattern[]> {
  const data = JSON.parse(await file.text())
  const list = Array.isArray(data) ? data : data?.patterns
  if (!Array.isArray(list)) throw new Error('Format de fichier non reconnu')
  return list.filter((p) => p && typeof p === 'object').map(normalizePattern)
}
