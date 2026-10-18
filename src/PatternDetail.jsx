import { useState } from 'react'
import Visualizer from './Visualizer'
import Amigurumi3D from './Amigurumi3D'
import RoundCounter from './RoundCounter'
import { uid } from './storage'
import { patternProgress } from './progress'
import { useAssetUrl } from './hooks/useAssetUrl'

const TABS = [
  ['pattern', '📄 Patron'],
  ['counter', '🔢 Compteur'],
  ['viz', '📊 Rangs'],
  ['3d', '🧶 Aperçu 3D'],
]

function AttachedFile({ pattern }) {
  const url = useAssetUrl(pattern.fileId)
  if (!pattern.fileId) return pattern.fileData ? <p className="placeholder">📎 Fichier en cours de migration…</p> : null
  if (!url) return <p className="placeholder">📎 Chargement du fichier…</p>
  const type = pattern.fileType || ''
  const name = pattern.fileName || 'patron'
  return (
    <div className="attached-file">
      <p className="pattern-file-link">
        <a href={url} target="_blank" rel="noreferrer">📎 Ouvrir {name}</a>
        {' · '}
        <a href={url} download={name}>Télécharger</a>
      </p>
      {type === 'application/pdf' && <iframe className="file-preview" src={url} title={name} />}
      {type.startsWith('image/') && <img className="file-preview-img" src={url} alt={name} />}
    </div>
  )
}

function PatternImage({ pattern }) {
  const url = useAssetUrl(pattern.imageId)
  const src = url || pattern.image || pattern.thumb
  return src
    ? <img src={src} alt={pattern.name} />
    : <div className="placeholder">Pas encore d'image. Utilisez « Modifier » pour en ajouter une.</div>
}

function Checklist({ items, onChange }) {
  const [newItem, setNewItem] = useState('')
  const [editing, setEditing] = useState(null) // { id, text }

  const add = (e) => {
    e.preventDefault()
    const text = newItem.trim()
    if (!text) return
    onChange((list) => [...list, { id: uid(), text, done: false }])
    setNewItem('')
  }
  const move = (index, delta) => onChange((list) => {
    const next = [...list]
    const j = index + delta
    if (j < 0 || j >= next.length) return list
    ;[next[index], next[j]] = [next[j], next[index]]
    return next
  })
  const saveEdit = () => {
    if (!editing) return
    const text = editing.text.trim()
    if (text) onChange((list) => list.map((i) => (i.id === editing.id ? { ...i, text } : i)))
    setEditing(null)
  }

  return (
    <>
      {items.length > 0 && (
        <ul>
          {items.map((item, index) => (
            <li key={item.id} className={`check-item ${item.done ? 'done' : ''}`}>
              {editing?.id === item.id ? (
                <form className="edit-row" onSubmit={(e) => { e.preventDefault(); saveEdit() }}>
                  <input type="text" value={editing.text} autoFocus aria-label="Modifier l'étape"
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(null) } }}
                    onBlur={saveEdit} />
                </form>
              ) : (
                <label>
                  <input type="checkbox" checked={item.done}
                    onChange={() => onChange((list) => list.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))} />
                  <span>{item.text}</span>
                </label>
              )}
              <div className="item-actions">
                <button type="button" className="del" aria-label="Monter" disabled={index === 0}
                  onClick={() => move(index, -1)}>↑</button>
                <button type="button" className="del" aria-label="Descendre" disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}>↓</button>
                <button type="button" className="del" aria-label={`Modifier l'étape ${item.text}`}
                  onClick={() => setEditing({ id: item.id, text: item.text })}>✎</button>
                <button type="button" className="del danger" aria-label={`Supprimer l'étape ${item.text}`}
                  onClick={() => onChange((list) => list.filter((i) => i.id !== item.id))}>✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="add-row" onSubmit={add}>
        <input type="text" value={newItem} placeholder="Ajouter une étape (ex. Coudre les bras)"
          aria-label="Nouvelle étape" onChange={(e) => setNewItem(e.target.value)} />
        <button type="submit" className="btn small">+ Ajouter</button>
      </form>
    </>
  )
}

export default function PatternDetail({
  pattern, onChecklist, onSetRounds, onStitchCounter, onEditPattern, onDelete, onBack,
}) {
  const [tab, setTab] = useState('pattern')
  const { rounds, steps } = patternProgress(pattern)
  const pct = (p) => (p.total ? Math.round((p.done / p.total) * 100) : 0)

  return (
    <div className="detail">
      <div className="detail-top">
        <div>
          <h2>{pattern.name}</h2>
          {pattern.description && <p className="desc">{pattern.description}</p>}
          <div className="card-meta">
            {pattern.hook && <span>🪝 Crochet {pattern.hook}</span>}
            {pattern.yarn && <span>🧶 {pattern.yarn}</span>}
            {pattern.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
          </div>
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

      {tab === 'counter' && (
        <div className="viz-wrap">
          <RoundCounter pattern={pattern} onSetRounds={onSetRounds} onStitchCounter={onStitchCounter} />
        </div>
      )}
      {tab === '3d' && <div className="viz-wrap"><Amigurumi3D pattern={pattern} /></div>}
      {tab === 'viz' && <div className="viz-wrap"><Visualizer pattern={pattern} onSetRounds={onSetRounds} /></div>}
      {tab === 'pattern' && (
        <>
          <div className="detail-body">
            <div className="detail-pattern">
              <h4 className="panel-title">Patron</h4>
              <AttachedFile pattern={pattern} />
              {pattern.text
                ? <div className="pattern-text">{pattern.text}</div>
                : !pattern.fileId && <p className="placeholder">Aucun contenu de patron. Utilisez « Modifier » pour ajouter du texte ou un fichier.</p>}
            </div>
            <div className="detail-image">
              <h4 className="panel-title">Image</h4>
              <PatternImage pattern={pattern} />
            </div>
          </div>

          <div className="checklist">
            {rounds.total > 0 && (
              <div className="progress-block">
                <h4 className="panel-title">
                  Rangs — {rounds.done}/{rounds.total} ({pct(rounds)}%)
                  <button type="button" className="link-btn" onClick={() => setTab('counter')}>ouvrir le compteur</button>
                </h4>
                <div className="progress-bar large"><div className="progress-fill" style={{ width: `${pct(rounds)}%` }} /></div>
              </div>
            )}
            <div className="progress-block">
              <h4 className="panel-title">Étapes — {steps.total ? `${steps.done}/${steps.total} (${pct(steps)}%)` : 'aucune'}</h4>
              <div className="progress-bar large steps"><div className="progress-fill" style={{ width: `${pct(steps)}%` }} /></div>
            </div>
            <Checklist items={pattern.checklist} onChange={onChecklist} />
          </div>
        </>
      )}
    </div>
  )
}
