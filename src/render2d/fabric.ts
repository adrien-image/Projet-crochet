// Rendu « tissu » d'une pièce : chaque rang est une rangée de vraies mailles de fil (brins bombés,
// torsadés, ombrés), du premier rang en bas au dernier en haut — la pièce telle qu'elle apparaît
// une fois dépliée. La largeur de chaque rang suit son nombre de mailles.
import type { Round, StitchType } from '../domain/types'
import { shade } from '../domain/colors'

export interface FabricRow {
  round: Round
  index: number
  x: number
  y: number
  w: number
  h: number
}

export interface FabricLayout {
  width: number
  height: number
  unit: number
  margin: number
  rows: FabricRow[]
}

const HEIGHT: Record<StitchType, number> = {
  sc: 0.92, inc: 0.92, dec: 0.92, inc3: 0.92, dec3: 0.92, hdc: 1.25, dc: 1.65, tr: 2.2, sl: 0.55, ch: 0.6,
}
const WIDTH: Partial<Record<StitchType, number>> = { inc: 2, inc3: 3 }
const STRUCTURAL = new Set<StitchType>(['ch', 'sl'])

function visibleStitches(round: Round): StitchType[] {
  const real = round.stitches.filter((s) => !STRUCTURAL.has(s))
  return real.length ? real : round.stitches
}

function rowFactor(stitches: StitchType[]): number {
  if (!stitches.length) return HEIGHT.sc
  return stitches.reduce((m, s) => Math.max(m, HEIGHT[s]), 0)
}

export function layoutFabric(rounds: Round[], maxWidth: number, opts: { maxUnit?: number, margin?: number, align?: 'center' | 'left' } = {}): FabricLayout {
  const margin = opts.margin ?? 40
  const widths = rounds.map((r) => Math.max(visibleStitches(r).reduce((n, s) => n + (WIDTH[s] ?? 1), 0), 1))
  const maxCount = Math.max(1, ...widths)
  const unit = Math.max(4, Math.min(opts.maxUnit ?? 22, (maxWidth - margin * 2) / maxCount))
  const inner = maxCount * unit
  let y = 0
  const rows: FabricRow[] = []
  // du dernier rang (haut) au premier (bas)
  const heights = rounds.map((r) => rowFactor(visibleStitches(r)) * unit)
  const total = heights.reduce((a, b) => a + b, 0)
  y = margin * 0.5 + total
  rounds.forEach((round, i) => {
    const h = heights[i]
    y -= h
    const w = widths[i] * unit
    const x = margin + (opts.align === 'left' ? 0 : (inner - w) / 2)
    rows.push({ round, index: i, x, y, w, h })
  })
  return { width: inner + margin * 2, height: total + margin, unit, margin, rows }
}

// --- dessin d'un brin de fil -------------------------------------------------

type Pt = [number, number]

function bezier(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]
}

interface Palette { base: string, dark: string, deep: string, light: string, ply: string }

function palette(color: string): Palette {
  return { base: color, dark: shade(color, 0.8), deep: shade(color, 0.58), light: shade(color, 1.5), ply: shade(color, 0.86) }
}

