// Symboles de crochet (conventions CYC / JIS), dessinés dans un repère local
// centré sur (0, 0) où « le haut » (-y) pointe vers l'extérieur du rang.
// `s` est la demi-taille du symbole. Les couleurs passent par `style` pour accepter var(--…).
function glyphPaths(type, s) {
  const t = s * 0.9
  switch (type) {
    case 'sc': // ✕
      return [{ d: `M ${-t} ${-t} L ${t} ${t} M ${t} ${-t} L ${-t} ${t}` }]
    case 'hdc': // T
      return [{ d: `M 0 ${s} L 0 ${-s} M ${-t} ${-s} L ${t} ${-s}` }]
    case 'dc': // T barré une fois
      return [{ d: `M 0 ${s} L 0 ${-s} M ${-t} ${-s} L ${t} ${-s} M ${-t * 0.6} ${s * 0.15} L ${t * 0.6} ${-s * 0.35}` }]
    case 'tr': // T barré deux fois
      return [{ d: `M 0 ${s} L 0 ${-s} M ${-t} ${-s} L ${t} ${-s} M ${-t * 0.6} ${s * 0.45} L ${t * 0.6} ${-s * 0.05} M ${-t * 0.6} ${-s * 0.15} L ${t * 0.6} ${-s * 0.65}` }]
    case 'inc': // V : deux mailles dans une même base
      return [{ d: `M ${-t} ${-s} L 0 ${s} L ${t} ${-s}` }]
    case 'dec': // Λ : deux bases fermées ensemble
      return [{ d: `M ${-t} ${s} L 0 ${-s} L ${t} ${s}` }]
    case 'sl': // •
      return [{ circle: true, r: Math.max(s * 0.38, 1), fill: true }]
    case 'ch': // ○
    default:
      return [{ ellipse: true, rx: s * 0.75, ry: s * 0.5 }]
  }
}

export function GlyphShape({ type, s, color, strokeWidth = 1.6, transform }) {
  return (
    <g transform={transform}>
      {glyphPaths(type, s).map((p, i) => p.circle ? (
        <circle key={i} r={p.r} style={{ fill: color }} />
      ) : p.ellipse ? (
        <ellipse key={i} rx={p.rx} ry={p.ry} fill="none" strokeWidth={strokeWidth * 0.8} style={{ stroke: color }} />
      ) : (
        <path key={i} d={p.d} fill="none" strokeWidth={strokeWidth}
          strokeLinecap="round" strokeLinejoin="round" style={{ stroke: color }} />
      ))}
    </g>
  )
}

/** Symbole isolé, pour la légende et les puces de détail. */
export default function StitchGlyph({ type, size = 18, color = 'currentColor' }) {
  return (
    <svg className="stitch-glyph" width={size} height={size} viewBox="-10 -10 20 20" aria-hidden="true">
      <GlyphShape type={type} s={7} color={color} strokeWidth={2} />
    </svg>
  )
}
