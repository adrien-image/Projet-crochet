import { useMemo, useRef, useState } from 'react'
import { Download, Ellipsis, Plus, RotateCcw, Search, Upload, X } from 'lucide-react'
import type { Pattern } from '../../domain/types'
import { patternProgress } from '../../domain/progress'
import type { PatternTab } from '../../hooks/useHashRoute'
import { Menu } from '../../ui/Menu'
import { Segmented } from '../../ui/Segmented'
import { EmptyState } from '../../ui/EmptyState'
import { PatternCard } from './PatternCard'

type Filter = 'all' | 'todo' | 'in-progress' | 'done'
type Sort = 'recent' | 'created' | 'name' | 'progress'

const SORTS: Record<Sort, [string, (a: Pattern, b: Pattern) => number]> = {
  recent: ['Modifiés récemment', (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')],
  created: ['Ajoutés récemment', (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')],
  name: ['Nom (A → Z)', (a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })],
  progress: ['Progression', (a, b) => patternProgress(b).pct - patternProgress(a).pct],
}

interface Props {
  patterns: Pattern[]
  onOpen: (id: string, tab?: PatternTab) => void
  onNew: () => void
  onDelete: (id: string) => void
  onExport: () => void
  onImport: (file: File) => void
  onRestoreSamples: () => void
}

export function LibraryView({ patterns, onOpen, onNew, onDelete, onExport, onImport, onRestoreSamples }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [tag, setTag] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('recent')
  const importRef = useRef<HTMLInputElement>(null)

  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of patterns) for (const t of p.tags) counts.set(t, (counts.get(t) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
  }, [patterns])

  const counts = useMemo(() => {
    const c = { all: patterns.length, todo: 0, 'in-progress': 0, done: 0 }
    for (const p of patterns) {
      const { done, total } = patternProgress(p)
      if (total > 0 && done === total) c.done++
      else if (done > 0) c['in-progress']++
      else c.todo++
    }
    return c
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

  const hasSamples = patterns.some((p) => p.tags.includes('exemple'))

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <a className="brand" href="#" onClick={(e) => e.preventDefault()} aria-label="Mon Crochet">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="28" height="28" />
            <span>Mon Crochet</span>
          </a>
          <label className="search">
            <Search size={18} aria-hidden="true" />
            <input type="search" placeholder="Rechercher un patron, un fil, un tag…" value={query}
              aria-label="Rechercher" onChange={(e) => setQuery(e.target.value)} />
            {query && <button type="button" className="icon-btn ghost sm" onClick={() => setQuery('')} aria-label="Effacer"><X size={16} /></button>}
          </label>
          <div className="appbar-actions">
            <Menu label="Sauvegarde et options" icon={<Ellipsis size={20} />} items={[
              { label: 'Exporter une sauvegarde', icon: <Download size={16} />, onSelect: onExport, disabled: !patterns.length },
              { label: 'Importer une sauvegarde', icon: <Upload size={16} />, onSelect: () => importRef.current?.click() },
              { label: 'Restaurer les exemples', icon: <RotateCcw size={16} />, onSelect: onRestoreSamples, disabled: hasSamples },
            ]} />
            <input ref={importRef} type="file" accept="application/json,.json" hidden
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImport(f) }} />
            <button type="button" className="btn primary" onClick={onNew}>
              <Plus size={18} /><span className="hide-sm">Nouveau patron</span>
            </button>
          </div>
        </div>
      </header>

      <main className="page">
        <div className="library-head">
          <div>
            <h1>Mes patrons</h1>
            <p className="muted">{patterns.length} patron{patterns.length > 1 ? 's' : ''} · enregistrés sur cet appareil</p>
          </div>
          <div className="library-controls">
            <Segmented label="Filtrer par progression" value={filter} onChange={setFilter} options={[
              { value: 'all', label: <>Tous <small>{counts.all}</small></> },
              { value: 'todo', label: <>À commencer <small>{counts.todo}</small></> },
              { value: 'in-progress', label: <>En cours <small>{counts['in-progress']}</small></> },
              { value: 'done', label: <>Terminés <small>{counts.done}</small></> },
            ]} />
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Trier">
              {(Object.keys(SORTS) as Sort[]).map((k) => <option key={k} value={k}>{SORTS[k][0]}</option>)}
            </select>
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="tag-bar" role="group" aria-label="Filtrer par tag">
            {allTags.map(([t, n]) => (
              <button key={t} type="button" className={`chip ${tag === t ? 'active' : ''}`} aria-pressed={tag === t}
                onClick={() => setTag(tag === t ? null : t)}>
                #{t} <small>{n}</small>
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          patterns.length === 0 ? (
            <EmptyState icon="🧶" title="Votre bibliothèque est vide"
              action={<button className="btn primary" onClick={onNew}><Plus size={18} /> Ajouter un patron</button>}>
              Collez le texte d'un patron (« R1 : 6 ms dans un anneau magique (6) »…) pour obtenir le compteur,
              le rendu du tissu et l'aperçu 3D.
            </EmptyState>
          ) : (
            <EmptyState icon="🔎" title="Aucun résultat"
              action={<button className="btn ghost" onClick={() => { setQuery(''); setTag(null); setFilter('all') }}>Effacer les filtres</button>}>
              Aucun patron ne correspond à cette recherche.
            </EmptyState>
          )
        ) : (
          <div className="grid">
            {visible.map((p) => (
              <PatternCard key={p.id} pattern={p} onOpen={onOpen} onDelete={onDelete} onTag={setTag} />
            ))}
          </div>
        )}
        <p className="footnote">Vos données restent dans ce navigateur. Pensez à exporter une sauvegarde de temps en temps.</p>
      </main>
    </>
  )
}