/** Un brin bombé : ombre, corps, reflet, puis les torsades du fil en travers. */
function strand(ctx: CanvasRenderingContext2D, a: Pt, c: Pt, b: Pt, width: number, pal: Palette) {
  const path = () => {
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.quadraticCurveTo(c[0], c[1], b[0], b[1])
  }
  ctx.lineCap = 'round'
  ctx.save()
  ctx.translate(width * 0.04, width * 0.12)
  path()
  ctx.strokeStyle = pal.deep
  ctx.globalAlpha *= 0.55
  ctx.lineWidth = width * 1.05
  ctx.stroke()
  ctx.restore()
  path()
  ctx.strokeStyle = pal.dark
  ctx.lineWidth = width
  ctx.stroke()
  path()
  ctx.strokeStyle = pal.base
  ctx.lineWidth = width * 0.8
  ctx.stroke()
  ctx.save()
  ctx.translate(-width * 0.14, -width * 0.12)
  path()
  ctx.strokeStyle = pal.light
  ctx.globalAlpha *= 0.55
  ctx.lineWidth = width * 0.26
  ctx.stroke()
  ctx.restore()
  // torsades : petits traits obliques le long du brin
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const n = Math.max(2, Math.round(len / (width * 0.62)))
  ctx.strokeStyle = pal.ply
  ctx.lineWidth = Math.max(0.6, width * 0.1)
  ctx.lineCap = 'butt'
  for (let i = 1; i < n; i++) {
    const t = i / n
    const p = bezier(a, c, b, t)
    const q = bezier(a, c, b, Math.min(1, t + 0.01))
    const tx = q[0] - p[0]
    const ty = q[1] - p[1]
    const tl = Math.hypot(tx, ty) || 1
    const nx = -ty / tl
    const ny = tx / tl
    const r = width * 0.36
    // trait en travers, incliné dans le sens de la torsion
    ctx.beginPath()
    ctx.moveTo(p[0] + nx * r - (tx / tl) * r * 0.5, p[1] + ny * r - (ty / tl) * r * 0.5)
    ctx.lineTo(p[0] - nx * r + (tx / tl) * r * 0.5, p[1] - ny * r + (ty / tl) * r * 0.5)
    ctx.stroke()
  }
  ctx.lineCap = 'round'
}

/** Une maille « en V » (ms, db, br…) : deux jambes partant de `base` vers le haut. */
function vStitch(ctx: CanvasRenderingContext2D, base: Pt, topY: number, cx: number, u: number, pal: Palette, wraps: number, spread = 0.31) {
  const w = u * 0.36
  const lt: Pt = [cx - u * spread, topY + w * 0.12]
  const rt: Pt = [cx + u * spread, topY + w * 0.12]
  const midY = (base[1] + topY) / 2
  strand(ctx, [base[0] - u * 0.04, base[1]], [cx - u * 0.24, midY], lt, w, pal)
  strand(ctx, [base[0] + u * 0.04, base[1]], [cx + u * 0.24, midY], rt, w, pal)
  // jetés des brides : brins en travers du pied de la maille
  for (let k = 0; k < wraps; k++) {
    const y = base[1] - (base[1] - topY) * (0.42 + k * 0.2)
    strand(ctx, [cx - u * 0.3, y + u * 0.08], [cx, y - u * 0.05], [cx + u * 0.3, y - u * 0.1], w * 0.62, pal)
  }
}

function drawStitch(ctx: CanvasRenderingContext2D, type: StitchType, x: number, row: FabricRow, u: number, pal: Palette) {
  const bottom = row.y + row.h
  const top = row.y
  const wraps = type === 'dc' ? 1 : type === 'tr' ? 2 : 0
  if (type === 'inc' || type === 'inc3') {
    // plusieurs mailles dans une même base : les V s'ouvrent en éventail
    const n = type === 'inc' ? 2 : 3
    const base: Pt = [x + (n * u) / 2, bottom - u * 0.04]
    for (let k = 0; k < n; k++) vStitch(ctx, base, top, x + u * (k + 0.5), u, pal, 0, 0.27)
    return
  }
  if (type === 'dec' || type === 'dec3') {
    // jambes écartées en bas, réunies en une seule maille
    const cx = x + u / 2
    const w = u * 0.4
    const spread = type === 'dec' ? 0.55 : 0.85
    const tl: Pt = [cx - u * 0.3, top + w * 0.45]
    const tr: Pt = [cx + u * 0.3, top + w * 0.45]
    strand(ctx, [cx - u * spread, bottom - u * 0.1], [cx - u * 0.45, (top + bottom) / 2], tl, w, pal)
    strand(ctx, [cx + u * spread, bottom - u * 0.1], [cx + u * 0.45, (top + bottom) / 2], tr, w, pal)
    if (type === 'dec3') strand(ctx, [cx, bottom - u * 0.1], [cx, (top + bottom) / 2], [cx, top + w * 0.5], w * 0.9, pal)
    return
  }
  if (type === 'ch') {
    const cx = x + u / 2
    const cy = (top + bottom) / 2
    const w = u * 0.24
    strand(ctx, [x + u * 0.12, cy], [cx, cy - u * 0.5], [x + u * 0.88, cy], w, pal)
    strand(ctx, [x + u * 0.12, cy], [cx, cy + u * 0.5], [x + u * 0.88, cy], w, pal)
    return
  }
  if (type === 'sl') {
    const cy = (top + bottom) / 2
    strand(ctx, [x + u * 0.15, cy], [x + u / 2, cy - u * 0.22], [x + u * 0.85, cy], u * 0.28, pal)
    return
  }
  vStitch(ctx, [x + u / 2, bottom - u * 0.04], top, x + u / 2, u, pal, wraps)
  if (type === 'hdc') {
    // demi-bride : le brin du jeté passe en travers
    strand(ctx, [x + u * 0.18, top + (bottom - top) * 0.52], [x + u / 2, top + (bottom - top) * 0.44], [x + u * 0.82, top + (bottom - top) * 0.52], u * 0.24, pal)
  }
}

