// Moteur 3D minimal (sans dépendance) : chaque section du patron devient une pièce
// de révolution dont le rayon de chaque rang découle de son nombre de mailles.
import { sectionCopies } from './patternParser.js'
import { sectionColor } from './colors.js'

export const STITCH_W = 1 // largeur d'une maille (unités monde)
export const ROW_H = 0.85 // hauteur d'un rang
const SEGMENTS = 32 // résolution angulaire des anneaux

/** Regroupe les rangs par pièce (une section « suite du … » prolonge la précédente). */
export function groupPieces(rounds) {
  const pieces = []
  for (const r of rounds) {
    if (!r.count) continue
    const last = pieces[pieces.length - 1]
    if (last && last.piece === r.piece) last.rounds.push(r)
    else pieces.push({ piece: r.piece, section: r.section ?? '', rounds: [r] })
  }
  return pieces
}

// Au-delà de ce nombre de mailles au dernier rang, la pièce est considérée ouverte
// (pas de « couvercle » ; l'intérieur est dessiné).
const OPEN_ABOVE = 12

const ringRadius = (count) => (Math.max(count, 1) * STITCH_W) / (2 * Math.PI)

// Lissage léger : les augmentations/diminutions sont réparties dans le tricot réel,
// sans ce lissage un rang sur deux formerait une « marche ».
function smooth(radii) {
  if (radii.length < 3) return radii
  return radii.map((r, i) => (i === 0 || i === radii.length - 1 ? r : 0.25 * radii[i - 1] + 0.5 * r + 0.25 * radii[i + 1]))
}

// Chaque rang est une bande de tissu de hauteur ~constante mesurée le long de la surface :
// quand le rayon change beaucoup (6 augmentations par rang), la bande s'incline et monte peu
// — c'est pour cela qu'un rond de mailles serrées à 6 augmentations par rang reste presque plat.
// La pente est un peu adoucie pour évoquer la forme une fois bourrée.
const SLANT = ROW_H * 1.3
function ringHeights(radii) {
  const heights = [0]
  for (let i = 1; i < radii.length; i++) {
    const dr = radii[i] - radii[i - 1]
    const dy = Math.sqrt(Math.max(SLANT * SLANT - dr * dr, (SLANT * 0.3) ** 2)) * (ROW_H / SLANT)
    heights.push(heights[i - 1] + dy)
  }
  return heights
}

export function pieceMesh(rounds) {
  const flatCount = rounds.filter((r) => r.flat).length
  if (flatCount > rounds.length / 2) return flatMesh(rounds)
  const vertices = []
  const faces = []
  const radii = smooth(rounds.map((r) => ringRadius(r.count)))
  const heights = ringHeights(radii)
  radii.forEach((radius, i) => {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = (2 * Math.PI * j) / SEGMENTS
      vertices.push([radius * Math.cos(a), heights[i], radius * Math.sin(a)])
    }
  })
  const at = (ring, j) => ring * SEGMENTS + (j % SEGMENTS)
  // côtés : quads orientés vers l'extérieur
  for (let i = 0; i < radii.length - 1; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      faces.push([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)])
    }
  }
  // fond (anneau magique) et dessus (fermeture) ; une pièce ouverte reste ouverte
  const height = heights[heights.length - 1]
  const last = radii.length - 1
  const open = rounds[last].count > OPEN_ABOVE
  const bottom = vertices.push([0, 0, 0]) - 1
  for (let j = 0; j < SEGMENTS; j++) faces.push([bottom, at(0, j), at(0, j + 1)])
  if (!open) {
    const top = vertices.push([0, height, 0]) - 1
    for (let j = 0; j < SEGMENTS; j++) faces.push([top, at(last, j + 1), at(last, j)])
  }
  return { vertices, faces, height, maxR: Math.max(...radii), doubleSided: open }
}

/** Travail à plat : un panneau dont chaque rang est une bande de la largeur de ses mailles. */
function flatMesh(rounds) {
  const COLS = 12
  const vertices = []
  const faces = []
  const widths = rounds.map((r) => Math.max(r.count, 1) * STITCH_W)
  widths.forEach((w, i) => {
    for (let j = 0; j <= COLS; j++) vertices.push([-w / 2 + (w * j) / COLS, i * ROW_H, 0])
  })
  const at = (i, j) => i * (COLS + 1) + j
  for (let i = 0; i < rounds.length - 1; i++) {
    for (let j = 0; j < COLS; j++) faces.push([at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j)])
  }
  if (rounds.length === 1) {
    // un seul rang : bande d'une hauteur de rang
    for (let j = 0; j <= COLS; j++) vertices.push([-widths[0] / 2 + (widths[0] * j) / COLS, ROW_H, 0])
    for (let j = 0; j < COLS; j++) faces.push([at(0, j), at(0, j + 1), at(1, j + 1), at(1, j)])
  }
  const height = Math.max(rounds.length - 1, 1) * ROW_H
  return { vertices, faces, height, maxR: Math.max(...widths) / 2, doubleSided: true }
}

export function buildScene(rounds) {
  const meshes = []
  let cursor = 0
  for (const piece of groupPieces(rounds)) {
    const copies = sectionCopies(piece.section)
    const color = sectionColor(piece.section || null)
    const names = [...new Set(piece.rounds.map((r) => (r.section ?? '').replace(/\s*[(—–-].*$/, '').trim()))]
    const label = names.filter(Boolean).join(' + ') || 'Pièce'
    const flatPanel = piece.rounds.filter((r) => r.flat).length > piece.rounds.length / 2
    for (let c = 0; c < copies; c++) {
      const mesh = pieceMesh(piece.rounds)
      cursor += mesh.maxR
      meshes.push({ ...mesh, flatPanel, color, rgb: hexToRgb(color), section: piece.section, label, xOffset: cursor })
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
      const back = area <= 0
      if (back && !mesh.doubleSided) continue
      const [v0, v1, v2] = [face[0], face[1], face[2]].map((i) => mesh.vertices[i])
      const u = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]]
      const v = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]]
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      const len = Math.hypot(...n) || 1
      const flip = back ? -1 : 1
      const rn = rotate((flip * n[0]) / len, (flip * n[1]) / len, (flip * n[2]) / len)
      const diffuse = Math.max(0, rn[0] * LIGHT[0] + rn[1] * LIGHT[1] + rn[2] * LIGHT[2])
      // l'intérieur d'une pièce ouverte est plus sombre
      const lum = Math.min(1.08, 0.42 + 0.66 * diffuse) * (back && !mesh.flatPanel ? 0.62 : 1)
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
