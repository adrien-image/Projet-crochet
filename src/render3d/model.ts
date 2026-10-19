// Modèle 3D d'un patron, indépendant de three.js (testable) :
// 1. chaque pièce en rond devient une surface de révolution dont le profil découle des comptes
//    de mailles (rayon = circonférence / 2π) et de la hauteur des mailles, tendue par le rembourrage ;
// 2. les pièces sont assemblées selon leur nom (oreilles sur la tête, jambes dessous, queue derrière…),
//    ou présentées côte à côte.
import type { Round, StitchType } from '../domain/types'
import { rowsFor, type CordPiece, type Details, type Piece } from '../domain/pieces'
import { DEFAULT_YARN } from '../domain/colors'

export type Vec3 = [number, number, number]

export interface Transform {
  position: Vec3
  /** angles d'Euler (ordre XYZ, radians) */
  rotation: Vec3
  scale: Vec3
}

export interface Ring {
  /** rayon */
  r: number
  /** hauteur le long de l'axe */
  y: number
  /** nombre de mailles (pour le motif de mailles) */
  count: number
  /** coordonnée de rang (pour le motif de mailles) */
  row: number
  /** couleur du rang si le patron change de fil (sinon couleur de la pièce) */
  color: string | null
  /** composantes radiale / axiale de la normale du profil */
  nr: number
  ny: number
}

export type Part =
  | { kind: 'lathe', id: string, label: string, color: string, rings: Ring[], open: boolean, transform: Transform }
  /** curve : rayon autour duquel le panneau est courbé (pièce plate cousue sur un corps) ; puff : coussin rembourré */
  | { kind: 'panel', id: string, label: string, color: string, rows: { w: number, y: number, count: number, color: string | null }[], transform: Transform, curve?: number, puff?: { top: string, bottom: string, thickness: number } }
  | { kind: 'cord', id: string, label: string, color: string, points: Vec3[], radius: number, stitches: number }
  | { kind: 'bead', id: string, label: string, color: string, radius: number, position: Vec3, glossy: boolean, squash: number }

export interface Model {
  parts: Part[]
  /** pièce principale de l'assemblage (sur laquelle les autres sont posées) */
  mainLabel?: string
  /** pièces que l'on peut placer à la main */
  placeable: { label: string, copies: number }[]
  /** boîte englobante approximative */
  min: Vec3
  max: Vec3
}

export interface ModelOptions {
  assembled: boolean
  /** placements manuels (« libellé#exemplaire » → point d'attache), prioritaires sur l'estimation */
  placements?: Record<string, { point: Vec3, normal: Vec3 }>
  /** nombre de rangs construits (dans l'ordre du patron) ; Infinity = tout */
  upTo?: number
}

// Dimensions d'une maille (largeur = 1). Une maille serrée est presque carrée : c'est pourquoi
// 6 augmentations par rang (rayon +6/2π ≈ 0,95 par rang) donnent un disque presque plat.
const STITCH_HEIGHT: Record<StitchType, number> = {
  sc: 0.9, inc: 0.9, dec: 0.9, inc3: 0.9, dec3: 0.9, hdc: 1.25, dc: 1.7, tr: 2.3, sl: 0.45, ch: 0.6,
}
const CHAIN_LENGTH = 0.62
const STUFFING_STRETCH = 1.16

function rowHeight(round: Round): number {
  const real = round.stitches.filter((s) => s !== 'ch' && s !== 'sl')
  const list = real.length ? real : round.stitches
  if (!list.length) return STITCH_HEIGHT.sc
  return list.reduce((sum, s) => sum + STITCH_HEIGHT[s], 0) / list.length
}

function smooth(values: number[], passes: number): number[] {
  let v = values
  for (let p = 0; p < passes; p++) {
    v = v.map((x, i) => (i === 0 || i === v.length - 1 ? x : 0.25 * v[i - 1] + 0.5 * x + 0.25 * v[i + 1]))
  }
  return v
}

/**
 * Lissage du profil (r, y) comme une courbe : sous la pression du rembourrage, les angles
 * du tissu (passage des augmentations à la partie droite…) s'arrondissent.
 */
function inflate(rs: number[], ys: number[], passes: number): [number[], number[]] {
  let r = rs
  let y = ys
  for (let p = 0; p < passes; p++) {
    const nr = r.slice()
    const ny = y.slice()
    for (let i = 1; i < r.length - 1; i++) {
      nr[i] = 0.25 * r[i - 1] + 0.5 * r[i] + 0.25 * r[i + 1]
      ny[i] = 0.25 * y[i - 1] + 0.5 * y[i] + 0.25 * y[i + 1]
    }
    // le lissage « rétrécit » la courbe : on rend le volume en regonflant légèrement
    const before = Math.max(...r)
    const after = Math.max(...nr) || 1
    r = nr.map((v, i) => (i === 0 || i === nr.length - 1 ? v : v * Math.min(1.04, before / after)))
    y = ny
  }
  return [r, y]
}