export interface FabricStyle {
  color: string
  done?: Set<string>
  /** estomper les rangs non terminés */
  showProgress?: boolean
  activeKey?: string | null
  labels?: boolean
  /** couleur du texte et du contour actif */
  ink?: string
  accent?: string
}

export function drawFabric(ctx: CanvasRenderingContext2D, layout: FabricLayout, style: FabricStyle): void {
  // une palette par couleur de fil (changements de couleur d'un rang à l'autre)
  const palettes = new Map<string, Palette>()
  const paletteFor = (c: string) => {
    let p = palettes.get(c)
    if (!p) {
      p = palette(c)
      palettes.set(c, p)
    }
    return p
  }
  const u = layout.unit
  const anyDone = !!style.done && layout.rows.some((r) => style.done?.has(r.round.key))
  for (const row of layout.rows) {
    const faded = style.showProgress && anyDone && !style.done?.has(row.round.key)
    ctx.save()
    ctx.globalAlpha = faded ? 0.3 : 1
    // fond du tissu : les creux entre les mailles laissent voir l'envers, plus sombre
    const pal = paletteFor(row.round.color ?? style.color)
    ctx.fillStyle = pal.deep
    ctx.globalAlpha *= 0.7
    const r = Math.min(u * 0.35, row.h / 2)
    ctx.beginPath()
    ctx.roundRect(row.x + u * 0.12, row.y + row.h * 0.05, row.w - u * 0.24, row.h * 0.95, r)
    ctx.fill()
    ctx.globalAlpha = faded ? 0.3 : 1
    let x = row.x
    for (const s of visibleStitches(row.round)) {
      drawStitch(ctx, s, x, row, u, pal)
      x += (WIDTH[s] ?? 1) * u
    }
    ctx.restore()
  }
  if (style.labels) {
    ctx.font = `600 ${Math.max(10, Math.min(13, u * 0.7))}px system-ui, sans-serif`
    ctx.textBaseline = 'middle'
    for (const row of layout.rows) {
      const active = row.round.key === style.activeKey
      const n = row.round.number
      if (!active && n !== 1 && n % 5 !== 0 && row.index !== layout.rows.length - 1) continue
      ctx.fillStyle = active ? (style.accent ?? '#c2683c') : (style.ink ?? '#7d6f61')
      ctx.textAlign = 'right'
      ctx.fillText(row.round.label, row.x - 8, row.y + row.h / 2)
    }
  }
  const active = layout.rows.find((r) => r.round.key === style.activeKey)
  if (active) {
    ctx.save()
    ctx.strokeStyle = style.accent ?? '#c2683c'
    ctx.lineWidth = 2.5
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.roundRect(active.x - 4, active.y - 2, active.w + 8, active.h + 4, 8)
    ctx.stroke()
    ctx.restore()
  }
}

/** Rang sous le point (x, y) du canvas (coordonnées CSS). */
export function hitRow(layout: FabricLayout, x: number, y: number): FabricRow | null {
  return layout.rows.find((r) => y >= r.y && y <= r.y + r.h && x >= r.x - 30 && x <= r.x + r.w + 10) ?? null
}
