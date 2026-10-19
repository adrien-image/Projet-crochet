// Synchronisation par fichier (API File System Access, navigateurs Chromium sur ordinateur) :
// la bibliothèque est enregistrée dans un fichier choisi par l'utilisateur — par exemple dans un
// dossier Dropbox, Google Drive ou iCloud — et relue au démarrage. Aucun serveur.
import type { Pattern } from '../domain/types'
import { kvGet, kvSet } from './assets'
import { exportBackup, readPatternList } from './patterns'
import { cleanDeleted } from './settings'

interface Handle {
  name: string
  getFile(): Promise<File>
  createWritable(): Promise<{ write(data: Blob): Promise<void>, close(): Promise<void> }>
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>
}

type Picker = (o: object) => Promise<Handle>
const picker = (): Picker | null =>
  typeof window !== 'undefined' && 'showSaveFilePicker' in window ? (window as unknown as { showSaveFilePicker: Picker }).showSaveFilePicker : null

export const syncSupported = () => !!picker()

const HANDLE_KEY = 'syncHandle'

export async function getSyncHandle(): Promise<Handle | null> {
  return (await kvGet<Handle>(HANDLE_KEY)) ?? null
}

export async function chooseSyncFile(): Promise<Handle | null> {
  const pick = picker()
  if (!pick) return null
  const handle = await pick({
    suggestedName: 'mon-crochet.json',
    types: [{ description: 'Bibliothèque Mon Crochet', accept: { 'application/json': ['.json'] } }],
  })
  await kvSet(HANDLE_KEY, handle)
  return handle
}

export async function forgetSyncFile(): Promise<void> {
  await kvSet(HANDLE_KEY, undefined)
}

/** `interactive` : peut afficher la demande d'autorisation (nécessite un geste de l'utilisateur). */
export async function hasPermission(handle: Handle, interactive: boolean): Promise<boolean> {
  const opts = { mode: 'readwrite' as const }
  if ((await handle.queryPermission?.(opts)) === 'granted') return true
  if (!interactive) return false
  return (await handle.requestPermission?.(opts)) === 'granted'
}

export interface SyncData {
  patterns: Pattern[]
  deleted: Record<string, string>
  savedAt: string | null
}

export async function readSyncFile(handle: Handle): Promise<SyncData | null> {
  const file = await handle.getFile()
  if (!file.size) return null
  const data = JSON.parse(await file.text())
  const list = Array.isArray(data?.patterns) ? data.patterns : []
  return {
    patterns: await readPatternList(list),
    deleted: cleanDeleted(data?.deleted),
    savedAt: typeof data?.savedAt === 'string' ? data.savedAt : null,
  }
}

/** couvertures et fichiers joints déjà encodés en data: (≈ 40 Mo au plus) */
const encoded = new Map<string, string>()
const MAX_ENCODED = 40_000_000
/** contenu du dernier fichier écrit (hors date), pour ne pas réécrire un fichier identique */
let lastWritten: string | null = null

export async function writeSyncFile(handle: Handle, patterns: Pattern[], deleted: Record<string, string>): Promise<void> {
  // réécrit après chaque modification : sans les photos de galerie et de rang (miniatures seulement),
  // et sans réencoder à chaque fois les couvertures et les PDF joints
  const json = await (await exportBackup(patterns, { photos: false, cache: encoded })).text()
  let size = 0
  for (const [id, d] of [...encoded].reverse()) {
    size += d.length
    if (size > MAX_ENCODED) encoded.delete(id)
  }
  const body = JSON.stringify({ ...JSON.parse(json), deleted })
  if (body === lastWritten) return
  const blob = new Blob([JSON.stringify({ ...JSON.parse(body), savedAt: new Date().toISOString() })], { type: 'application/json' })
  const w = await handle.createWritable()
  await w.write(blob)
  await w.close()
  lastWritten = body
}

/**
 * Fusion « le plus récent gagne » patron par patron ; une suppression plus récente que la
 * dernière modification l'emporte (sur les deux appareils).
 */
export function mergeLibraries(local: Pattern[], remote: Pattern[], localDeleted: Record<string, string>, remoteDeleted: Record<string, string>) {
  const deleted: Record<string, string> = { ...remoteDeleted }
  for (const [id, at] of Object.entries(localDeleted)) if (!deleted[id] || deleted[id] < at) deleted[id] = at
  const byId = new Map<string, Pattern>()
  for (const p of remote) byId.set(p.id, p)
  let changed = false
  for (const p of local) {
    const other = byId.get(p.id)
    if (!other || (p.updatedAt || '') >= (other.updatedAt || '')) byId.set(p.id, p)
  }
  const ordered = [...local.map((p) => byId.get(p.id)!), ...remote.filter((p) => !local.some((l) => l.id === p.id))]
  const patterns = ordered.filter((p) => !(deleted[p.id] && deleted[p.id] >= (p.updatedAt || '')))
  changed = patterns.length !== local.length || patterns.some((p, i) => p !== local[i])
  return { patterns, deleted, changed }
}
