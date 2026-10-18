import { patternProgress } from './progress'

export default function PatternCard({ pattern, onOpen, onDelete, onTag }) {
  const progress = patternProgress(pattern)
  const { rounds, steps, pct } = progress
  const finished = progress.total > 0 && progress.done === progress.total

  const onKeyDown = (e) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(pattern.id)
    }
  }

  return (
    <div className="card" onClick={() => onOpen(pattern.id)} role="button" tabIndex={0}
      aria-label={`Ouvrir ${pattern.name}`} onKeyDown={onKeyDown}>
      <div className="card-thumb">
        {pattern.thumb || pattern.image
          ? <img src={pattern.thumb || pattern.image} alt="" loading="lazy" />
          : <span aria-hidden="true">🧶</span>}
        {finished && <span className="card-badge">✓ Terminé</span>}
      </div>
      <div className="card-body">
        <h3 className="card-title">{pattern.name}</h3>
        <div className="card-meta">
          {pattern.tags.map((t) => (
            <button key={t} type="button" className="tag link-btn"
              onClick={(e) => { e.stopPropagation(); onTag?.(t) }}>#{t}</button>
          ))}
          {pattern.hook && <span>🪝 {pattern.hook}</span>}
          {pattern.fileId && <span>📎 fichier</span>}
        </div>
        <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
          aria-label="Progression">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-label">
          {progress.total === 0 && 'Aucun rang ni étape'}
          {rounds.total > 0 && `${rounds.done}/${rounds.total} rangs`}
          {rounds.total > 0 && steps.total > 0 && ' · '}
          {steps.total > 0 && `${steps.done}/${steps.total} étapes`}
          {progress.total > 0 && ` · ${pct}%`}
        </div>
      </div>
      {onDelete && (
        <button type="button" className="btn small secondary delete-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(pattern.id) }}>
          Supprimer
        </button>
      )}
    </div>
  )
}
