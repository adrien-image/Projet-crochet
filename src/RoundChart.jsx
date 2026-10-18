import { useMemo } from 'react'
import { parsePattern, stitchCount, STITCH_INFO } from './patternParser'

const RING_R = 46

function polar(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

export default function RoundChart({ round, index, totalRounds, done, active, onClick }) {
  const n = Math.max(round.stitches.length, 1)
  const cx = 60
  const cy = 60
  const gap = 360 / n

  const nodes = round.stitches.map((type, i) => {
    const [x, y] = polar(cx, cy, RING_R, i * gap)
    return { type, x, y }
  })

  const sectionColor = useMemo(() => {
    const palette = ['#c2703d', '#7a9a65', '#5b7fa6', '#a65b7f', '#a68f5b']
    let h = 0
    for (const c of round.section || '') h = (h * 31 + c.charCodeAt(0)) % 997
    return palette[h % palette.length]
  }, [round.section])

  return (
    <button
      className={`round-card ${active ? 'active' : ''} ${done ? 'done' : ''}`}
      onClick={onClick}
      title={round.section ? `${round.section} — ${round.label}` : round.label}
    >
      <svg viewBox="0 0 120 120" width="120" height="120">
        <circle cx={cx} cy={cy} r={RING_R} fill="none"
          stroke={done ? '#a9c39a' : 'var(--border)'} strokeWidth="2" strokeDasharray="3 3" />
        {nodes.map((nd, i) => {
          const angle = i * gap
          const rad = ((angle - 90) * Math.PI) / 180
          const symbolColor = done ? '#6b8f5e' : sectionColor
          const symbol = STITCH_INFO[nd.type]?.symbol ?? '?'
          return symbol === '✕' ? (
            <line key={i} x1={nd.x - 4 * Math.cos(rad + 0.785)} y1={nd.y - 4 * Math.sin(rad + 0.785)}
              x2={nd.x + 4 * Math.cos(rad + 0.785)} y2={nd.y + 4 * Math.sin(rad + 0.785)}
              stroke={symbolColor} strokeWidth="1.6" />
          ) : symbol === 'T' ? (
            <line key={i} x1={nd.x} y1={nd.y - 5} x2={nd.x} y2={nd.y + 4} stroke={symbolColor} strokeWidth="1.6" />
          ) : symbol === 'V' ? (
            <path key={i} d={`M ${nd.x - 4} ${nd.y + 3} L ${nd.x} ${nd.y - 4} L ${nd.x + 4} ${nd.y + 3}`}
              fill="none" stroke={symbolColor} strokeWidth="1.6" />
          ) : symbol === '∧' ? (
            <path key={i} d={`M ${nd.x - 4} ${nd.y - 3} L ${nd.x} ${nd.y + 4} L ${nd.x + 4} ${nd.y - 3}`}
              fill="none" stroke={symbolColor} strokeWidth="1.6" />
          ) : symbol === '·' ? (
            <circle key={i} cx={nd.x} cy={nd.y} r="1.4" fill={symbolColor} />
          ) : (
            <circle key={i} cx={nd.x} cy={nd.y} r="2.6" fill="none" stroke={symbolColor} strokeWidth="1.3" />
          )
        })}
        <text x={cx} y={cy + 3} textAnchor="middle" fontSize="11" fontWeight="600"
          fill={done ? '#6b8f5e' : 'var(--text)'}>
          {round.label}
        </text>
      </svg>
      <div className="round-meta">
        <span className="pill" style={{ borderColor: sectionColor, color: sectionColor }}>
          {stitchCount(round.stitches)} mailles
        </span>
        {round.expected != null && !round.valid && <span className="pill warn">⚠ attendu {round.expected}</span>}
      </div>
      {round.section && <div className="round-section" title={round.section}>{round.section}</div>}
      {index != null && totalRounds != null && (
        <div className="round-state">{done ? '✓ fait' : `${index + 1}/${totalRounds}`}</div>
      )}
    </button>
  )
}
