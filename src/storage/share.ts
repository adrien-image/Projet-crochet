// Partage d'un patron : lien autonome (texte compressé dans l'adresse) ou fichier.
import type { Pattern } from '../domain/types'
import { normalizePattern } from './patterns'

/** un lien reste petit ; au-delà, il s'agit d'un lien forgé (bombe de décompression) */
const MAX_CODE = 200_000
const MAX_JSON = 2_000_000

const SHARED_FIELDS = ['name', 'description', 'tags', 'hook', 'yarn', 'notation', 'size', 'text', 'pieceColors', 'placements', 'checklist'] as const

// Champs partagés : le patron lui-même, pas la progression ni les notes personnelles.
function shareable(p: Pattern) {
  return {
    name: p.name, description: p.description, tags: p.tags, hook: p.hook, yarn: p.yarn,
    notation: p.notation, size: p.size, text: p.text, pieceColors: p.pieceColors, placements: p.placements,
    checklist: p.checklist.map((i) => ({ text: i.text })),
  }
}

const toBase64Url = (bytes: Uint8Array) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromBase64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit = Infinity): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel()
      throw new Error('Lien de partage trop volumineux')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

/** Code compact d'un patron, à placer dans un lien (#/partage/<code>). */
export async function encodeShare(p: Pattern): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(shareable(p)))
  if (typeof CompressionStream !== 'undefined') return `z${toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))}`
  return `j${toBase64Url(json)}`
}

export async function decodeShare(code: string): Promise<Pattern> {
  const kind = code[0]
  if ((kind !== 'z' && kind !== 'j') || code.length > MAX_CODE) throw new Error('Lien de partage invalide')
  const bytes = fromBase64Url(code.slice(1))
  const json = kind === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw'), MAX_JSON) : bytes
  const data = JSON.parse(new TextDecoder().decode(json))
  if (!data || typeof data !== 'object' || typeof data.text !== 'string') throw new Error('Lien de partage invalide')
  // seuls les champs d'un partage sont repris (pas de fichier, photo ni progression glissés dans un lien
  // forgé) ; nouveaux identifiants : le patron reçu est une copie indépendante
  const picked: Record<string, unknown> = {}
  for (const k of SHARED_FIELDS) if (k in data) picked[k] = data[k]
  return normalizePattern(picked)
}

/** Lien de partage ; `print` : il ouvre directement la fiche imprimable. */
export function shareUrl(code: string, print = false): string {
  return `${window.location.origin}${window.location.pathname}#/partage/${code}${print ? '/imprimer' : ''}`
}
