import { useEffect, useMemo, useRef } from 'react'
import { parsePattern, stitchCount } from './patternParser'

const STITCH_W = 1
const ROW_H = 0.85
const PIECE_COLORS = ['#c2703d', '#7a9a65', '#5b7fa6', '#a65b7f', '#a68f5b']

function groupPieces(rounds) {
  const pieces = []
  let cur = []
  let lastSection
  for (const r of rounds) {
    const sec = r.section ?? ''
    if (cur.length && sec !== lastSection) {
      pieces.push(cur)
      cur = []
    }
    cur.push(r)
    lastSection = sec
  }
  if (cur.length) pieces.push(cur)
  return pieces
}

function pieceMesh(rounds, xOffset, color) {
  const rings = rounds.map((r) => {
    const n = Math.max(stitchCount(r.stitches), 1)
    return { n, radius: (n * STITCH_W) / (2 * Math.PI) }
  })
  const vertices = []
  const ringsIdx = []
  rings.forEach((ring, i) => {
    const start = vertices.length
    const y = i * ROW_H
    for (let j = 0; j < ring.n; j++) {
      const a = (2 * Math.PI * j) / ring.n
      vertices.push([ring.radius * Math.cos(a), y, ring.radius * Math.sin(a)])
    }
    ringsIdx.push({ start, n: ring.n })
  })
  const faces = []
  for (let i = 0; i < rings.length - 1; i++) {
    const A = ringsIdx[i]
    const B = ringsIdx[i + 1]
    for (let j = 0; j < A.n; j++) {
      const j2 = Math.floor((j * B.n) / A.n)
      const j2b = Math.floor(((j + 1) * B.n) / A.n)
      faces.push([A.start + j, A.start + ((j + 1) % A.n), B.start + (j2b % B.n), B.start + j2])
    }
  }
  const bottom = vertices.length
  vertices.push([0, 0, 0])
  const A0 = ringsIdx[0]
  for (let j = 0; j < A0.n; j++) faces.push([bottom, A0.start + ((j + 1) % A0.n), A0.start + j])
  const top = vertices.length
  vertices.push([0, (rings.length - 1) * ROW_H, 0])
  const At = ringsIdx[ringsIdx.length - 1]
  for (let j = 0; j < At.n; j++) faces.push([top, At.start + j, At.start + ((j + 1) % At.n)])

  const maxR = Math.max(...rings.map((r) => r.radius))
  return { vertices, faces, color, xOffset, height: (rings.length - 1) * ROW_H, maxR }
}

function buildScene(rounds) {
  const groups = groupPieces(rounds)
  const meshes = []
  let xCursor = 0
  const maxRs = []
  groups.forEach((g, i) => {
    const maxR = Math.max(...g.map((r) => (Math.max(stitchCount(r.stitches), 1) * STITCH_W) / (2 * Math.PI)))
    maxRs.push(maxR)
    xCursor += maxR
    meshes.push(pieceMesh(g, xCursor, PIECE_COLORS[i % PIECE_COLORS.length]))
    xCursor += maxR + 1
  })
  const center = xCursor / 2
  for (const m of meshes) m.xOffset -= center
  const height = Math.max(...meshes.map((m) => m.height), 1)
  const spread = Math.max(...meshes.map((m) => Math.abs(m.xOffset) + m.maxR), 1)
  return { meshes, height, spread }
}

function render(ctx, scene, w, h, yaw, pitch) {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const rotate = (v) => {
    const [x, y, z] = v
    const x1 = x * cy + z * sy
    const z1 = -x * sy + z * cy
    const y1 = y * cp - z1 * sp
    const z2 = y * sp + z1 * cp
    return [x1, y1, z2]
  }
  const scale = (Math.min(w, h) * 0.72) / Math.max(scene.spread * 2, scene.height * 1.15)
  const f = 6
  const project = (v) => {
    const [x, y, z] = rotate(v)
    const persp = f / (f + z / scale / 4)
    return [w / 2 + x * scale * persp, h * 0.62 - y * scale * persp, z]
  }

  const light = [0.45, 0.7, 0.55]
  const faces = []
  for (const mesh of scene.meshes) {
    const pts = mesh.vertices.map((v) => [v[0] + mesh.xOffset, v[1], v[2]])
    const proj = pts.map(project)
    for ( const face of mesh.faces) {
      const idx = face.map((i) => pts[i])
      const u = [idx[1][0] - idx[0][0], idx[1][1] - idx[0][1], idx[1][2] - idx[0][2]]
      const v = [idx[2][0] - idx[0][0], idx[2][1] - idx[0][1], idx[2][2] - idx[0][2]]
      let nx = u[1] * v[2] - u[2] * v[1]
      let ny = u[2] * v[0] - u[0] * v[2]
      let nz = u[0] * v[1] - u[1] * v[0]
      const len = Math.hypot(nx, ny, nz) || 1
      nx /= len
      ny /= len
      nz /= len
      const rn = rotate([nx, ny, nz])
      if (rn[2] > 0) continue
      const lum = Math.max(0.25, Math.min(1, 0.55 + 0.45 * (nx * light[0] + ny * light[1] + nz * light[2])))
      const p = face.map((i) => proj[i])
      const depth = (p[0][2] + p[1][2] + p[2][2]) / 3
      faces.push({ p, depth, color: mesh.color, lum })
    }
  }
  faces.sort((a, b) => b.depth - a.depth)

  ctx.clearRect(0, 0, w, h)
  for (const face of faces) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(face.color.slice(i, i + 2), 16))
    const shade = (c) => Math.round(c * face.lum)
    ctx.fillStyle = `rgb(${shade(r)},${shade(g)},${shade(b)})`
    ctx.beginPath()
    ctx.moveTo(face.p[0][0], face.p[0][1])
    for (let i = 1; i < face.p.length; i++) ctx.lineTo(face.p[i][0], face.p[i][1])
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = ctx.fillStyle
    ctx.lineWidth = 0.5
    ctx.stroke()
  }
}

export default function Amigurumi3D({ pattern }) {
  const canvasRef = useRef(null)
  const state = useRef({ yaw: 0.5, pitch: 0.35, dragging: false, lastX: 0, lastY: 0, auto: true })

  const scene = useMemo(() => {
    const rounds = parsePattern(pattern.text)
    return rounds.length ? buildScene(rounds) : null
  }, [pattern.text])

  useEffect(() => {
    if (!scene || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf
    let last = performance.now()

    const draw = (now) => {
      const dt = (now - last) / 1000
      last = now
      const s = state.current
      if (s.auto && !s.dragging) s.yaw += dt * 0.4
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      render(ctx, scene, w, h, s.yaw, s.pitch)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    const down = (e) => {
      const s = state.current
      s.dragging = true
      s.auto = false
      s.lastX = e.clientX
      s.lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const move = (e) => {
      const s = state.current
      if (!s.dragging) return
      s.yaw += (e.clientX - s.lastX) * 0.01
      s.pitch = Math.max(-1.4, Math.min(1.4, s.pitch + (e.clientY - s.lastY) * 0.01))
      s.lastX = e.clientX
      s.lastY = e.clientY
    }
    const up = () => { state.current.dragging = false }

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
    }
  }, [scene])

  if (!scene) {
    return (
      <div className="empty">
        <div className="big">🧶</div>
        Aucun rang détecté — le rendu 3D nécessite un patron au format « R1 : 6 ms ».
      </div>
    )
  }

  return (
    <div className="viz-3d">
      <canvas ref={canvasRef} className="canvas-3d" />
      <p className="hint-3d">🖱️ Glissez pour tourner · chaque section est une pièce distincte</p>
    </div>
  )
}
