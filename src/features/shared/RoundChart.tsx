import type { Round } from '../../domain/types'
import { GlyphShape } from './StitchGlyph'
import { sectionColor } from '../../domain/colors'
import { chartLayout, directionArrow, CHART_SIZE, RING_R } from '../../render2d/glyphs'

/** Diagramme à symboles d'un rang (conventions internationales). */
export function RoundChart({ round, done, active, onClick }: { round: Round, done: boolean, active: boolean, onClick: () => void }) {
  const layout = chartLayout(round)
  const c = CHART_SIZE / 2
  const color = done ? 'var(--success)' : sectionColor(round.section)
  const warn = !round.valid || round.fits === false
  const sw = layout.s < 3 ? 1.1 : 1.5
  return (
    <button type="button" className={`chart-card ${active ? 'active' : ''} ${done ? 'done' : ''}`}
      onClick={onClick} aria-pressed={active} title={round.text}>
      <svg viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`} width={CHART_SIZE} height={CHART_SIZE} aria-hidden="true">
        {layout.flat ? (
          <line x1="8" x2={CHART_SIZE - 8} y1={c + 11} y2={c + 11} strokeWidth="1.5" strokeDasharray="3 3" style={{ stroke: 'var(--line)' }} />
        ) : (
          <circle cx={c} cy={c} r={RING_R} fill="none" strokeWidth="1.5" strokeDasharray="3 3" style={{ stroke: 'var(--line)' }} />
        )}
        <path d={directionArrow(layout)} fill="none" strokeWidth="1.2" strokeLinecap="round" style={{ stroke: 'var(--ink-3)' }} opacity="0.7" />
        {layout.nodes.map((nd, i) => (
          <GlyphShape key={i} type={nd.type} s={layout.s} color={color} strokeWidth={sw}
            transform={`translate(${nd.x.toFixed(2)} ${nd.y.toFixed(2)}) rotate(${nd.rot.toFixed(1)})`} />
        ))}
        <text x={c} y={layout.flat ? c - 16 : c + 4} textAnchor="middle" fontSize="12" fontWeight="650"
          style={{ fill: done ? 'var(--success)' : 'var(--ink)' }}>
          {round.label}
        </text>
      </svg>
      <span className="chart-meta">
        <span>{round.count} m.</span>
        {round.loop && <span className="chip xs">{round.loop === 'blo' ? 'brin arr.' : 'brin av.'}</span>}
        {warn && <span className="chip xs warn">à vérifier</span>}
      </span>
    </button>
  )
}
