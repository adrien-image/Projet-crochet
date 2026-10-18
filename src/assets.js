// @ts-check
// Fichiers volumineux (images, PDF) stockés dans IndexedDB plutôt que dans localStorage
// (~5 Mo). Repli en mémoire quand IndexedDB est indisponible (tests, navigation privée stricte).

const DB_NAME = 'mon-crochet'
const STORE = 'assets'

/** @type {Promise<IDBDatabase | null> | null} */
let dbPromise = null
/** @type {Map<string, Blob>} */
const memory = new Map()
/** @type {Map<string, string>} */
const urlCache = new Map()

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

/**
 * @template T
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => IDBRequest<T>} fn
 * @returns {Promise<T | undefined>}
 */
async function run(mode, fn) {
  const db = await openDb()
  if (!db) return undefined
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Convertit une URL data: en Blob. @param {string} dataUrl */
export function dataUrlToBlob(dataUrl) {
  const [head, body = ''] = dataUrl.split(',')
  const mime = head.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream'
  const bytes = head.includes(';base64') ? atob(body) : decodeURIComponent(body)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/** @param {Blob} blob @returns {Promise<string>} */
export async function blobToDataUrl(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`
}

/**
 * Enregistre un fichier et renvoie son identifiant.
 * @param {Blob | string} data Blob ou URL data:
 */
export async function putAsset(data) {
  const blob = typeof data === 'string' ? dataUrlToBlob(data) : data
  const id = `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  const stored = await run('readwrite', (s) => s.put(blob, id)).then(() => true, () => false)
  if (!stored || !(await openDb())) memory.set(id, blob)
  return id
}

/** @param {string} id @returns {Promise<Blob | null>} */
export async function getAsset(id) {
  if (memory.has(id)) return memory.get(id) ?? null
  const blob = await run('readonly', (s) => s.get(id)).catch(() => undefined)
  return blob instanceof Blob ? blob : null
}

/** URL blob: affichable (mise en cache pour la session). @param {string | null | undefined} id */
export async function getAssetUrl(id) {
  if (!id) return null
  const cached = urlCache.get(id)
  if (cached) return cached
  const blob = await getAsset(id)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urlCache.set(id, url)
  return url
}

/** @param {string | null | undefined} id */
export async function getAssetDataUrl(id) {
  const blob = id ? await getAsset(id) : null
  return blob ? blobToDataUrl(blob) : null
}

/** Supprime les fichiers qui ne sont plus référencés par aucun patron. @param {Set<string>} keep */
export async function collectGarbage(keep) {
  for (const id of [...memory.keys()]) if (!keep.has(id)) memory.delete(id)
  const ids = await run('readonly', (s) => s.getAllKeys()).catch(() => undefined)
  for (const id of ids || []) {
    if (typeof id === 'string' && !keep.has(id)) await run('readwrite', (s) => s.delete(id)).catch(() => undefined)
  }
}
