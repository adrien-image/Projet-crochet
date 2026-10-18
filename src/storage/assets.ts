// Fichiers volumineux (images, PDF) stockés dans IndexedDB plutôt que dans localStorage
// (~5 Mo). Repli en mémoire quand IndexedDB est indisponible (tests, navigation privée stricte).

const DB_NAME = 'mon-crochet'
const STORE = 'assets'
/** petites valeurs non sérialisables en JSON (poignée du fichier de synchronisation…) */
const KV = 'kv'

let dbPromise: Promise<IDBDatabase | null> | null = null
const memory = new Map<string, Blob>()
const urlCache = new Map<string, string>()
/** fichiers enregistrés pendant cette session : jamais supprimés par le ménage (ils ne sont peut-être pas encore rattachés à un patron) */
const sessionIds = new Set<string>()

// Seuls ces types sont servis tels quels : un fichier HTML ou SVG ouvert depuis une URL blob:
// s'exécuterait avec l'origine de l'application (accès aux données). Le reste est téléchargé.
const SAFE_TYPES = /^(?:application\/pdf|image\/(?:png|jpeg|gif|webp|avif|bmp)|text\/plain)$/

export function safeMimeType(type: string | null | undefined): string {
  const t = (type || '').toLowerCase().split(';')[0].trim()
  return SAFE_TYPES.test(t) ? t : 'application/octet-stream'
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const req = indexedDB.open(DB_NAME, 2)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
        if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>, storeName = STORE): Promise<T | undefined> {
  const db = await openDb()
  if (!db) return undefined
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(storeName, mode).objectStore(storeName))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Convertit une URL data: en Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body = ''] = dataUrl.split(',')
  const mime = head.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream'
  const bytes = head.includes(';base64') ? atob(body) : decodeURIComponent(body)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`
}

/** Identifiant tiré du contenu : réimporter la même photo (sauvegarde, synchronisation) ne la duplique pas. */
async function contentId(blob: Blob): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))
    return `h_${[...digest.subarray(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return null
  }
}

/** Enregistre un fichier (Blob ou URL data:) et renvoie son identifiant. */
export async function putAsset(data: Blob | string): Promise<string> {
  const blob = typeof data === 'string' ? dataUrlToBlob(data) : data
  const id = (await contentId(blob)) ?? `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  sessionIds.add(id)
  const stored = await run('readwrite', (s) => s.put(blob, id)).then(() => true, () => false)
  if (!stored || !(await openDb())) memory.set(id, blob)
  return id
}

export async function getAsset(id: string): Promise<Blob | null> {
  if (memory.has(id)) return memory.get(id) ?? null
  const blob = await run('readonly', (s) => s.get(id)).catch(() => undefined)
  return blob instanceof Blob ? blob : null
}

/** URL blob: affichable (mise en cache pour la session), avec un type de contenu sûr. */
export async function getAssetUrl(id: string | null | undefined): Promise<string | null> {
  if (!id) return null
  const cached = urlCache.get(id)
  if (cached) return cached
  const blob = await getAsset(id)
  if (!blob) return null
  const url = URL.createObjectURL(new Blob([blob], { type: safeMimeType(blob.type) }))
  urlCache.set(id, url)
  return url
}

export async function getAssetDataUrl(id: string | null | undefined): Promise<string | null> {
  const blob = id ? await getAsset(id) : null
  return blob ? blobToDataUrl(blob) : null
}

/** Supprime les fichiers qui ne sont plus référencés par aucun patron. */
export async function collectGarbage(keep: Set<string>): Promise<void> {
  const unused = (id: string) => !keep.has(id) && !sessionIds.has(id)
  for (const id of [...memory.keys()]) if (unused(id)) memory.delete(id)
  const ids = await run('readonly', (s) => s.getAllKeys()).catch(() => undefined)
  for (const id of ids || []) {
    if (typeof id === 'string' && unused(id)) await run('readwrite', (s) => s.delete(id)).catch(() => undefined)
  }
}

const kvMemory = new Map<string, unknown>()

export async function kvGet<T>(key: string): Promise<T | undefined> {
  if (kvMemory.has(key)) return kvMemory.get(key) as T
  return (await run<T>('readonly', (st) => st.get(key) as IDBRequest<T>, KV).catch(() => undefined))
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const ok = await run<unknown>('readwrite', (st) => (value === undefined ? st.delete(key) : st.put(value, key)) as IDBRequest<unknown>, KV).then(() => true, () => false)
  if (!ok || !(await openDb())) {
    if (value === undefined) kvMemory.delete(key)
    else kvMemory.set(key, value)
  }
}
