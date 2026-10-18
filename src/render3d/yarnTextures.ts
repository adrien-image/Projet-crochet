// Textures procédurales de tissu au crochet : une tuile = une maille (largeur) × un rang (hauteur).
// On calcule une carte de hauteur de brins de fil torsadés, puis une carte de normales (relief)
// et une carte d'ombrage (creux plus sombres) qui module la couleur du fil.
import * as THREE from 'three'

// h : hauteur relative du brin (les brins de l'arrière-plan sont plus bas)
type Strand = { ax: number, ay: number, bx: number, by: number, r: number, h?: number }

interface Tile {
  size: number
  strands: Strand[]
  /** nombre de torsades le long d'un brin */
  twists: number
}

// Maille serrée vue de face : un « V » formé de deux jambes de fil qui se rejoignent en bas.
const SC_TILE: Tile = {
  size: 128,
  twists: 4.5,
  strands: [
    // les deux jambes du V, légèrement bombées (deux segments chacune)
    { ax: 0.48, ay: 0.9, bx: 0.3, by: 0.52, r: 0.22 },
    { ax: 0.3, ay: 0.52, bx: 0.2, by: 0.12, r: 0.21 },
    { ax: 0.52, ay: 0.9, bx: 0.7, by: 0.52, r: 0.22 },
    { ax: 0.7, ay: 0.52, bx: 0.8, by: 0.12, r: 0.21 },
    // brin du haut de la maille (tête), en retrait
    { ax: -0.02, ay: 0.02, bx: 1.02, by: 0.02, r: 0.11, h: 0.7 },
    // brins visibles entre les mailles, au fond
    { ax: 0.5, ay: 0.12, bx: 0.5, by: 0.62, r: 0.12, h: 0.42 },
    { ax: 0.0, ay: 0.55, bx: 0.0, by: 1.05, r: 0.12, h: 0.42 },
  ],
}

// Chaînette : maillons ovales alignés le long de u.
const CHAIN_TILE: Tile = {
  size: 128,
  twists: 3,
  strands: [
    { ax: 0.08, ay: 0.5, bx: 0.5, by: 0.18, r: 0.16 },
    { ax: 0.5, ay: 0.18, bx: 0.92, by: 0.5, r: 0.16 },
    { ax: 0.08, ay: 0.5, bx: 0.5, by: 0.82, r: 0.16 },
    { ax: 0.5, ay: 0.82, bx: 0.92, by: 0.5, r: 0.16 },
  ],
}

/** Hauteur (0..1) du fil au point (x, y) de la tuile, en tenant compte des tuiles voisines. */
function heightAt(tile: Tile, x: number, y: number): number {
  let best = 0
  for (const s of tile.strands) {
    const dx = s.bx - s.ax
    const dy = s.by - s.ay
    const len2 = dx * dx + dy * dy
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const px = x + ox - s.ax
        const py = y + oy - s.ay
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2))
        const ex = px - t * dx
        const ey = py - t * dy
        const d = Math.sqrt(ex * ex + ey * ey) / s.r
        if (d >= 1) continue
        // section ronde du brin, plus épaisse au milieu, torsade en diagonale
        const side = (ex * -dy + ey * dx) / Math.sqrt(len2) / s.r
        const twist = 0.86 + 0.14 * Math.cos(2 * Math.PI * (t * tile.twists + side * 0.55))
        const h = Math.sqrt(1 - d * d) * (0.82 + 0.18 * Math.sin(Math.PI * t)) * twist * (s.h ?? 1)
        if (h > best) best = h
      }
    }
  }
  return best
}

// bruit pseudo-aléatoire stable (fibres)
function noise(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function makeMaps(tile: Tile): { shade: HTMLCanvasElement, normal: HTMLCanvasElement } {
  const n = tile.size
  const h = new Float32Array(n * n)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = heightAt(tile, (x + 0.5) / n, (y + 0.5) / n)
  const at = (x: number, y: number) => h[((y + n) % n) * n + ((x + n) % n)]

  const shade = document.createElement('canvas')
  const normal = document.createElement('canvas')
  shade.width = shade.height = normal.width = normal.height = n
  const sctx = shade.getContext('2d')
  const nctx = normal.getContext('2d')
  if (!sctx || !nctx) return { shade, normal }
  const simg = sctx.createImageData(n, n)
  const nimg = nctx.createImageData(n, n)
  const strength = 2.6
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x
      const v = h[i]
      const fiber = (noise(i) - 0.5) * 0.07
      // creux sombres (occlusion), brins clairs
      const g = Math.round(255 * Math.max(0, Math.min(1, 0.3 + 0.7 * Math.pow(v, 0.55) + fiber)))
      simg.data.set([g, g, g, 255], i * 4)
      // normale (convention OpenGL ; la texture est retournée verticalement par three.js)
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      nimg.data.set([
        Math.round(((-dx / len) * 0.5 + 0.5) * 255),
        Math.round(((dy / len) * 0.5 + 0.5) * 255),
        Math.round(((1 / len) * 0.5 + 0.5) * 255),
        255,
      ], i * 4)
    }
  }
  sctx.putImageData(simg, 0, 0)
  nctx.putImageData(nimg, 0, 0)
  return { shade, normal }
}

export interface YarnMaps {
  map: THREE.Texture
  normalMap: THREE.Texture
}

const cache = new Map<string, YarnMaps>()

function maps(kind: 'stitch' | 'chain', anisotropy: number): YarnMaps {
  const key = `${kind}:${anisotropy}`
  const hit = cache.get(key)
  if (hit) return hit
  const { shade, normal } = makeMaps(kind === 'stitch' ? SC_TILE : CHAIN_TILE)
  const map = new THREE.CanvasTexture(shade)
  map.colorSpace = THREE.SRGBColorSpace
  const normalMap = new THREE.CanvasTexture(normal)
  for (const t of [map, normalMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = anisotropy
    t.needsUpdate = true
  }
  const out = { map, normalMap }
  cache.set(key, out)
  return out
}

export const stitchMaps = (anisotropy = 4) => maps('stitch', anisotropy)
export const chainMaps = (anisotropy = 4) => maps('chain', anisotropy)

export function disposeYarnMaps(): void {
  for (const m of cache.values()) {
    m.map.dispose()
    m.normalMap.dispose()
  }
  cache.clear()
}

/** Hauteur exposée pour les tests. */
export const __test = { heightAt, SC_TILE }
