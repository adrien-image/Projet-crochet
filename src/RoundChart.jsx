import { GlyphShape } from './StitchGlyph'
import { sectionColor } from './colors'
import { chartLayout, directionArrow, CHART_SIZE, RING_R } from './glyphs'

export default function RoundChart({ round, done, active, onClick }) {
  const layout = chartLayout(round)
  const c = CHART_SIZE / 2
  const color = done ? 'var(--done)' : sectionColor(round.section)
  const warn = !round.valid || round.fits === false
  const sw = layout.s < 3 ? 1.1 : 1.5

  return (
    <button
      type="button"
      className={`round-card ${active ? 'active' : ''} ${done ? 'done' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      title={round.text}
    >
      <svg viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`} width={CHART_SIZE} height={CHART_SIZE} aria-hidden="true">
        {layout.flat ? (
          <line x1="8" x2={CHART_SIZE - 8} y1={c + 11} y2={c + 11} strokeWidth="1.5" strokeDasharray="3 3"
            style={{ stroke: done ? 'var(--done-border)' : 'var(--border)' }} />
        ) : (
          <circle cx={c} cy={c} r={RING_R} fill="none" strokeWidth="1.5" strokeDasharray="3 3"
            style={{ stroke: done ? 'var(--done-border)' : 'var(--border)' }} />
        )}
        <path d={directionArrow(layout)} fill="none" strokeWidth="1.2" strokeLinecap="round"
          style={{ stroke: 'var(--muted)' }} opacity="0.6" />
        {layout.nodes.map((nd, i) => (
          <GlyphShape key={i} type={nd.type} s={layout.s} color={color} strokeWidth={sw}
            transform={`translate(${nd.x.toFixed(2)} ${nd.y.toFixed(2)}) rotate(${nd.rot.toFixed(1)})`} />
        ))}
        <text x={c} y={layout.flat ? c - 16 : c + 4} textAnchor="middle" fontSize="12" fontWeight="600"
          style={{ fill: done ? 'var(--done)' : 'var(--text)' }}>
          {round.label}
        </text>
      </svg>
      <span className="round-meta">
        <span className="pill" style={{ borderColor: color, color }}>{round.count} m.</span>
        {round.loop && <span className="pill" title={round.loop === 'blo' ? 'Brin arrière' : 'Brin avant'}>
          {round.loop === 'blo' ? 'BArr' : 'BAv'}</span>}
        {warn && <span className="pill warn" title="Compte incohérent">⚠</span>}
        {done && <span className="pill ok">✓</span>}
      </span>
    </button>
  )
}
