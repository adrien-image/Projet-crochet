// Modèle 3D d'un patron, indépendant de three.js (testable) :
// 1. chaque pièce en rond devient une surface de révolution dont le profil découle des comptes
//    de mailles (rayon = circonférence / 2π) et de la hauteur des mailles, tendue par le rembourrage ;
// 2. les pièces sont assemblées selon leur nom (oreilles sur la tête, jambes dessous, queue derrière…),
//    ou présentées côte à côte.
import type { Round, StitchType } from '../domain/types'
import type { CordPiece, Details, Piece } from '../domain/pieces'

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
  | { kind: 'panel', id: string, label: string, color: string, rows: { w: number, y: number, count: number, color: string | null }[], transform: Transform }
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
  ['head', /\b(?:t[êe]tes?|heads?)\b/i],
  ['body', /\b(?:corps|body|torse|torso)\b/i],
  ['muzzle', /\b(?:museau|snout|muzzle|nez|nose|bec|beak)\b/i],
]
const HAT = /\b(?:bonnet|chapeau|b[ée]ret|hat|beanie|cap|cagoule|balaclava)\b/i
type PieceKind = 'ear' | 'arm' | 'leg' | 'tail' | 'wing' | 'head' | 'body' | 'muzzle' | 'other'

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
    const assembled = assemble(built, cords, details, options.placements ?? {})
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
  },
  upright: {
    ear: { t: 0.9, angles: [Math.PI * 0.42, -Math.PI * 0.42], sink: 0.5, onHead: true },
    arm: { t: 0.62, angles: [Math.PI / 2, -Math.PI / 2], sink: 0.5 },
    leg: { t: 0.06, angles: [Math.PI * 0.18, -Math.PI * 0.18], sink: 0.3 },
    tail: { t: 0.2, angles: [Math.PI], sink: 0.3 },
    wing: { t: 0.6, angles: [Math.PI * 0.62, -Math.PI * 0.62], sink: 0.3 },
    muzzle: { t: 0.45, angles: [0], sink: 0.5, onHead: true },
  },
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

  // une pièce ouverte (oreille, bras) se coud par son ouverture : axe retourné vers la surface,
  // l'ouverture (fin de la pièce) vient se poser sur `at` ; une pièce fermée part de la surface
  const sew = (b: Built, at: Vec3, n: Vec3, sink: number) => {
    if (b.piece.open) {
      const end = b.rings[b.rings.length - 1].y
      attach(b, [at[0] + n[0] * end, at[1] + n[1] * end, at[2] + n[2] * end], [-n[0], -n[1], -n[2]], -sink)
    } else {
      attach(b, at, n, sink)
    }
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

  // tête séparée posée sur le corps : les oreilles et le visage vont sur la tête
  const head = lathes.find((i) => !used.has(i.b) && kinds.get(i.b) === 'head' && i.piece.copies === 1)
  if (head && kinds.get(main.b) === 'body' && mode === 'up') {
    const top = mainFrame.point(1, 0)
    const lift = head.b.maxR * 0.85
    parts.push(lathePart(head.b, { position: [0, top[1] + lift - head.b.rings[0].y - head.b.length / 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }))
    used.add(head.b)
    frame = makeFrame(head.b, 'up', [0, top[1] + lift - head.b.length / 2 - head.b.rings[0].y, 0])
  }
  const faceFrame = frame

  // positions des pièces annexes, selon le type et l'orientation
  const spots = ASSEMBLY[mode === 'forward' ? 'forward' : 'upright']

  for (const i of lathes) {
    if (used.has(i.b)) continue
    const kind = kinds.get(i.b) ?? 'other'
    const spot = spots[kind]
    if (!spot) continue
    const f = spot.onHead ? faceFrame : mainFrame
    for (let c = 0; c < Math.min(i.piece.copies, spot.angles.length); c++) {
      const angle = spot.angles[c]
      let n = f.normal(spot.t, angle)
      if (kind === 'leg' && mode === 'up') n = [n[0] * 0.5, -1, n[2] * 0.5]
      sew(i.b, f.point(spot.t, angle), n, spot.sink)
    }
    used.add(i.b)
  }

  // pièces non placées : à côté
  const leftovers = items.filter((i) => (i.b ? !used.has(i.b) : true))
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
    parts.push({ kind: 'cord', id: nextId('cord'), label: cord.label, color: cord.color, points, radius: 0.3, stitches: cord.length })
  }

  // yeux et nez
  if (details.eyes) {
    const t = mode === 'forward' ? 0.2 : 0.58
    const spread = mode === 'forward' ? Math.PI * 0.32 : Math.PI * 0.2
    for (const a of [spread, -spread]) {
      const p = faceFrame.point(t, a, -0.15)
      parts.push({ kind: 'bead', id: nextId('eye'), label: 'Yeux', color: details.eyes.color, radius: Math.max(0.55, radiusAt(faceFrame === mainFrame ? main.b : main.b, t) * 0.15), position: p, glossy: true, squash: 1 })
    }
  }
  if (details.nose) {
    const p = mode === 'forward' ? mainFrame.point(0, 0, 0) : faceFrame.point(0.48, 0, -0.1)
    const tip: Vec3 = mode === 'forward' ? [p[0], p[1], p[2] + 0.45] : p
    parts.push({ kind: 'bead', id: nextId('nose'), label: 'Nez', color: details.nose.color, radius: 0.6, position: tip, glossy: false, squash: 0.8 })
  }
  return { parts, mainLabel: main.piece.label }
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
