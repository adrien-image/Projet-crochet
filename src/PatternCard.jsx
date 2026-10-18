export default function PatternCard({ pattern, onOpen, onDelete }) {
  const done = pattern.checklist.filter((i) => i.done).length
  const total = pattern.checklist.length
  const pct = total ? Math.round((done / total) * 100) : 0

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
        {pattern.image
          ? <img src={pattern.image} alt="" loading="lazy" />
          : <span aria-hidden="true">🧶</span>}
        {total > 0 && done === total && <span className="card-badge">✓ Terminé</span>}
      </div>
      <div className="card-body">
        <h3 className="card-title">{pattern.name}</h3>
        <div className="card-meta">
          {pattern.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
          {pattern.text && <span>📝 texte</span>}
          {pattern.fileData && <span>📎 fichier</span>}
        </div>
        <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-label">
          {total ? `${done}/${total} étapes · ${pct}%` : 'Aucune étape cochable'}
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
