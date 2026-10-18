// Moteur 3D minimal (sans dépendance) : chaque section du patron devient une pièce
// de révolution dont le rayon de chaque rang découle de son nombre de mailles.
import { sectionCopies } from './patternParser.js'
import { sectionColor } from './colors.js'

export const STITCH_W = 1 // largeur d'une maille (unités monde)
export const ROW_H = 0.85 // hauteur d'un rang
const SEGMENTS = 32 // résolution angulaire des anneaux

export function groupPieces(rounds) {
  const pieces = []
  for (const r of rounds) {
    if (!r.count) continue
    const last = pieces[pieces.length - 1]
    if (last && last.section === (r.section ?? '')) last.rounds.push(r)
    else pieces.push({ section: r.section ?? '', rounds: [r] })
  }
  return pieces
}

const ringRadius = (count) => (Math.max(count, 1) * STITCH_W) / (2 * Math.PI)

export function pieceMesh(rounds) {
  const vertices = []
  const faces = []
  const radii = rounds.map((r) => ringRadius(r.count))
  radii.forEach((radius, i) => {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = (2 * Math.PI * j) / SEGMENTS
      vertices.push([radius * Math.cos(a), i * ROW_H, radius * Math.sin(a)])
    }
  })
  const at = (ring, j) => ring * SEGMENTS + (j % SEGMENTS)
  // côtés : quads orientés vers l'extérieur
  for (let i = 0; i < radii.length - 1; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      faces.push([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)])
    }
  }
  // fond (anneau magique) et dessus (fermeture)
  const height = (radii.length - 1) * ROW_H
  const bottom = vertices.push([0, 0, 0]) - 1
  const top = vertices.push([0, height, 0]) - 1
  const last = radii.length - 1
  for (let j = 0; j < SEGMENTS; j++) {
    faces.push([bottom, at(0, j), at(0, j + 1)])
    faces.push([top, at(last, j + 1), at(last, j)])
  }
  return { vertices, faces, height, maxR: Math.max(...radii) }
}

export function buildScene(rounds) {
  const meshes = []
  let cursor = 0
  for (const piece of groupPieces(rounds)) {
    const copies = sectionCopies(piece.section)
    const color = sectionColor(piece.section || null)
    for (let c = 0; c < copies; c++) {
      const mesh = pieceMesh(piece.rounds)
      cursor += mesh.maxR
      meshes.push({ ...mesh, color, rgb: hexToRgb(color), section: piece.section, xOffset: cursor })
      cursor += mesh.maxR + 1.2
    }
  }
  if (!meshes.length) return null
  const center = (cursor - 1.2) / 2
  for (const m of meshes) m.xOffset -= center
  const height = Math.max(...meshes.map((m) => m.height), 1)
  const spread = Math.max(...meshes.map((m) => Math.abs(m.xOffset) + m.maxR), 1)
  const maxR = Math.max(...meshes.map((m) => m.maxR))
  return { meshes, height, spread, maxR }
}

function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}

const LIGHT = (() => {
  const l = [-0.45, 0.6, -0.65]
  const n = Math.hypot(...l)
  return l.map((v) => v / n)
})()

/** Dessine la scène. `view` : { yaw, pitch, zoom }. Renvoie le nombre de faces dessinées. */
export function renderScene(ctx, scene, w, h, view) {
  const { yaw, pitch, zoom = 1 } = view
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const rotate = (x, y, z) => {
    const x1 = x * cy + z * sy
    const z1 = -x * sy + z * cy
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp]
  }
  const extent = Math.max(scene.spread * 2, scene.height * 1.2, 4)
  // la scène est plus large que haute : on cadre séparément en largeur et en hauteur
  const scale = Math.min((w * 0.85) / (scene.spread * 2), (h * 0.7) / Math.max(scene.height, scene.maxR * 2, 2)) * zoom
  const dist = extent * 2.5
  const midY = scene.height / 2

  const faces = []
  for (const mesh of scene.meshes) {
    const proj = mesh.vertices.map(([x, y, z]) => {
      const [rx, ry, rz] = rotate(x + mesh.xOffset, y - midY, z)
      const persp = dist / (dist + rz)
      return [w / 2 + rx * scale * persp, h / 2 - ry * scale * persp, rz]
    })
    for (const face of mesh.faces) {
      const p = face.map((i) => proj[i])
      // élimination des faces arrière : aire signée à l'écran (exacte en perspective)
      let area = 0
      for (let i = 0; i < p.length; i++) {
        const a = p[i]
        const b = p[(i + 1) % p.length]
        area += a[0] * b[1] - b[0] * a[1]
      }
      if (area <= 0) continue
      const [v0, v1, v2] = [face[0], face[1], face[2]].map((i) => mesh.vertices[i])
      const u = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]]
      const v = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]]
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      const len = Math.hypot(...n) || 1
      const rn = rotate(n[0] / len, n[1] / len, n[2] / len)
      const diffuse = Math.max(0, rn[0] * LIGHT[0] + rn[1] * LIGHT[1] + rn[2] * LIGHT[2])
      const lum = Math.min(1.08, 0.42 + 0.66 * diffuse)
      let depth = 0
      for (const q of p) depth += q[2]
      faces.push({ p, depth: depth / p.length, rgb: mesh.rgb, lum })
    }
  }
  faces.sort((a, b) => b.depth - a.depth)

  ctx.clearRect(0, 0, w, h)
  ctx.lineWidth = 0.6
  ctx.lineJoin = 'round'
  for (const face of faces) {
    const [r, g, b] = face.rgb.map((c) => Math.min(255, Math.round(c * face.lum)))
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.strokeStyle = ctx.fillStyle
    ctx.beginPath()
    ctx.moveTo(face.p[0][0], face.p[0][1])
    for (let i = 1; i < face.p.length; i++) ctx.lineTo(face.p[i][0], face.p[i][1])
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  return faces.length
}
