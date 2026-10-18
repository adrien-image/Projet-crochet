import { useState } from 'react'
import Visualizer from './Visualizer'
import Amigurumi3D from './Amigurumi3D'
import { uid } from './storage'

const isImage = (pattern) => pattern.image
const hasPdf = (pattern) => pattern.fileData

export default function PatternDetail({ pattern, onToggle, onAddItem, onDeleteItem, onEditPattern, onBack }) {
  const [newItem, setNewItem] = useState('')
  const [tab, setTab] = useState('pattern') // pattern | viz | 3d

  const done = pattern.checklist.filter((i) => i.done).length
  const total = pattern.checklist.length
  const pct = total ? Math.round((done / total) * 100) : 0

  const add = (e) => {
    e.preventDefault()
    const text = newItem.trim()
    if (!text) return
    onAddItem(pattern.id, { id: uid(), text, done: false })
    setNewItem('')
  }

  return (
    <div className="detail">
      <div className="detail-top">
        <div>
          <h2>{pattern.name}</h2>
          {pattern.description && <p className="desc">{pattern.description}</p>}
        </div>
        <div className="detail-actions">
          <button className="btn small" onClick={onBack}>← Retour</button>
          <button className="btn small secondary" onClick={() => onEditPattern(pattern)}>Modifier</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'pattern' ? 'active' : ''}`} onClick={() => setTab('pattern')}>
          📄 Patron & image
        </button>
        <button className={`tab-btn ${tab === 'viz' ? 'active' : ''}`} onClick={() => setTab('viz')}>
          📊 Visualiseur de rangs
        </button>
        <button className={`tab-btn ${tab === '3d' ? 'active' : ''}`} onClick={() => setTab('3d')}>
          🧶 Aperçu 3D
        </button>
      </div>

      {tab === '3d' ? (
        <div className="viz-wrap">
          <Amigurumi3D pattern={pattern} />
        </div>
      ) : tab === 'viz' ? (
        <div className="viz-wrap">
          <Visualizer pattern={pattern} checklist={pattern.checklist} onToggle={(item) => {
            if (item.id) {
              const existing = pattern.checklist.find((i) => i.id === item.id)
              if (existing) return onToggle(pattern.id, item.id)
            }
            onAddItem(pattern.id, item)
          }} />
        </div>
      ) : (
      <>

      <div className="detail-body">
        <div className="detail-pattern">
          <h4 className="panel-title">Patron</h4>
          {pattern.fileData && (
            <p className="pattern-file-link">
              <a href={pattern.fileData} target="_blank" rel="noreferrer">📎 Ouvrir le fichier ({pattern.fileName})</a>
            </p>
          )}
          {pattern.text
            ? <div className="pattern-text">{pattern.text}</div>
            : !pattern.fileData && <p className="placeholder">Aucun contenu de patron. Utilise « Modifier » pour ajouter du texte ou un fichier.</p>}
        </div>

        <div className="detail-image">
          <h4 className="panel-title">Image</h4>
          {isImage(pattern)
            ? <img src={pattern.image} alt={pattern.name} />
            : <div className="placeholder">Pas encore d'image. Utilise « Modifier » pour en ajouter une.</div>}
          {hasPdf(pattern) && null}
        </div>
      </div>

      <div className="checklist">
        <div className="panel-title-row">
          <h4 className="panel-title">
            Progression — {total ? `${done}/${total} (${pct}%)` : 'aucune étape'}
          </h4>
        </div>
        <div className="progress-bar" style={{ height: 10 }}><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        {pattern.checklist.length > 0 && (
          <ul>
            {pattern.checklist.map((item) => (
              <li key={item.id} className={`check-item ${item.done ? 'done' : ''}`}>
                <input type="checkbox" checked={item.done}
                  onChange={() => onToggle(pattern.id, item.id)} />
                <span onClick={() => onToggle(pattern.id, item.id)}>{item.text}</span>
                <button className="del" onClick={() => onDeleteItem(pattern.id, item.id)}>✕</button>
              </li>
            ))}
          </ul>
        )}
        <form className="add-row" onSubmit={add}>
          <input type="text" value={newItem} placeholder="Ajouter une étape (ex. Rang 12 : 24 ms)"
            onChange={(e) => setNewItem(e.target.value)} />
          <button type="submit" className="btn small">+ Ajouter</button>
        </form>
      </div>

      </>
      )}
    </div>
  )
}
