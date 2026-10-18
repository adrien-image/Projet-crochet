import { useState } from 'react'
import Visualizer from './Visualizer'
import Amigurumi3D from './Amigurumi3D'
import { uid, dataUrlToBlobUrl } from './storage'

const TABS = [
  ['pattern', '📄 Patron & image'],
  ['viz', '📊 Visualiseur de rangs'],
  ['3d', '🧶 Aperçu 3D'],
]

const mimeOf = (dataUrl) => dataUrl?.match(/^data:([^;,]+)/)?.[1] ?? ''

// Les navigateurs bloquent l'ouverture directe d'une URL data: : on passe par une URL blob,
// mise en cache pour le fichier actuellement affiché.
let blobCache = { dataUrl: null, url: null }
function blobUrlFor(dataUrl) {
  if (blobCache.dataUrl !== dataUrl) {
    if (blobCache.url) URL.revokeObjectURL(blobCache.url)
    let url = null
    try {
      url = dataUrlToBlobUrl(dataUrl)
    } catch {
      url = null
    }
    blobCache = { dataUrl, url }
  }
  return blobCache.url
}

function AttachedFile({ fileData, fileName }) {
  const url = blobUrlFor(fileData)
  const mime = mimeOf(fileData)
  if (!url) return null
  return (
    <div className="attached-file">
      <p className="pattern-file-link">
        <a href={url} target="_blank" rel="noreferrer">📎 Ouvrir {fileName || 'le fichier'}</a>
        {' · '}
        <a href={url} download={fileName || 'patron'}>Télécharger</a>
      </p>
      {mime === 'application/pdf' && <iframe className="file-preview" src={url} title={fileName || 'Fichier du patron'} />}
      {mime.startsWith('image/') && <img className="file-preview-img" src={url} alt={fileName || 'Fichier du patron'} />}
    </div>
  )
}

export default function PatternDetail({
  pattern, onToggle, onAddItem, onDeleteItem, onSetRounds, onEditPattern, onDelete, onBack,
}) {
  const [newItem, setNewItem] = useState('')
  const [tab, setTab] = useState('pattern')

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
          {pattern.tags.length > 0 && (
            <div className="card-meta">{pattern.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</div>
          )}
        </div>
        <div className="detail-actions">
          <button className="btn small" onClick={onBack}>← Retour</button>
          <button className="btn small secondary" onClick={() => onEditPattern(pattern)}>Modifier</button>
          <button className="btn small danger" onClick={onDelete}>Supprimer</button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id}
            className={`tab-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === '3d' && (
        <div className="viz-wrap"><Amigurumi3D pattern={pattern} /></div>
      )}
      {tab === 'viz' && (
        <div className="viz-wrap"><Visualizer pattern={pattern} onSetRounds={onSetRounds} /></div>
      )}
      {tab === 'pattern' && (
        <>
          <div className="detail-body">
            <div className="detail-pattern">
              <h4 className="panel-title">Patron</h4>
              {pattern.fileData && <AttachedFile fileData={pattern.fileData} fileName={pattern.fileName} />}
              {pattern.text
                ? <div className="pattern-text">{pattern.text}</div>
                : !pattern.fileData && <p className="placeholder">Aucun contenu de patron. Utilisez « Modifier » pour ajouter du texte ou un fichier.</p>}
            </div>

            <div className="detail-image">
              <h4 className="panel-title">Image</h4>
              {pattern.image
                ? <img src={pattern.image} alt={pattern.name} />
                : <div className="placeholder">Pas encore d'image. Utilisez « Modifier » pour en ajouter une.</div>}
            </div>
          </div>

          <div className="checklist">
            <h4 className="panel-title">
              Progression — {total ? `${done}/${total} (${pct}%)` : 'aucune étape'}
            </h4>
            <div className="progress-bar large"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
            {total > 0 && (
              <ul>
                {pattern.checklist.map((item) => (
                  <li key={item.id} className={`check-item ${item.done ? 'done' : ''}`}>
                    <label>
                      <input type="checkbox" checked={item.done} onChange={() => onToggle(pattern.id, item.id)} />
                      <span>{item.text}</span>
                    </label>
                    <button type="button" className="del" aria-label={`Supprimer l'étape ${item.text}`}
                      onClick={() => onDeleteItem(pattern.id, item.id)}>✕</button>
                  </li>
                ))}
              </ul>
            )}
            <form className="add-row" onSubmit={add}>
              <input type="text" value={newItem} placeholder="Ajouter une étape (ex. Rang 12 : 24 ms)"
                aria-label="Nouvelle étape" onChange={(e) => setNewItem(e.target.value)} />
              <button type="submit" className="btn small">+ Ajouter</button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
