// Modifications d'un patron (fonctions pures, appliquées via `update`).
import type { ChecklistItem, Pattern, Placement, RoundNote } from '../../domain/types'
import { MAX_GALLERY } from '../../storage/patterns'

export type Update = (fn: (p: Pattern) => Pattern) => void

export function setRoundsDone(p: Pattern, keys: string[], done: boolean): Pattern {
  const set = new Set(p.roundsDone)
  for (const k of keys) {
    if (done) set.add(k)
    else set.delete(k)
  }
  return { ...p, roundsDone: [...set] }
}

export function setChecklist(p: Pattern, fn: (l: ChecklistItem[]) => ChecklistItem[]): Pattern {
  return { ...p, checklist: fn(p.checklist) }
}

export function setStitchCounter(p: Pattern, n: number): Pattern {
  return { ...p, stitchCounter: Math.max(0, n) }
}

/** `null` efface la note. */
export function setRoundNote(p: Pattern, key: string, note: RoundNote | null): Pattern {
  const roundNotes = { ...p.roundNotes }
  if (!note || (!note.text.trim() && !note.photoId)) delete roundNotes[key]
  else roundNotes[key] = note
  return { ...p, roundNotes }
}

/** `label === '*'` remet toutes les couleurs ; `color === null` remet celle d'une pièce. */
export function setPieceColor(p: Pattern, label: string, color: string | null): Pattern {
  if (label === '*') return { ...p, pieceColors: {} }
  const pieceColors = { ...p.pieceColors }
  if (color) pieceColors[label] = color
  else delete pieceColors[label]
  return { ...p, pieceColors }
}

/** `key === '*'` efface tous les placements manuels. */
export function setPlacement(p: Pattern, key: string, placement: Placement | null): Pattern {
  if (key === '*') return { ...p, placements: {} }
  const placements = { ...p.placements }
  if (placement) placements[key] = placement
  else delete placements[key]
  return { ...p, placements }
}

/** Photo de l'ouvrage, couverture comprise (`image` / `data` : ancien format ou import, pas encore migré). */
export interface PhotoRef {
  id: string | null
  thumb: string | null
  image?: string | null
  data?: string
}

/** Toutes les photos de l'ouvrage, la couverture en premier. */
export function photosOf(p: Pattern): PhotoRef[] {
  const cover: PhotoRef[] = p.imageId || p.image || p.thumb ? [{ id: p.imageId, thumb: p.thumb, image: p.image ?? null }] : []
  return [...cover, ...p.gallery.map((g) => ({ id: g.id || null, thumb: g.thumb, data: g.data }))]
}

/** Range les photos : la première devient la couverture, les autres la galerie. */
export function setPhotos(p: Pattern, list: PhotoRef[]): Pattern {
  const [cover, ...rest] = list
  return {
    ...p,
    imageId: cover?.id ?? null,
    thumb: cover?.thumb ?? null,
    image: cover?.image ?? cover?.data ?? undefined,
    gallery: rest.slice(0, MAX_GALLERY).map((r) => {
      const data = r.data ?? r.image ?? undefined
      return { id: r.id ?? '', thumb: r.thumb, ...(data ? { data } : {}) }
    }),
  }
}