/** Profil d'une pièce en rond : anneaux (rayon, hauteur), avec dômes aux extrémités fermées. */
export function latheProfile(rounds: Round[], options: { stuffed: boolean, closeStart: boolean, closeEnd: boolean, flatStart?: boolean }): Ring[] {
  const raw = rounds.map((r) => Math.max(r.count, 1) / (2 * Math.PI))
  // pièce crochetée autour d'autres pièces : son bord de départ se resserre sous elles
  if (options.flatStart && raw.length > 2) {
    raw[0] *= 0.8
    raw[1] *= 0.93
  }
  const radii = smooth(raw, options.stuffed ? 2 : 1)
  const ys = [0]
  for (let i = 1; i < rounds.length; i++) {
    const L = rowHeight(rounds[i]) * (options.stuffed ? STUFFING_STRETCH : 1)
    const dr = radii[i] - radii[i - 1]
    ys.push(ys[i - 1] + Math.sqrt(Math.max(L * L - dr * dr, (0.22 * L) ** 2)))
  }
  const [rr, yy] = radii.length > 2 ? inflate(radii, ys, options.stuffed ? 4 : 1) : [radii, ys]
  const rings: Omit<Ring, 'nr' | 'ny'>[] = rr.map((r, i) => ({ r, y: yy[i], count: rounds[i].count, row: i, color: rounds[i].color ?? null }))

  // extrémités fermées : un petit dôme (anneau magique, fermeture « en coulissant le fil »)
  const DOME = 4
  if (options.closeStart) {
    const r0 = rings[0].r
    const cap = []
    for (let k = DOME; k >= 1; k--) {
      const a = (k / DOME) * (Math.PI / 2)
      const depth = options.flatStart ? (options.stuffed ? 0.35 : 0.06) : 0.55
      cap.push({ r: r0 * Math.cos(a), y: -r0 * depth * Math.sin(a), count: Math.max(rings[0].count * Math.cos(a), 1), row: -k / DOME, color: rings[0].color })
    }
    rings.unshift(...cap)
  }
  if (options.closeEnd) {
    const last = rings[rings.length - 1]
    for (let k = 1; k <= DOME; k++) {
      const a = (k / DOME) * (Math.PI / 2)
      rings.push({ r: last.r * Math.cos(a), y: last.y + last.r * 0.55 * Math.sin(a), count: Math.max(last.count * Math.cos(a), 1), row: last.row + k / DOME, color: last.color })
    }
  }

  // normales du profil (dérivée centrée) : lissage parfait, sans couture
  return rings.map((ring, i) => {
    const a = rings[Math.max(i - 1, 0)]
    const b = rings[Math.min(i + 1, rings.length - 1)]
    const dr = b.r - a.r
    const dy = b.y - a.y
    const len = Math.hypot(dr, dy) || 1
    return { ...ring, nr: dy / len, ny: -dr / len }
  })
}

const KIND_RULES: [PieceKind, RegExp][] = [
  ['ear', /\b(?:oreilles?|ears?)\b/i],
  ['arm', /\b(?:bras|arms?|pattes?\s+avant|front\s+legs?|mains?|hands?)\b/i],
  ['leg', /\b(?:jambes?|legs?|pieds?|feet|foot|pattes?|paws?)\b/i],
  ['tail', /\b(?:queue|tail)\b/i],
  ['wing', /\b(?:ailes?|wings?)\b/i],
  ['spike', /\b(?:spikes?|picots?|pics?|piquants?|cr[êe]tes?|crests?|[ée]cailles?|scales?|plaques?\s+dorsales?|dorsal\s+plates?)\b/i],
  ['head', /\b(?:t[êe]tes?|heads?)\b/i],
  ['body', /\b(?:corps|body|torse|torso)\b/i],
  ['muzzle', /\b(?:museau|snout|muzzle|nez|nose|bec|beak)\b/i],
]
const HAT = /\b(?:bonnet|chapeau|b[ée]ret|hat|beanie|cap|cagoule|balaclava)\b/i
type PieceKind = 'ear' | 'arm' | 'leg' | 'tail' | 'wing' | 'spike' | 'head' | 'body' | 'muzzle' | 'other'

export function pieceKind(label: string): PieceKind {
  // pour « MUSEAU + CORPS », le corps l'emporte
  if (/\b(?:corps|body)\b/i.test(label)) return 'body'
  return KIND_RULES.find(([, re]) => re.test(label))?.[0] ?? 'other'
}

interface Built {
  piece: Piece
  /** pièce ouverte au bout (ouverte par patron, ou pas encore terminée) */
  open: boolean
  rings: Ring[]
  /** rayon du premier rang réel (hors dôme de fermeture) */
  startR: number
  length: number
  maxR: number
  volume: number
}

// Profils mémorisés : les rangs (objets du cache du parseur) servent de clé, ce qui permet à
// l'affichage de réutiliser les géométries des pièces inchangées (curseur « construction »).
const profileCache = new WeakMap<Round, Map<string, Ring[]>>()

function cachedProfile(piece: Piece, rounds: Round[], complete: boolean): Ring[] {
  const last = rounds[rounds.length - 1]
  const key = `${rounds.length}|${complete}|${piece.stuffed}|${piece.joinedStart}|${piece.open}|${rounds[0].key}`
  let byKey = profileCache.get(last)
  if (!byKey) {
    byKey = new Map()
    profileCache.set(last, byKey)
  }
  let rings = byKey.get(key)
  if (!rings) {
    rings = latheProfile(rounds, {
      stuffed: piece.stuffed,
      // une pièce montée sur d'autres (corps du cœur) est fermée par celles-ci : couvercle plat
      closeStart: piece.joinedStart || rounds[0].count <= 12,
      // pièce non rembourrée (bonnet, panier) : le fond reste plat
      flatStart: piece.joinedStart || !piece.stuffed,
      closeEnd: complete && !piece.open,
    })
    byKey.set(key, rings)
  }
  return rings
}

function buildLathe(piece: Piece, rounds: Round[], complete: boolean): Built {
  const rings = cachedProfile(piece, rounds, complete)
  let volume = 0
  for (let i = 1; i < rings.length; i++) volume += Math.PI * rings[i].r ** 2 * (rings[i].y - rings[i - 1].y)
  return {
    piece,
    open: piece.open || !complete,
    rings,
    startR: rings.find((r) => r.row >= 0)?.r ?? rings[0].r,
    length: rings[rings.length - 1].y - rings[0].y,
    maxR: Math.max(...rings.map((r) => r.r)),
    volume,
  }
}

const ID = { n: 0 }
const nextId = (p: string) => `${p}-${ID.n++}`
const identity = (): Transform => ({ position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] })

/** Rayon de la surface d'une pièce à une fraction t (0 → début, 1 → fin) de sa longueur. */
function radiusAt(b: Built, t: number): number {
  const y = b.rings[0].y + t * b.length
  for (let i = 1; i < b.rings.length; i++) {
    if (b.rings[i].y >= y) {
      const a = b.rings[i - 1]
      const c = b.rings[i]
      const f = (y - a.y) / (c.y - a.y || 1)
      return a.r + f * (c.r - a.r)
    }
  }
  return b.rings[b.rings.length - 1].r
}

