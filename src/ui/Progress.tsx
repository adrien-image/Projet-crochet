export function ProgressBar({ value, tone, label }: { value: number, tone?: 'done' | 'accent', label?: string }) {
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

/** Anneau de progression (pourcentage au centre). */
export function ProgressRing({ value, size = 44, label }: { value: number, size?: number, label?: string }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label ?? `${value} %`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
        <circle cx={size / 2} cy={size / 2} r={r} className={`ring-value ${value >= 100 ? 'done' : ''}`}
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span>{value >= 100 ? '✓' : `${value}%`}</span>
    </div>
  )
}
