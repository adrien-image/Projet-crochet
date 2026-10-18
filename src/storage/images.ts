// Réduction des images avant stockage, et miniatures pour la grille.
import { fileToDataUrl } from './util'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = src
  })
}

async function resize(src: string, maxSize: number, type: string, quality = 0.82): Promise<string> {
  const img = await loadImage(src)
  const w = img.naturalWidth || img.width || maxSize
  const h = img.naturalHeight || img.height || maxSize
  const scale = Math.min(1, maxSize / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return src
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(type, quality)
}

/** Miniature JPEG légère (gardée dans localStorage pour afficher la grille instantanément). */
export async function makeThumbnail(dataUrl: string, maxSize = 320): Promise<string | null> {
  if (typeof document === 'undefined') return null
  try {
    return await resize(dataUrl, maxSize, 'image/jpeg', 0.72)
  } catch {
    return null
  }
}

/**
 * Réduit une image (max `maxSize` px) avant de la stocker. Les SVG sont convertis en PNG :
 * ils peuvent contenir du script et ne doivent jamais être servis tels quels.
 */
export async function compressImage(file: File, maxSize = 1600): Promise<string> {
  const dataUrl = await fileToDataUrl(file)
  if (file.type === 'image/gif') return dataUrl
  const svg = file.type === 'image/svg+xml'
  try {
    const out = await resize(dataUrl, maxSize, file.type === 'image/png' || svg ? 'image/png' : 'image/jpeg')
    return svg || out.length < dataUrl.length ? out : dataUrl
  } catch {
    if (svg) throw new Error('SVG illisible')
    return dataUrl
  }
}
