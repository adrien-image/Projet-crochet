// Géométries three.js à partir du modèle : surfaces de révolution, panneaux, cordons.
// Les coordonnées de texture sont en « mailles » (u) et en « rangs » (v) : la tuile de texture
// d'une maille se répète donc exactement une fois par maille du patron.
import * as THREE from 'three'
import type { Part, Ring, Vec3 } from './model'

const SEGMENTS = 96

export function latheGeometry(rings: Ring[]): THREE.BufferGeometry {
  // Chaque bande entre deux anneaux a ses propres sommets : la texture y compte les mailles du rang
  // supérieur, ce qui évite le cisaillement des colonnes de mailles quand le compte change.
  const cols = SEGMENTS + 1
  const bands = Math.max(rings.length - 1, 0)
  const pos = new Float32Array(bands * 2 * cols * 3)
  const nor = new Float32Array(bands * 2 * cols * 3)
  const uv = new Float32Array(bands * 2 * cols * 2)
  const index: number[] = []
  for (let i = 0; i < bands; i++) {
    const count = Math.max(1, Math.round(rings[i + 1].count))
    for (let side = 0; side < 2; side++) {
      const ring = rings[i + side]
      for (let j = 0; j < cols; j++) {
        const a = (j / SEGMENTS) * Math.PI * 2
        const sn = Math.sin(a)
        const c = Math.cos(a)
        const k = (i * 2 + side) * cols + j
        pos.set([ring.r * sn, ring.y, ring.r * c], k * 3)
        nor.set([ring.nr * sn, ring.ny, ring.nr * c], k * 3)
        // les mailles avancent dans le sens inverse des aiguilles d'une montre
        uv.set([(1 - j / SEGMENTS) * count, ring.row], k * 2)
      }
    }
    for (let j = 0; j < SEGMENTS; j++) {
      const a = i * 2 * cols + j
      const b = a + cols
      index.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(index)
  return g
}

export function panelGeometry(rows: { w: number, y: number, count: number }[]): THREE.BufferGeometry {
  const list = rows.length === 1 ? [rows[0], { ...rows[0], y: rows[0].y + 0.9 }] : rows
  const cols = Math.max(2, Math.max(...list.map((r) => r.count))) + 1
  const pos = new Float32Array(list.length * cols * 3)
  const uv = new Float32Array(list.length * cols * 2)
  list.forEach((row, i) => {
    for (let j = 0; j < cols; j++) {
      const f = j / (cols - 1)
      const k = i * cols + j
      const x = -row.w / 2 + f * row.w
      // léger drapé : un tissu à plat n'est jamais parfaitement rigide
      const z = 0.55 * Math.sin(x / 5.5) + 0.35 * Math.sin(row.y / 4.2 + x / 9)
      pos.set([x, row.y, z], k * 3)
      uv.set([f * row.count, i], k * 2)
    }
  })
  const index: number[] = []
  for (let i = 0; i < list.length - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j
      const b = a + cols
      index.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

export function cordGeometry(points: Vec3[], radius: number, stitches: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
  const g = new THREE.TubeGeometry(curve, Math.max(32, stitches * 3), radius, 12, false)
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * stitches, uv.getY(i))
  // bouts arrondis
  return g
}

export function partBounds(part: Part): number {
  if (part.kind === 'lathe') return Math.max(...part.rings.map((r) => r.r))
  if (part.kind === 'panel') return Math.max(...part.rows.map((r) => r.w)) / 2
  if (part.kind === 'bead') return part.radius
  return part.radius
}
