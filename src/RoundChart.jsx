import { GlyphShape } from './StitchGlyph'
import { sectionColor } from './colors'

const RING_R = 46
const SIZE = 120

export default function RoundChart({ round, done, active, onClick }) {
  const n = round.stitches.length
  const c = SIZE / 2
  const gap = 360 / Math.max(n, 1)
  // taille des symboles adaptée à la place disponible sur l'anneau
  const s = Math.max(1.8, Math.min(4.5, ((2 * Math.PI * RING_R) / Math.max(n, 1)) * 0.42))
  const color = done ? 'var(--done)' : sectionColor(round.section)
  const warn = !round.valid || round.fits === false

  return (
    <button
      type="button"
      className={`round-card ${active ? 'active' : ''} ${done ? 'done' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      title={round.section ? `${round.section} — ${round.label}` : round.label}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
        <circle cx={c} cy={c} r={RING_R} fill="none" strokeWidth="1.5" strokeDasharray="3 3"
          style={{ stroke: done ? 'var(--done-border)' : 'var(--border)' }} />
        {round.stitches.map((type, i) => {
          const angle = i * gap
          const a = ((angle - 90) * Math.PI) / 180
          const x = c + RING_R * Math.cos(a)
          const y = c + RING_R * Math.sin(a)
          return (
            <GlyphShape key={i} type={type} s={s} color={color} strokeWidth={s < 3 ? 1.1 : 1.5}
              transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(1)})`} />
          )
        })}
        <text x={c} y={c + 4} textAnchor="middle" fontSize="12" fontWeight="600"
          style={{ fill: done ? 'var(--done)' : 'var(--text)' }}>
          {round.label}
        </text>
      </svg>
      <span className="round-meta">
        <span className="pill" style={{ borderColor: color, color }}>{round.count} m.</span>
        {warn && <span className="pill warn" title="Compte incohérent">⚠</span>}
        {done && <span className="pill ok">✓</span>}
      </span>
    </button>
  )
}
