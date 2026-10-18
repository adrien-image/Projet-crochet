import { useMemo, useRef, useState } from 'react'
import { uid, samplePatterns, exportPatterns, importPatterns } from './storage'
import { parsePattern, parseOptions, remapRoundKeys } from './patternParser'
import { patternProgress } from './progress'
import { usePatterns } from './hooks/usePatterns'
import { useHashRoute } from './hooks/useHashRoute'
import { useToast } from './hooks/useToast'
import PatternCard from './PatternCard'
import PatternDetail from './PatternDetail'
import PatternForm from './PatternForm'

const FILTERS = [
  ['all', 'Tous'],
  ['todo', 'À commencer'],
  ['in-progress', 'En cours'],
  ['done', 'Terminés'],
]

const SORTS = {
  recent: ['Modifiés récemment', (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')],
  created: ['Ajoutés récemment', (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')],
  name: ['Nom (A → Z)', (a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })],
  progress: ['Progression', (a, b) => patternProgress(b).pct - patternProgress(a).pct],
}

export default function App() {
  const { toast, show: notify, hide: hideToast } = useToast()
  const { patterns, setPatterns, update } = usePatterns(() => notify(
    '⚠ Stockage du navigateur plein : la dernière modification n\'est pas sauvegardée. Exportez une sauvegarde puis supprimez des patrons.',
    { error: true },
  ))
  const [openId, navigate] = useHashRoute()
  const [editing, setEditing] = useState(null) // null | {} (nouveau) | patron
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [tag, setTag] = useState(null)
  const [sort, setSort] = useState('recent')
  const importRef = useRef(null)

  const open = useMemo(() => patterns.find((p) => p.id === openId), [patterns, openId])

  const allTags = useMemo(() => {
    const counts = new Map()
    for (const p of patterns) for (const t of p.tags) counts.set(t, (counts.get(t) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
  }, [patterns])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return patterns.filter((p) => {
      if (tag && !p.tags.includes(tag)) return false
      if (q && !`${p.name} ${p.description} ${p.tags.join(' ')} ${p.yarn} ${p.hook}`.toLowerCase().includes(q)) return false
      const { total, done } = patternProgress(p)
      if (filter === 'done') return total > 0 && done === total
      if (filter === 'in-progress') return done > 0 && done < total
      if (filter === 'todo') return done === 0
      return true
    }).sort(SORTS[sort][1])
  }, [patterns, query, filter, tag, sort])

  const savePattern = (data) => {
    if (data.id) {
      update(data.id, (p) => {
        const next = { ...p, ...data }
        // le texte a changé : on retrouve les rangs déjà cochés dans la nouvelle version
        if (p.text !== next.text || p.notation !== next.notation || p.size !== next.size) {
          next.roundsDone = remapRoundKeys(
            parsePattern(p.text, parseOptions(p)), parsePattern(next.text, parseOptions(next)), p.roundsDone,
          )
        }
        return next
      })
    } else {
      const now = new Date().toISOString()
      const p = {
        ...data, id: uid(), createdAt: now, updatedAt: now, checklist: [], roundsDone: [], stitchCounter: 0,
      }
      setPatterns((ps) => [p, ...ps])
      navigate(p.id)
    }
    setEditing(null)
    notify('Patron enregistré ✓')
  }

  // suppression immédiate, annulable quelques secondes depuis le message
  const deletePattern = (id) => {
    const index = patterns.findIndex((x) => x.id === id)
    if (index < 0) return
    const removed = patterns[index]
    setPatterns((ps) => ps.filter((x) => x.id !== id))
    if (openId === id) navigate(null)
    notify(`« ${removed.name} » supprimé`, {
      action: {
        label: 'Annuler',
        run: () => setPatterns((ps) => {
          if (ps.some((x) => x.id === id)) return ps
          const next = [...ps]
          next.splice(Math.min(index, next.length), 0, removed)
          return next
        }),
      },
    })
  }

  const setChecklist = (pid, fn) => update(pid, (p) => ({ ...p, checklist: fn(p.checklist) }))

  const setRoundsDone = (pid, keys, done) => update(pid, (p) => {
    const set = new Set(p.roundsDone)
    for (const k of keys) {
      if (done) set.add(k)
      else set.delete(k)
    }
    return { ...p, roundsDone: [...set] }
  })

  const onImport = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const imported = await importPatterns(file)
      setPatterns((ps) => {
        const ids = new Set(ps.map((p) => p.id))
        return [...imported.map((p) => (ids.has(p.id) ? { ...p, id: uid() } : p)), ...ps]
      })
      notify(`${imported.length} patron(s) importé(s) ✓`)
    } catch {
      notify('⚠ Fichier de sauvegarde illisible', { error: true })
    }
  }

  const onExport = async () => {
    try {
      await exportPatterns(patterns)
    } catch {
      notify('⚠ Export impossible', { error: true })
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
    <div className={`toast ${toast.error ? 'error' : ''}`} role="status">
      <span>{toast.text}</span>
      {toast.action && (
        <button type="button" className="toast-action" onClick={() => { toast.action.run(); hideToast() }}>
          {toast.action.label}
        </button>
      )}
    </div>
  )
  const form = editing && (
    <PatternForm initial={editing.id ? editing : null} onSave={savePattern} onCancel={() => setEditing(null)} />
  )

  if (open) {
    return (
      <div className="app">
        <PatternDetail
          pattern={open}
          onChecklist={(fn) => setChecklist(open.id, fn)}
          onSetRounds={(keys, done) => setRoundsDone(open.id, keys, done)}
          onStitchCounter={(n) => update(open.id, (p) => ({ ...p, stitchCounter: Math.max(0, n) }))}
          onEditPattern={(p) => setEditing(p)}
          onDelete={() => deletePattern(open.id)}
          onBack={() => navigate(null)}
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
          <button className="btn secondary small" onClick={onExport} disabled={!patterns.length}
            title="Télécharger une sauvegarde de tous vos patrons, fichiers compris (JSON)">⬇ Exporter</button>
          <button className="btn secondary small" onClick={() => importRef.current?.click()}
            title="Importer une sauvegarde (JSON)">⬆ Importer</button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
          <button className="btn" onClick={() => setEditing({})}>+ Nouveau patron</button>
        </div>
      </header>

      <div className="toolbar">
        <input className="search" type="search" placeholder="Rechercher un patron, un fil…" value={query}
          aria-label="Rechercher un patron" onChange={(e) => setQuery(e.target.value)} />
        <div className="filters" role="group" aria-label="Filtrer par progression">
          {FILTERS.map(([f, label]) => (
            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} aria-pressed={filter === f}
              onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
        <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier">
          {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {allTags.length > 0 && (
        <div className="tag-bar" role="group" aria-label="Filtrer par tag">
          {allTags.map(([t, n]) => (
            <button key={t} type="button" className={`tag-chip ${tag === t ? 'active' : ''}`} aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? null : t)}>
              #{t} <small>{n}</small>
            </button>
          ))}
        </div>
      )}

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
            <PatternCard key={p.id} pattern={p} onOpen={navigate} onDelete={deletePattern} onTag={setTag} />
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