export function buildModel(pieces: Piece[], cords: CordPiece[], details: Details, options: ModelOptions): Model {
  ID.n = 0
  const upTo = options.upTo ?? Infinity
  let budget = upTo
  const built: { b: Built | null, panel: Part | null, piece: Piece }[] = []

  for (const piece of pieces) {
    if (budget <= 0) break
    const rounds = piece.rounds.slice(0, Math.max(0, Math.min(piece.rounds.length, budget)))
    const complete = rounds.length === piece.rounds.length
    budget -= rounds.length
    if (!rounds.length) continue
    if (piece.flat) {
      let y = 0
      const rows = rounds.map((r, i) => {
        if (i > 0) y += rowHeight(r)
        return { w: Math.max(r.count, 1), y, count: Math.max(r.count, 1), color: r.color ?? null }
      })
      built.push({ b: null, piece, panel: { kind: 'panel', id: nextId('panel'), label: piece.label, color: piece.color, rows, transform: identity() } })
    } else {
      built.push({ b: buildLathe(piece, rounds, complete), panel: null, piece })
    }
  }
  const complete = budget > 0 || upTo === Infinity

  if (options.assembled && complete) {
    const assembled = assembleLayered(built, cords, details) ?? assemble(built, cords, details, options.placements ?? {})
    if (assembled) return withBounds(assembled.parts, assembled.mainLabel, built)
  }
  return withBounds(layoutSideBySide(built, complete ? cords : []), undefined, [])
}

function lathePart(b: Built, transform: Transform): Part {
  return { kind: 'lathe', id: nextId('lathe'), label: b.piece.label, color: b.piece.color, rings: b.rings, open: b.open, transform }
}

/** Écrase une pièce ouverte « fermée à plat » (oreille) en demi-disque. */
function flattenScale(b: Built): Vec3 {
  return b.piece.flattened && b.piece.open ? [1.05, 1, 0.22] : [1, 1, 1]
}

function layoutSideBySide(items: { b: Built | null, panel: Part | null, piece: Piece }[], cords: CordPiece[]): Part[] {
  const parts: Part[] = []
  let cursor = 0
  const GAP = 2
  for (const { b, panel, piece } of items) {
    for (let c = 0; c < piece.copies; c++) {
      if (b) {
        const s = flattenScale(b)
        const half = b.maxR * s[0]
        cursor += half
        parts.push(lathePart(b, { position: [cursor, -b.rings[0].y, 0], rotation: [0, 0, 0], scale: s }))
        cursor += half + GAP
      } else if (panel && panel.kind === 'panel') {
        const w = Math.max(...panel.rows.map((r) => r.w))
        cursor += w / 2
        parts.push({ ...panel, id: nextId('panel'), transform: { position: [cursor, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } })
        cursor += w / 2 + GAP
      }
    }
  }
  for (const cord of cords) {
    // chaînette enroulée en spirale lâche
    const len = cord.length * CHAIN_LENGTH
    const turns = Math.max(1, len / 18)
    const R = Math.min(4, len / (2 * Math.PI * turns))
    const n = Math.max(8, Math.round(turns * 24))
    cursor += R
    const points: Vec3[] = []
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * turns * 2 * Math.PI
      const rr = R * (0.35 + 0.65 * (i / n))
      points.push([cursor + rr * Math.cos(a), 0.3 + i * 0.012, rr * Math.sin(a)])
    }
    parts.push({ kind: 'cord', id: nextId('cord'), label: cord.label, color: cord.color, points, radius: 0.3, stitches: cord.length })
    cursor += R + GAP
  }
  // recentrage horizontal
  const shift = -(cursor - GAP) / 2
  return parts.map((p) => shiftPart(p, [shift, 0, 0]))
}

function shiftPart(p: Part, d: Vec3): Part {
  const add = (v: Vec3): Vec3 => [v[0] + d[0], v[1] + d[1], v[2] + d[2]]
  if (p.kind === 'cord') return { ...p, points: p.points.map(add) }
  if (p.kind === 'bead') return { ...p, position: add(p.position) }
  return { ...p, transform: { ...p.transform, position: add(p.transform.position) } }
}

/**
 * Repère d'une pièce principale : `point(t, angle, lift)` donne un point de sa surface
 * (t le long de l'axe depuis le début, angle autour de l'axe, `lift` vers l'extérieur).
 */
interface Frame {
  point: (t: number, angle: number, lift?: number) => Vec3
  normal: (t: number, angle: number) => Vec3
}

function makeFrame(b: Built, mode: 'up' | 'down' | 'forward', origin: Vec3): Frame {
  // repère local : axe a (début → fin), u (« avant » à angle 0), v = a × u
  const axis: Vec3 = mode === 'up' ? [0, 1, 0] : mode === 'down' ? [0, -1, 0] : [0, 0, -1]
  const u: Vec3 = mode === 'forward' ? [0, 1, 0] : [0, 0, 1]
  const v: Vec3 = [axis[1] * u[2] - axis[2] * u[1], axis[2] * u[0] - axis[0] * u[2], axis[0] * u[1] - axis[1] * u[0]]
  const dir = (angle: number): Vec3 => [
    u[0] * Math.cos(angle) + v[0] * Math.sin(angle),
    u[1] * Math.cos(angle) + v[1] * Math.sin(angle),
    u[2] * Math.cos(angle) + v[2] * Math.sin(angle),
  ]
  return {
    point: (t, angle, lift = 0) => {
      const r = radiusAt(b, t) + lift
      const d = dir(angle)
      const along = b.rings[0].y + t * b.length
      return [0, 1, 2].map((k) => origin[k] + axis[k] * along + d[k] * r) as Vec3
    },
    normal: (t, angle) => {
      const d = dir(angle)
      const dt = 0.02
      const slope = (radiusAt(b, Math.min(1, t + dt)) - radiusAt(b, Math.max(0, t - dt))) / (2 * dt * b.length || 1)
      const n = [0, 1, 2].map((k) => d[k] - axis[k] * slope)
      const len = Math.hypot(n[0], n[1], n[2]) || 1
      return n.map((x) => x / len) as Vec3
    },
  }
}

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/**
 * Angles d'Euler (ordre XYZ de three.js) d'une rotation qui envoie l'axe local +Y sur `y`
 * et l'axe local +Z au plus près de `facing` (la face aplatie d'une oreille regarde vers `facing`).
 */
