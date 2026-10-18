import { useEffect, useMemo, useState } from 'react'
import { loadPatterns, savePatterns, uid } from './storage'
import PatternCard from './PatternCard'
import PatternDetail from './PatternDetail'
import PatternForm from './PatternForm'

export default function App() {
  const [patterns, setPatterns] = useState(() => loadPatterns())
  const [openId, setOpenId] = useState(null)
  const [editing, setEditing] = useState(null) // null | {} (new) | pattern
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all') // all | in-progress | done
  const [toast, setToast] = useState('')

  useEffect(() => savePatterns(patterns), [patterns])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const update = (id, patch) =>
    setPatterns((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const open = useMemo(() => patterns.find((p) => p.id === openId), [patterns, openId])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return patterns.filter((p) => {
      if (q && !`${p.name} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(q)) return false
      const total = p.checklist.length
      const done = p.checklist.filter((i) => i.done).length
      if (filter === 'done' && (total === 0 || done < total)) return false
      if (filter === 'in-progress' && !(total > 0 && done < total)) return false
      return true
    })
  }, [patterns, query, filter])

  const savePattern = (data) => {
    if (data.id) {
      update(data.id, data)
    } else {
      const p = { ...data, id: uid(), createdAt: new Date().toISOString(), checklist: [] }
      setPatterns((ps) => [p, ...ps])
    }
    setEditing(null)
    setToast('Patron enregistré ✓')
  }

  const deletePattern = (id) => {
    if (!confirm('Supprimer ce patron ?')) return
    setPatterns((ps) => ps.filter((p) => p.id !== id))
    if (openId === id) setOpenId(null)
    setToast('Patron supprimé')
  }

  const toggle = (pid, itemId) =>
    setPatterns((ps) => ps.map((p) => (p.id === pid ? {
      ...p,
      checklist: p.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
    } : p)))

  const addItem = (pid, item) =>
    setPatterns((ps) => ps.map((p) => (p.id === pid ? { ...p, checklist: [...p.checklist, item] } : p)))

  const deleteItem = (pid, itemId) =>
    setPatterns((ps) => ps.map((p) => (p.id === pid ? {
      ...p, checklist: p.checklist.filter((i) => i.id !== itemId),
    } : p)))

  if (open) {
    return (
      <div className="app">
        <PatternDetail
          pattern={open}
          onToggle={toggle}
          onAddItem={addItem}
          onDeleteItem={deleteItem}
          onEditPattern={(p) => setEditing(p)}
          onBack={() => setOpenId(null)}
        />
        {editing && (
          <PatternForm initial={editing} onSave={savePattern} onCancel={() => setEditing(null)} />
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>🧶 Mon Crochet</h1>
          <p className="tagline">Votre collection de patrons, votre progression au même endroit.</p>
        </div>
        <button className="btn" onClick={() => setEditing({})}>+ Nouveau patron</button>
      </header>

      <div className="toolbar">
        <input className="search" placeholder="Rechercher un patron…" value={query}
          onChange={(e) => setQuery(e.target.value)} />
        <div className="filters">
          {['all', 'in-progress', 'done'].map((f) => (
            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Tous' : f === 'in-progress' ? 'En cours' : 'Terminés'}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <div className="big">🧶</div>
          {patterns.length === 0
            ? <>Aucun patron pour l'instant. Cliquez sur « + Nouveau patron » pour commencer !</>
            : <>Aucun patron ne correspond à votre recherche.</>}
        </div>
      ) : (
        <div className="grid">
          {visible.map((p) => (
            <PatternCard key={p.id} pattern={p} onOpen={setOpenId} onDelete={deletePattern} />
          ))}
        </div>
      )}

      {editing && (
        <PatternForm initial={editing.id ? editing : null} onSave={savePattern} onCancel={() => setEditing(null)} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
