import { glyphPaths } from './glyphs'

// Les couleurs passent par `style` pour accepter var(--…).
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
