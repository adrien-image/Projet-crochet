// Partage d'un patron : lien autonome (texte compressé dans l'adresse) ou fichier.
import type { Pattern } from '../domain/types'
import { normalizePattern } from './patterns'

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

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

/** Code compact d'un patron, à placer dans un lien (#/partage/<code>). */
export async function encodeShare(p: Pattern): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(shareable(p)))
  if (typeof CompressionStream !== 'undefined') return `z${toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))}`
  return `j${toBase64Url(json)}`
}

export async function decodeShare(code: string): Promise<Pattern> {
  const kind = code[0]
  const bytes = fromBase64Url(code.slice(1))
  const json = kind === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes
  const data = JSON.parse(new TextDecoder().decode(json))
  if (!data || typeof data !== 'object' || typeof data.text !== 'string') throw new Error('Lien de partage invalide')
  // nouveaux identifiants : le patron reçu est une copie indépendante
  return normalizePattern({ ...data, id: undefined, createdAt: undefined, updatedAt: undefined, roundsDone: [] })
}

export function shareUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/partage/${code}`
}
