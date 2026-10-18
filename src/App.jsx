import { useEffect, useMemo, useRef, useState } from 'react'
import {
  loadPatterns, savePatterns, uid, samplePatterns, exportPatterns, importPatterns,
} from './storage'
import PatternCard from './PatternCard'
import PatternDetail from './PatternDetail'
import PatternForm from './PatternForm'

const FILTERS = [
  ['all', 'Tous'],
  ['todo', 'À commencer'],
  ['in-progress', 'En cours'],
  ['done', 'Terminés'],
]

function progress(p) {
  const total = p.checklist.length
  const done = p.checklist.filter((i) => i.done).length
  return { total, done }
}

// Le patron ouvert est reflété dans l'URL (#/patron/<id>) : bouton « retour » et rechargement fonctionnent.
const idFromHash = () => decodeURIComponent(window.location.hash.match(/^#\/patron\/(.+)$/)?.[1] ?? '') || null

export default function App() {
  const [patterns, setPatterns] = useState(() => loadPatterns())
  const [openId, setOpenId] = useState(idFromHash)
  const [editing, setEditing] = useState(null) // null | {} (nouveau) | patron
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [toast, setToast] = useState(null) // { text, error }
  const importRef = useRef(null)
  const firstSave = useRef(true)

  useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false
      return
    }
    if (!savePatterns(patterns)) {
      // l'écriture dans localStorage est l'effet externe ; on signale son échec
      // oxlint-disable-next-line react/set-state-in-effect
      setToast({ text: '⚠ Stockage du navigateur plein : la dernière modification n\'est pas sauvegardée. Supprimez des fichiers/images ou exportez une sauvegarde.', error: true })
    }
  }, [patterns])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.error ? 6000 : 2200)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const onHash = () => setOpenId(idFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const openPattern = (id) => {
    if (id) window.location.hash = `#/patron/${encodeURIComponent(id)}`
    else if (window.location.hash) window.history.pushState(null, '', window.location.pathname + window.location.search)
    setOpenId(id)
    window.scrollTo?.(0, 0)
  }

  const notify = (text) => setToast({ text })

  const updatePattern = (id, fn) => setPatterns((ps) => ps.map((p) => (p.id === id ? fn(p) : p)))

  const open = useMemo(() => patterns.find((p) => p.id === openId), [patterns, openId])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return patterns.filter((p) => {
      if (q && !`${p.name} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(q)) return false
      const { total, done } = progress(p)
      if (filter === 'done') return total > 0 && done === total
      if (filter === 'in-progress') return done > 0 && done < total
      if (filter === 'todo') return done === 0
      return true
    })
  }, [patterns, query, filter])

  const savePattern = (data) => {
    if (data.id) {
      updatePattern(data.id, (p) => ({ ...p, ...data }))
    } else {
      const p = { ...data, id: uid(), createdAt: new Date().toISOString(), checklist: [] }
      setPatterns((ps) => [p, ...ps])
      openPattern(p.id)
    }
    setEditing(null)
    notify('Patron enregistré ✓')
  }

  const deletePattern = (id) => {
    const p = patterns.find((x) => x.id === id)
    if (!confirm(`Supprimer « ${p?.name ?? 'ce patron'} » ? Cette action est définitive.`)) return
    setPatterns((ps) => ps.filter((x) => x.id !== id))
    if (openId === id) openPattern(null)
    notify('Patron supprimé')
  }

  const toggleItem = (pid, itemId) => updatePattern(pid, (p) => ({
    ...p, checklist: p.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
  }))

  const addItem = (pid, item) => updatePattern(pid, (p) => ({ ...p, checklist: [...p.checklist, item] }))

  const deleteItem = (pid, itemId) => updatePattern(pid, (p) => ({
    ...p, checklist: p.checklist.filter((i) => i.id !== itemId),
  }))

  // Coche/décoche des rangs du visualiseur ; crée l'étape correspondante si besoin.
  const setRoundsDone = (pid, items, done) => updatePattern(pid, (p) => {
    const byId = new Map(items.map((i) => [i.id, i]))
    const checklist = p.checklist.map((i) => (byId.has(i.id) ? { ...i, done } : i))
    if (done) {
      const existing = new Set(p.checklist.map((i) => i.id))
      for (const it of items) if (!existing.has(it.id)) checklist.push({ ...it, done: true })
    }
    return { ...p, checklist }
  })

  const onImport = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const imported = await importPatterns(file)
      setPatterns((ps) => {
        const ids = new Set(ps.map((p) => p.id))
        const fresh = imported.map((p) => (ids.has(p.id) ? { ...p, id: uid() } : p))
        return [...fresh, ...ps]
      })
      notify(`${imported.length} patron(s) importé(s) ✓`)
    } catch {
      setToast({ text: '⚠ Fichier de sauvegarde illisible', error: true })
    }
  }

  const restoreSamples = () => {
    setPatterns((ps) => {
      const names = new Set(ps.map((p) => p.name))
      return [...ps, ...samplePatterns().filter((p) => !names.has(p.name))]
    })
    notify('Patrons d\'exemple restaurés ✓')
  }

  const toastEl = toast && (
    <div className={`toast ${toast.error ? 'error' : ''}`} role="status">{toast.text}</div>
  )
  const form = editing && (
    <PatternForm initial={editing.id ? editing : null} onSave={savePattern} onCancel={() => setEditing(null)} />
  )

  if (open) {
    return (
      <div className="app">
        <PatternDetail
          pattern={open}
          onToggle={toggleItem}
          onAddItem={addItem}
          onDeleteItem={deleteItem}
          onSetRounds={(items, done) => setRoundsDone(open.id, items, done)}
          onEditPattern={(p) => setEditing(p)}
          onDelete={() => deletePattern(open.id)}
          onBack={() => openPattern(null)}
        />
        {form}
        {toastEl}
      </div>
    )
  }

  const hasSamples = patterns.some((p) => p.tags.includes('exemple'))

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>🧶 Mon Crochet</h1>
          <p className="tagline">Votre collection de patrons, votre progression au même endroit.</p>
        </div>
        <div className="header-actions">
          <button className="btn secondary small" onClick={() => exportPatterns(patterns)} disabled={!patterns.length}
            title="Télécharger une sauvegarde de tous vos patrons (JSON)">⬇ Exporter</button>
          <button className="btn secondary small" onClick={() => importRef.current?.click()}
            title="Importer une sauvegarde (JSON)">⬆ Importer</button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
          <button className="btn" onClick={() => setEditing({})}>+ Nouveau patron</button>
        </div>
      </header>

      <div className="toolbar">
        <input className="search" type="search" placeholder="Rechercher un patron…" value={query}
          aria-label="Rechercher un patron" onChange={(e) => setQuery(e.target.value)} />
        <div className="filters" role="group" aria-label="Filtrer par progression">
          {FILTERS.map(([f, label]) => (
            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} aria-pressed={filter === f}
              onClick={() => setFilter(f)}>
              {label}
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
            <PatternCard key={p.id} pattern={p} onOpen={openPattern} onDelete={deletePattern} />
          ))}
        </div>
      )}

      <footer className="footer">
        Données enregistrées uniquement dans ce navigateur — pensez à exporter une sauvegarde.
        {!hasSamples && (
          <> · <button className="link-btn" onClick={restoreSamples}>Restaurer les patrons d'exemple</button></>
        )}
      </footer>

      {form}
      {toastEl}
    </div>
  )
}