export function orient(yDir: Vec3, facing: Vec3): Vec3 {
  const y = norm(yDir)
  let zf: Vec3 = [facing[0] - dot(facing, y) * y[0], facing[1] - dot(facing, y) * y[1], facing[2] - dot(facing, y) * y[2]]
  if (Math.hypot(...zf) < 1e-6) zf = Math.abs(y[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1]
  const z = norm(zf)
  const x = cross(y, z)
  // matrice de colonnes (x, y, z) → Euler XYZ (cf. Euler.setFromRotationMatrix)
  const m13 = z[0]
  const ry = Math.asin(Math.max(-1, Math.min(1, m13)))
  if (Math.abs(m13) < 0.9999999) return [Math.atan2(-z[1], z[2]), ry, Math.atan2(-y[0], x[0])]
  return [Math.atan2(y[2], y[1]), ry, 0]
}

/** Clé d'un placement manuel : une oreille sur deux, etc. */
export const placementKey = (label: string, copy: number) => `${label}#${copy}`

type Spot = { t: number, angles: number[], sink: number, onHead?: boolean }

/**
 * Où poser chaque type de pièce sur la pièce principale, selon son orientation.
 * t : position le long de l'axe (0 début → 1 fin) ; angles autour de l'axe (0 = devant, ou dessus
 * quand le corps est couché) ; sink : profondeur d'enfoncement ; onHead : sur la tête si elle existe.
 */
const ASSEMBLY: Record<'forward' | 'upright', Partial<Record<PieceKind, Spot>>> = {
  forward: {
    ear: { t: 0.4, angles: [Math.PI * 0.3, -Math.PI * 0.3], sink: 0.6 },
    arm: { t: 0.35, angles: [Math.PI * 0.62, -Math.PI * 0.62], sink: 0.4 },
    leg: { t: 0.62, angles: [Math.PI * 0.78, -Math.PI * 0.78], sink: 0.4 },
    wing: { t: 0.5, angles: [Math.PI / 2, -Math.PI / 2], sink: 0.3 },
    // le long du dos (dessus), répartis ensuite entre toutes les pièces de ce type
    spike: { t: 0.55, angles: [0], sink: 0.25 },
  },
  upright: {
    ear: { t: 0.9, angles: [Math.PI * 0.42, -Math.PI * 0.42], sink: 0.5, onHead: true },
    arm: { t: 0.62, angles: [Math.PI / 2, -Math.PI / 2], sink: 0.5 },
    leg: { t: 0.06, angles: [Math.PI * 0.18, -Math.PI * 0.18], sink: 0.3 },
    tail: { t: 0.2, angles: [Math.PI], sink: 0.3 },
    wing: { t: 0.6, angles: [Math.PI * 0.62, -Math.PI * 0.62], sink: 0.3 },
    spike: { t: 0.5, angles: [Math.PI], sink: 0.25 },
    muzzle: { t: 0.45, angles: [0], sink: 0.5, onHead: true },
  },
}

type PanelRow = { w: number, y: number, count: number, color: string | null }

/**
 * Épaisseur d'un coussin (deux panneaux cousus et rembourrés) au point (x, y) du panneau : nulle sur
 * le contour, arrondie près des bords, maximale au centre.
 */
export function cushionHeight(rows: PanelRow[], thickness: number, x: number, y: number): number {
  const y0 = rows[0].y
  const y1 = rows[rows.length - 1].y
  if (y < y0 || y > y1) return 0
  let i = 1
  while (i < rows.length - 1 && rows[i].y < y) i++
  const a = rows[i - 1]
  const b = rows[i]
  const w = a.w + (b.w - a.w) * ((y - a.y) / ((b.y - a.y) || 1))
  const d = Math.min(w / 2 - Math.abs(x), y - y0 + 0.6, y1 - y + 0.6)
  if (d <= 0) return 0
  // bord arrondi qui s'adoucit vers le centre (pas une dalle à bords droits)
  const f = Math.min(1, d / (thickness * 2.8))
  return thickness * (0.12 + 0.88 * (1 - (1 - f) * (1 - f)))
}

const cushionThickness = (rows: PanelRow[]) => Math.min(4.5, Math.max(1, Math.max(...rows.map((r) => r.w)) * 0.045))

/**
 * Pièces plates en deux couches (« Corps x2 (bleu, blanc) », « Positionne le corps bleu sur le corps
 * blanc », rembourrées) : une raie, un coussin plat… Le corps est posé à plat, la tête continue son
 * dernier rang, la queue part de la pointe, les antennes des coins de la tête.
 */
function assembleLayered(
  items: { b: Built | null, panel: Part | null, piece: Piece }[],
  cords: CordPiece[],
  details: Details,
): { parts: Part[], mainLabel: string } | null {
  type Layered = { b: Built | null, panel: Extract<Part, { kind: 'panel' }>, piece: Piece }
  const flat = items.filter((i): i is Layered => i.panel?.kind === 'panel')
  const layered = flat.filter((i) => i.piece.copies === 2 && i.piece.copyColors?.length === 2)
  if (!layered.length || !details.stuffed || items.some((i) => i.b)) return null
  const area = (i: Layered) => i.panel.rows.reduce((n, r) => n + r.w, 0)
  const main = layered.reduce((a, b) => (area(b) > area(a) ? b : a))
  const parts: Part[] = []
  // panneau couché : ses rangs vers l'avant (+z, face à la caméra), son épaisseur vers le haut
  const flatRot: Vec3 = [-Math.PI / 2, 0, Math.PI]
  // la tête (pièce plate crochetée à partir du dernier rang du corps, rembourrée avec lui) prolonge
  // son contour : un seul coussin, sans couture visible
  const rows: PanelRow[] = main.panel.rows.map((r) => ({ ...r }))
  const bodyLast = rows[rows.length - 1].y
  let head: { from: number, to: number, w: number } | null = null
  for (const i of flat) {
    if (i === main) continue
    const shift = rows[rows.length - 1].y + 0.9
    for (const r of i.panel.rows) rows.push({ ...r, y: r.y + shift })
    if (!head) head = { from: shift, to: rows[rows.length - 1].y, w: Math.max(...i.panel.rows.map((r) => r.w)) }
  }
  const th = cushionThickness(rows)
  const [topColor, bottomColor] = main.piece.copyColors ?? [main.piece.color, main.piece.color]
  parts.push({ ...main.panel, rows, id: nextId('panel'), puff: { top: topColor, bottom: bottomColor, thickness: th }, transform: { position: [0, th, 0], rotation: flatRot, scale: [1, 1, 1] } })
  const body = { th, last: bodyLast }
  // dessus du coussin au point (x, rang) du panneau, en coordonnées du modèle (panneau retourné)
  const surface = (x: number, y: number, lift = 0): Vec3 => [-x, th + cushionHeight(rows, th, x, y) + lift, y]
  const front = head ? { z: head.to, w: head.w, mid: (head.from + head.to) / 2 } : { z: bodyLast, w: Math.max(...rows.map((r) => r.w)), mid: bodyLast * 0.85 }
  for (const cord of cords) {
    const len = cord.length * CHAIN_LENGTH
    const n = 24
    const antenna = /\b(?:antenn|corne|horn|tentac|barbill|cephal)/i.test(cord.label)
    const ends = antenna ? [-1, 1].slice(0, Math.max(2, cord.copies)) : [0]
    for (const side of ends) {
      const points: Vec3[] = []
      for (let k = 0; k <= n; k++) {
        const s = k / n
        points.push(antenna
          // antennes : partent des coins avant de la tête et s'enroulent vers l'intérieur
          ? [side * (front.w / 2 - 0.6 - Math.sin(s * Math.PI * 0.9) * len * 0.25), th * 0.6 + s * 0.4, front.z + s * len * 0.8]
          // queue : part de la pointe arrière et ondule sur le sol
          : [Math.sin(s * Math.PI * 1.6) * len * 0.07, Math.max(0.4, body.th * 0.5 * (1 - s * 2)), -0.6 - s * len])
      }
      parts.push({ kind: 'cord', id: nextId('cord'), label: cord.label, color: cord.color === DEFAULT_YARN ? main.piece.color : cord.color, points, radius: antenna ? 0.45 : 0.6, stitches: cord.length })
    }
  }
  // yeux en feutrine sur les côtés de la tête
  if (details.eyes) {
    for (const side of [-1, 1]) {
      const x = side * Math.max(1, front.w / 2 - 3)
      parts.push({ kind: 'bead', id: nextId('eye'), label: 'Yeux', color: details.eyes.color, radius: 1.2, position: surface(x, front.mid, 0.05), glossy: false, squash: 0.35 })
    }
  }
  // traits brodés sur le dessus du corps, répartis de façon régulière mais pas alignée
  if (details.stripes) {
    for (let k = 0; k < 40; k++) {
      const v = ((k * 0.618) % 1) * 0.85 + 0.1
      const y = rows[0].y + v * (body.last - rows[0].y)
      const w = rows.find((r) => r.y >= y)?.w ?? 1
      const x = (((k * 0.414) % 1) - 0.5) * w * 0.8
      const h = cushionHeight(rows, body.th, x, y)
      if (h < body.th * 0.3) continue
      const a = (k * 2.4) % Math.PI
      // le panneau est retourné (rotation de 180° autour de son axe) : x et les rangs changent de signe
      const p = surface(x, y, 0.05)
      parts.push({ kind: 'cord', id: nextId('cord'), label: 'Broderie', color: details.stripes.color, radius: 0.22, stitches: 3,
        points: [[p[0] - Math.cos(a) * 1.1, p[1], p[2] - Math.sin(a) * 1.1], p, [p[0] + Math.cos(a) * 1.1, p[1], p[2] + Math.sin(a) * 1.1]] })
    }
  }
  return { parts, mainLabel: main.piece.label }
}

function assemble(
  items: { b: Built | null, panel: Part | null, piece: Piece }[],
  cords: CordPiece[],
  details: Details,
  placements: Record<string, { point: Vec3, normal: Vec3 }>,
): { parts: Part[], mainLabel: string } | null {
  const lathes = items.filter((i): i is { b: Built, panel: null, piece: Piece } => !!i.b)
  if (!lathes.length) return null
  const singles = lathes.filter((i) => i.piece.copies === 1)
  const kinds = new Map(lathes.map((i) => [i.b, pieceKind(i.piece.label)]))
  // pièce principale : le corps s'il y a une tête séparée (la tête se pose dessus), sinon la plus volumineuse
  const hasHead = singles.some((i) => kinds.get(i.b) === 'head')
  const bodies = singles.filter((i) => kinds.get(i.b) === 'body')
  const pool = hasHead && bodies.length ? bodies : singles.length ? singles : lathes
  const main = pool.reduce((a, b) => (b.b.volume > a.b.volume ? b : a))
  const parts: Part[] = []
  const used = new Set<Built>([main.b])
  const mainLabel = main.piece.label

  // orientation de la pièce principale
  const startsWithFace = /\b(?:museau|nez|snout|nose|muzzle|bec|beak)\b/i.test(main.piece.sections[0] ?? '')
  const before = lathes.slice(0, lathes.indexOf(main)).filter((i) => i.piece.open)
  const legsBelow = before.some((i) => kinds.get(i.b) === 'leg')
  // un bonnet se pose calotte en haut ; un sac, un panier, ouverture en haut
  const hat = main.piece.open && !main.piece.stuffed && HAT.test(mainLabel)
  const mode: 'up' | 'down' | 'forward' = startsWithFace && /\b(?:corps|body)\b/i.test(mainLabel)
    ? 'forward'
    : hat || (main.piece.joinedStart && before.length && !legsBelow) ? 'down' : 'up'

  // rotation de la pièce principale pour que son axe local +Y suive `mode`
  const mainRot: Vec3 = mode === 'up' ? [0, 0, 0] : mode === 'down' ? [Math.PI, 0, 0] : [-Math.PI / 2, 0, 0]
  const origin: Vec3 = [0, 0, 0]
  parts.push(lathePart(main.b, { position: [0, 0, 0], rotation: mainRot, scale: [1, 1, 1] }))
  let frame = makeFrame(main.b, mode, origin)
  const mainFrame = frame

  // pose une pièce : son axe local +Y suit `n`, son origine est en `at` enfoncée de `sink` ;
  // une pièce aplatie présente sa face vers `facing`
  const facing: Vec3 = mode === 'forward' ? [0, 0, 1] : [0, 0, 1]
  const attach = (b: Built, at: Vec3, n: Vec3, sink: number) => {
    const pos: Vec3 = [at[0] - n[0] * sink, at[1] - n[1] * sink, at[2] - n[2] * sink]
    parts.push(lathePart(b, { position: pos, rotation: orient(n, facing), scale: flattenScale(b) }))
    used.add(b)
  }

  // une pièce annexe se coud par son dernier rang (ouverture d'une oreille, fin fermée d'un bras ou
  // d'une queue) : axe retourné vers la surface, le rang 1 (main, pied, bout de la queue) reste libre
  const sew = (b: Built, at: Vec3, n: Vec3, sink: number) => {
    const end = b.rings[b.rings.length - 1].y
    attach(b, [at[0] + n[0] * end, at[1] + n[1] * end, at[2] + n[2] * end], [-n[0], -n[1], -n[2]], -sink)
  }

  // placements manuels d'abord ; un 2e exemplaire non placé est posé en symétrique du 1er
  for (const i of lathes) {
    if (i === main) continue
    const own = Array.from({ length: i.piece.copies }, (_, c) => placements[placementKey(i.piece.label, c)])
    if (!own.some(Boolean)) continue
    for (let c = 0; c < i.piece.copies; c++) {
      const pl = own[c] ?? (c === 1 && own[0] ? { point: [-own[0].point[0], own[0].point[1], own[0].point[2]] as Vec3, normal: [-own[0].normal[0], own[0].normal[1], own[0].normal[2]] as Vec3 } : null)
      if (pl) sew(i.b, pl.point, pl.normal, 0.4)
    }
    used.add(i.b)
  }

  // pièces montées sous/sur l'ouverture du corps (lobes du cœur, jambes d'un ours…)
  if (main.piece.joinedStart && before.length) {
    const R = main.b.startR
    before.filter((i) => !used.has(i.b)).forEach((i, k) => {
      const spread = before.length === 1 ? 0 : (k / (before.length - 1) - 0.5) * 2
      const x = spread * R * 0.37
      if (mode === 'down') {
        // ouverture vers le bas, dôme vers le haut
        // le corps est crocheté autour du bas des lobes : ils s'y enfoncent
        const sink = i.b.length * 0.24
        parts.push(lathePart(i.b, { position: [x, i.b.length + i.b.rings[0].y - sink, 0], rotation: [Math.PI, 0, 0], scale: [1, 1, 1] }))
      } else {
        parts.push(lathePart(i.b, { position: [x, -i.b.length - i.b.rings[0].y + 0.6, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }))
      }
      used.add(i.b)
    })
  }

  // tête séparée posée sur le corps : les oreilles et le visage vont sur la tête. Une tête qui finit
  // ouverte (« Sew head onto body with 24 sts ») est cousue par son ouverture : elle est retournée.
  const head = lathes.find((i) => !used.has(i.b) && kinds.get(i.b) === 'head' && i.piece.copies === 1)
  let headFlipped = false
  if (head && kinds.get(main.b) === 'body' && mode === 'up') {
    const top = mainFrame.point(1, 0)
    if (head.b.open) {
      headFlipped = true
      const end = head.b.rings[head.b.rings.length - 1].y
      const pos: Vec3 = [0, top[1] + end - 0.6, 0]
      parts.push(lathePart(head.b, { position: pos, rotation: [Math.PI, 0, 0], scale: [1, 1, 1] }))
      frame = makeFrame(head.b, 'down', pos)
    } else {
      const lift = head.b.maxR * 0.85
      parts.push(lathePart(head.b, { position: [0, top[1] + lift - head.b.rings[0].y - head.b.length / 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }))
      frame = makeFrame(head.b, 'up', [0, top[1] + lift - head.b.length / 2 - head.b.rings[0].y, 0])
    }
    used.add(head.b)
  }
  const faceFrame = frame
  const faceBuilt = faceFrame !== mainFrame && head ? head.b : main.b
  // position le long de la tête retournée : les repères « en haut de la tête » s'inversent
  const onFace = (t: number) => (headFlipped ? 1 - t : t)

  // rang cité dans les consignes (« between rows 21 and 22 », « Sew ears between R3 and 10 of head »)
  // → position le long de la pièce concernée
  const rowT = (b: Built, row: number): number | null => {
    const base = Math.floor(row)
    const i = b.piece.rounds.findIndex((r) => r.number === base)
    const a = i < 0 ? undefined : b.rings.find((g) => g.row === i)
    if (!a) return null
    const c = b.rings.find((g) => g.row === i + 1) ?? a
    const y = a.y + (c.y - a.y) * (row - base)
    return Math.min(0.98, Math.max(0.02, (y - b.rings[0].y) / (b.length || 1)))
  }
  const hintedT = (label: string, want = 1, b: Built = main.b) => rowsFor(label, details.rows, want).map((r) => rowT(b, r)).filter((t): t is number => t != null)

  // positions des pièces annexes, selon le type et l'orientation
  const spots = ASSEMBLY[mode === 'forward' ? 'forward' : 'upright']
  // piquants, écailles : sans indication de rang, répartis régulièrement le long du dos
  const spikeTotal = lathes.filter((i) => !used.has(i.b) && kinds.get(i.b) === 'spike').reduce((n, i) => n + i.piece.copies, 0)
  let spikeIndex = 0
  // bout du museau (pour la truffe)
  let muzzleTip: { at: Vec3, n: Vec3, base: Vec3, r: number } | null = null
  const earsPlaced = new Set<string>()

  for (const i of lathes) {
    if (used.has(i.b)) continue
    const kind = kinds.get(i.b) ?? 'other'
    const spot = spots[kind]
    if (!spot) continue
    const f = spot.onHead ? faceFrame : mainFrame
    const fb = spot.onHead ? faceBuilt : main.b
    // un rang par exemplaire pour les piquants, un seul pour une paire symétrique
    const hinted = hintedT(i.piece.label, kind === 'spike' ? i.piece.copies : 1, fb)
    if (kind === 'spike') {
      for (let c = 0; c < i.piece.copies; c++) {
        const t = hinted[c] ?? 0.3 + 0.45 * (spikeTotal > 1 ? spikeIndex / (spikeTotal - 1) : 0.5)
        spikeIndex++
        sew(i.b, f.point(t, spot.angles[0]), f.normal(t, spot.angles[0]), spot.sink)
      }
      used.add(i.b)
      continue
    }
    // l'intérieur d'oreille (« White part of ears ») se pose devant l'oreille déjà placée
    const lining = kind === 'ear' && earsPlaced.size > 0
    // museau « between eyes » : juste sous les yeux quand leur rang est donné
    const eyeT = kind === 'muzzle' ? [...hintedT('eyes', 1, faceBuilt), ...hintedT('yeux', 1, faceBuilt)][0] : undefined
    const t = hinted[0] ?? (eyeT != null ? Math.min(0.95, Math.max(0.05, eyeT + (headFlipped ? 0.14 : -0.14))) : spot.onHead ? onFace(spot.t) : spot.t)
    for (let c = 0; c < Math.min(i.piece.copies, spot.angles.length); c++) {
      const angle = spot.angles[c] * (lining ? 0.92 : 1)
      let n = f.normal(t, angle)
      if (kind === 'leg' && mode === 'up') n = [n[0] * 0.5, -1, n[2] * 0.5]
      // bras le long du corps, légèrement vers l'avant
      if (kind === 'arm' && mode === 'up') n = norm([n[0] * 0.6, -0.8, n[2] * 0.6 + 0.2])
      if (lining) n = norm([n[0], n[1], n[2] + 0.35])
      const at = f.point(t, angle, lining ? 0.35 : 0)
      sew(i.b, at, n, spot.sink)
      if (kind === 'muzzle') {
        const len = i.b.rings[i.b.rings.length - 1].y - i.b.rings[0].y
        muzzleTip = { at: [at[0] + n[0] * len, at[1] + n[1] * len, at[2] + n[2] * len], n, base: at, r: i.b.maxR }
      }
    }
    if (kind === 'ear') earsPlaced.add(i.piece.label)
    used.add(i.b)
  }

  // pièces plates cousues sur le corps : plastron (« White spot on chest »), dessus du museau…
  const patched = new Set<Piece>()
  for (const i of items) {
    if (!i.panel || i.panel.kind !== 'panel') continue
    const label = i.piece.label
    const onChest = /\b(?:chest|belly|tummy|collar|bib|ventre|poitrine|plastron|bavoir|col)\b/i.test(label)
    const onNose = /\b(?:nose|snout|muzzle|museau|nez)\b/i.test(label)
    if (!onChest && !onNose) continue
    const h = Math.max(...i.panel.rows.map((r) => r.y))
    const tip = muzzleTip as { at: Vec3, n: Vec3, base: Vec3, r: number } | null
    let at: Vec3
    let n: Vec3
    let radius: number
    if (onNose && tip) {
      // sur le dessus du museau, à mi-longueur, tourné vers le haut
      const mid: Vec3 = [(tip.base[0] + tip.at[0]) / 2, (tip.base[1] + tip.at[1]) / 2, (tip.base[2] + tip.at[2]) / 2]
      at = [mid[0], mid[1] + tip.r * 0.8, mid[2] - h * 0.35]
      n = norm([tip.n[0] * 0.5, 1, tip.n[2] * 0.5])
      radius = tip.r
    } else {
      const f = onNose ? faceFrame : mainFrame
      const t = onNose ? onFace(0.42) : 0.78
      at = f.point(t, 0, 0.2)
      n = f.normal(t, 0)
      radius = radiusAt(onNose ? faceBuilt : main.b, t)
      if (!onNose) at = [at[0], at[1] - h * 0.55, at[2]]
    }
    // le panneau (plan x-y, normale +z) face à l'extérieur, ses rangs vers le haut, courbé autour de la pièce
    const tilt = -Math.atan2(n[1], Math.hypot(n[0], n[2]))
    const yaw = Math.atan2(n[0], n[2])
    parts.push({ ...i.panel, rows: i.panel.rows.map((r) => ({ ...r })), curve: Math.max(2, radius + 0.2), id: nextId('panel'), transform: { position: at, rotation: [tilt, yaw, 0], scale: [1, 1, 1] } })
    patched.add(i.piece)
  }

  // pièces non placées : à côté
  const leftovers = items.filter((i) => (i.b ? !used.has(i.b) : !patched.has(i.piece)))
  const mainSpan = main.b.maxR
  const side = layoutSideBySide(leftovers, [])
  const sideShift: Vec3 = [mainSpan * 2 + 6, 0, 0]
  for (const p of side) parts.push(shiftPart(p, sideShift))

  // queue : chaînette qui part de l'arrière, retombe au sol puis ondule
  const floor = Math.min(...parts.filter((p): p is Extract<Part, { kind: 'lathe' }> => p.kind === 'lathe')
    .map((p) => p.transform.position[1] - Math.max(...p.rings.map((r) => r.r)))) + 0.3
  for (const cord of cords) {
    const len = cord.length * CHAIN_LENGTH
    const start = mode === 'forward' ? mainFrame.point(0.97, Math.PI * 0.85, -0.4) : mainFrame.point(0.2, Math.PI, -0.3)
    const n = 40
    const points: Vec3[] = [start]
    let p: Vec3 = start
    const drop = Math.max(0.5, start[1] - floor)
    for (let k = 1; k <= n; k++) {
      const s = k / n
      const step = len / n
      // descente vers l'arrière, puis la queue s'enroule au sol le long du corps
      const turn = Math.max(0, s - 0.12) * 4.1
      const dir: Vec3 = norm([Math.sin(turn), s < 0.3 ? -drop / (len * 0.3) : 0, -Math.cos(turn)])
      p = [p[0] + dir[0] * step, Math.max(floor, p[1] + dir[1] * step), p[2] + dir[2] * step]
      points.push(p)
    }
    // chaînette sans couleur indiquée : du fil de la pièce principale
    parts.push({ kind: 'cord', id: nextId('cord'), label: cord.label, color: cord.color === DEFAULT_YARN ? main.piece.color : cord.color, points, radius: 0.3, stitches: cord.length })
  }

  // yeux et nez
  if (details.eyes) {
    const hinted = [...hintedT('eyes', 1, faceBuilt), ...hintedT('yeux', 1, faceBuilt)][0]
    const t = hinted ?? (mode === 'forward' ? 0.2 : onFace(0.58))
    // « 8 sc apart » : écart en mailles sur le tour où sont posés les yeux
    const ring = faceBuilt.rings[Math.round(t * (faceBuilt.rings.length - 1))]
    const spread = details.eyes.gap && ring?.count ? Math.min(Math.PI * 0.45, Math.PI * (details.eyes.gap + 1) / ring.count)
      : mode === 'forward' ? Math.PI * 0.32 : Math.PI * 0.2
    for (const a of [spread, -spread]) {
      const p = faceFrame.point(t, a, -0.15)
      parts.push({ kind: 'bead', id: nextId('eye'), label: 'Yeux', color: details.eyes.color, radius: Math.max(0.55, radiusAt(faceBuilt, t) * 0.15), position: p, glossy: true, squash: 1 })
    }
  }
  if (details.nose) {
    // au bout du museau s'il y en a un (truffe de sécurité, brillante), sinon au milieu du visage
    const tipAt = muzzleTip as { at: Vec3, n: Vec3 } | null
    const p = tipAt ? tipAt.at : mode === 'forward' ? mainFrame.point(0, 0, 0) : faceFrame.point(onFace(0.48), 0, -0.1)
    const tip: Vec3 = tipAt ? [p[0] + tipAt.n[0] * 0.3, p[1] + tipAt.n[1] * 0.3, p[2] + tipAt.n[2] * 0.3]
      : mode === 'forward' ? [p[0], p[1], p[2] + 0.45] : p
    parts.push({ kind: 'bead', id: nextId('nose'), label: 'Nez', color: details.nose.color, radius: tipAt ? 0.9 : 0.6, position: tip, glossy: !!tipAt, squash: 0.8 })
  }
  return { parts, mainLabel: main.piece.label }
}

/** Point local d'une pièce placée (échelle, rotation d'Euler XYZ comme three.js, puis position). */
function placePoint(p: Vec3, t: Transform): Vec3 {
  let [x, y, z] = [p[0] * t.scale[0], p[1] * t.scale[1], p[2] * t.scale[2]]
  const [a, b, c] = t.rotation
  ;[x, y] = [x * Math.cos(c) - y * Math.sin(c), x * Math.sin(c) + y * Math.cos(c)]
  ;[x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)]
  ;[y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)]
  return [x + t.position[0], y + t.position[1], z + t.position[2]]
}

/** Encombrement réel du modèle (boîte englobante), en unités de maille. */
export function modelExtent(parts: Part[]): { min: Vec3, max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  const grow = (q: Vec3, r = 0) => {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], q[k] - r)
      max[k] = Math.max(max[k], q[k] + r)
    }
  }
  for (const p of parts) {
    if (p.kind === 'cord') p.points.forEach((q) => grow(q, p.radius))
    else if (p.kind === 'bead') grow(p.position, p.radius)
    else if (p.kind === 'lathe') {
      for (let i = 0; i < p.rings.length; i += Math.max(1, Math.floor(p.rings.length / 24))) {
        const ring = p.rings[i]
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2
          grow(placePoint([ring.r * Math.cos(a), ring.y, ring.r * Math.sin(a)], p.transform))
        }
      }
    } else {
      const th = p.puff?.thickness ?? 0
      for (const r of p.rows) for (const x of [-r.w / 2, r.w / 2]) for (const z of [-th, th]) grow(placePoint([x, r.y, z], p.transform))
    }
  }
  return parts.length ? { min, max } : { min: [0, 0, 0], max: [0, 0, 0] }
}

function withBounds(parts: Part[], mainLabel?: string, built: { b: Built | null, piece: Piece }[] = []): Model {
  const placeable = built.filter((i) => i.b && i.piece.label !== mainLabel).map((i) => ({ label: i.piece.label, copies: i.piece.copies }))
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  const grow = (p: Vec3, r = 0) => {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[k] - r)
      max[k] = Math.max(max[k], p[k] + r)
    }
  }
  for (const p of parts) {
    if (p.kind === 'cord') p.points.forEach((q) => grow(q, p.radius))
    else if (p.kind === 'bead') grow(p.position, p.radius)
    else {
      const extent = p.kind === 'lathe'
        ? Math.max(...p.rings.map((r) => r.r)) * Math.max(...p.transform.scale) + Math.max(...p.rings.map((r) => Math.abs(r.y)))
        : Math.max(...p.rows.map((r) => r.w)) / 2 + Math.max(...p.rows.map((r) => r.y))
      grow(p.transform.position, extent)
    }
  }
  if (!parts.length) return { parts, mainLabel, placeable, min: [0, 0, 0], max: [0, 0, 0] }
  return { parts, mainLabel, placeable, min, max }
}
