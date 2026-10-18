// @ts-check
// Géométrie des symboles de crochet (conventions CYC / JIS) et mise en page des graphiques,
// partagées par l'affichage React et l'export SVG.

/**
 * Tracés d'un symbole centré sur (0, 0), « le haut » (-y) pointant vers le rang suivant.
 * @param {string} type @param {number} s demi-taille
 * @returns {{ d?: string, circle?: boolean, ellipse?: boolean, r?: number, rx?: number, ry?: number }[]}
 */
export function glyphPaths(type, s) {
  const t = s * 0.9
  const stem = `M 0 ${s} L 0 ${-s} M ${-t} ${-s} L ${t} ${-s}`
  switch (type) {
    case 'sc': // ✕
      return [{ d: `M ${-t} ${-t} L ${t} ${t} M ${t} ${-t} L ${-t} ${t}` }]
    case 'hdc': // T
      return [{ d: stem }]
    case 'dc': // T barré une fois
      return [{ d: `${stem} M ${-t * 0.6} ${s * 0.15} L ${t * 0.6} ${-s * 0.35}` }]
    case 'tr': // T barré deux fois
      return [{ d: `${stem} M ${-t * 0.6} ${s * 0.45} L ${t * 0.6} ${-s * 0.05} M ${-t * 0.6} ${-s * 0.15} L ${t * 0.6} ${-s * 0.65}` }]
    case 'inc': // V : deux mailles dans une même base
      return [{ d: `M ${-t} ${-s} L 0 ${s} L ${t} ${-s}` }]
    case 'inc3': // W : trois mailles dans une même base
      return [{ d: `M ${-t} ${-s} L 0 ${s} L ${t} ${-s} M 0 ${s} L 0 ${-s}` }]
    case 'dec': // Λ : deux bases fermées ensemble
      return [{ d: `M ${-t} ${s} L 0 ${-s} L ${t} ${s}` }]
    case 'dec3': // trois bases fermées ensemble
      return [{ d: `M ${-t} ${s} L 0 ${-s} L ${t} ${s} M 0 ${-s} L 0 ${s}` }]
    case 'sl': // •
      return [{ circle: true, r: Math.max(s * 0.38, 1) }]
    case 'ch': // ○
    default:
      return [{ ellipse: true, rx: s * 0.75, ry: s * 0.5 }]
  }
}

export const CHART_SIZE = 120
export const RING_R = 46

/**
 * Position de chaque maille dans la vignette d'un rang.
 * En rond : sens inverse des aiguilles d'une montre depuis le haut (sens de lecture des diagrammes,
 * crochet tenu de la main droite). À plat : rangs impairs de droite à gauche, pairs de gauche à droite.
 * @param {{ stitches: string[], flat?: boolean, number?: number }} round
 */
export function chartLayout(round) {
  const n = Math.max(round.stitches.length, 1)
  const c = CHART_SIZE / 2
  if (round.flat) {
    const width = CHART_SIZE - 16
    const step = width / n
    const s = Math.max(1.4, Math.min(4.5, step * 0.42))
    const rtl = (round.number ?? 1) % 2 === 1
    const nodes = round.stitches.map((type, i) => {
      const k = rtl ? n - 1 - i : i
      return { type, x: 8 + step * (k + 0.5), y: c + 6, rot: 0 }
    })
    return { flat: true, rtl, s, nodes }
  }
  const gap = 360 / n
  const s = Math.max(1.8, Math.min(4.5, ((2 * Math.PI * RING_R) / n) * 0.42))
  const nodes = round.stitches.map((type, i) => {
    const angle = -i * gap
    const a = ((angle - 90) * Math.PI) / 180
    return { type, x: c + RING_R * Math.cos(a), y: c + RING_R * Math.sin(a), rot: angle }
  })
  return { flat: false, rtl: false, s, nodes }
}

/** Petite flèche indiquant le sens de travail. @param {ReturnType<typeof chartLayout>} layout */
export function directionArrow(layout) {
  const c = CHART_SIZE / 2
  if (layout.flat) {
    const y = c + 18
    return layout.rtl
      ? `M 96 ${y} L 24 ${y} M 30 ${y - 4} L 24 ${y} L 30 ${y + 4}`
      : `M 24 ${y} L 96 ${y} M 90 ${y - 4} L 96 ${y} L 90 ${y + 4}`
  }
  const r = RING_R - 11
  const p = (deg) => {
    const a = ((deg - 90) * Math.PI) / 180
    return [c + r * Math.cos(a), c + r * Math.sin(a)].map((v) => v.toFixed(1))
  }
  const [x0, y0] = p(-6)
  const [x1, y1] = p(-40)
  return `M ${x0} ${y0} A ${r} ${r} 0 0 0 ${x1} ${y1} M ${x1} ${y1} l 5.5 -1 M ${x1} ${y1} l 1.5 5.2`
}
