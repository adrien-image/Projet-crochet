import { useState } from 'react'

export default function PatternCard({ pattern, onOpen, onDelete }) {
  const done = pattern.checklist.filter((i) => i.done).length
  const total = pattern.checklist.length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="card" onClick={() => onOpen(pattern.id)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(pattern.id)}>
      <div className="card-thumb">
        {pattern.image
          ? <img src={pattern.image} alt={pattern.name} />
          : <span>🧶</span>}
      </div>
      <div className="card-body">
        <h3 className="card-title">{pattern.name}</h3>
        <div className="card-meta">
          {pattern.tags.map((t) => <span key={t}>#{t}</span>)}
          {pattern.text && <span>📝 texte</span>}
          {pattern.fileData && <span>📎 fichier</span>}
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        <div className="progress-label">
          {total ? `${done}/${total} étapes · ${pct}%` : 'Aucune étape cochable'}
        </div>
      </div>
      {onDelete && (
        <button className="btn small secondary delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(pattern.id) }}>
          Supprimer
        </button>
      )}
    </div>
  )
}
