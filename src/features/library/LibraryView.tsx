import { useMemo, useRef, useState } from 'react'
import {
  CloudOff, Download, Ellipsis, FolderSync, HardDrive, Languages, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, Upload, X,
} from 'lucide-react'
import type { Pattern } from '../../domain/types'
import { patternProgress } from '../../domain/progress'
import type { PatternTab } from '../../hooks/useHashRoute'
import type { SyncStatus } from '../../hooks/useFileSync'
import { t, tn, getLang, type Lang } from '../../i18n'
import { Menu, type MenuItem } from '../../ui/Menu'
import { Segmented } from '../../ui/Segmented'
import { EmptyState } from '../../ui/EmptyState'
import { PatternCard } from './PatternCard'

type Filter = 'all' | 'todo' | 'in-progress' | 'done'
type Sort = 'recent' | 'created' | 'name' | 'progress'

const SORTS: Record<Sort, [string, (a: Pattern, b: Pattern) => number]> = {
  recent: ['Modifiés récemment', (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')],
  created: ['Ajoutés récemment', (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')],
  name: ['Nom (A → Z)', (a, b) => a.name.localeCompare(b.name, getLang(), { sensitivity: 'base' })],
  progress: ['Progression', (a, b) => patternProgress(b).pct - patternProgress(a).pct],
}

export interface SyncInfo {
  status: SyncStatus
  fileName: string | null
  link: () => void
  reconnect: () => void
  unlink: () => void
}

interface Props {
  patterns: Pattern[]
  onOpen: (id: string, tab?: PatternTab) => void
  onNew: () => void
  onDelete: (id: string) => void
  onExport: () => void
  onImport: (file: File) => void
  onRestoreSamples: () => void
  onLang: (lang: Lang) => void
  onStorage: () => void
  reminder: { show: boolean, lastExportAt: string | null, onSnooze: () => void }
  sync: SyncInfo
}

export function LibraryView(props: Props) {
  const { patterns, onOpen, onNew, onDelete, sync } = props
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [tag, setTag] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('recent')
  const importRef = useRef<HTMLInputElement>(null)

  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of patterns) for (const tg of p.tags) counts.set(tg, (counts.get(tg) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], getLang()))
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
  const lang = getLang()

  const menu: MenuItem[] = [
    { label: t('Exporter une sauvegarde'), icon: <Download size={16} />, onSelect: props.onExport, disabled: !patterns.length },
    { label: t('Importer une sauvegarde ou un patron'), icon: <Upload size={16} />, onSelect: () => importRef.current?.click() },
    ...(sync.status === 'unsupported' ? [] : sync.status === 'off'
      ? [{ label: t('Synchroniser avec un fichier…'), icon: <FolderSync size={16} />, onSelect: sync.link }]
      : [{ label: t('Arrêter la synchronisation'), icon: <CloudOff size={16} />, onSelect: sync.unlink }]),
    { label: t('Stockage et sécurité des données'), icon: <HardDrive size={16} />, onSelect: props.onStorage },
    { label: lang === 'fr' ? 'English' : 'Français', icon: <Languages size={16} />, onSelect: () => props.onLang(lang === 'fr' ? 'en' : 'fr') },
    { label: t('Restaurer les exemples'), icon: <RotateCcw size={16} />, onSelect: props.onRestoreSamples, disabled: hasSamples },
  ]

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
            <input type="search" placeholder={t('Rechercher un patron, un fil, un tag…')} value={query}
              aria-label={t('Rechercher')} onChange={(e) => setQuery(e.target.value)} />
            {query && <button type="button" className="icon-btn ghost sm" onClick={() => setQuery('')} aria-label={t('Effacer')}><X size={16} /></button>}
          </label>
          <div className="appbar-actions">
            {sync.status === 'reconnect' && (
              <button type="button" className="btn secondary sm" onClick={sync.reconnect} title={sync.fileName ?? undefined}>
                <RefreshCw size={15} /><span className="hide-sm">{t('Reprendre la synchro')}</span>
              </button>
            )}
            {(sync.status === 'synced' || sync.status === 'syncing') && (
              <span className="sync-chip" title={t('Synchronisé avec {f}', { f: sync.fileName ?? '' })}>
                <FolderSync size={15} className={sync.status === 'syncing' ? 'spin' : ''} /><span className="hide-sm">{t('Synchronisé')}</span>
              </span>
            )}
            {sync.status === 'error' && <span className="sync-chip warn">{t('Synchro en erreur')}</span>}
            <Menu label={t('Sauvegarde et options')} icon={<Ellipsis size={20} />} items={menu} />
            <input ref={importRef} type="file" accept="application/json,.json" hidden
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) props.onImport(f) }} />
            <button type="button" className="btn primary" onClick={onNew}>
              <Plus size={18} /><span className="hide-sm">{t('Nouveau patron')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="page">
        {props.reminder.show && (
          <div className="banner" role="status">
            <ShieldCheck size={20} aria-hidden="true" />
            <p>
              <strong>{t('Pensez à sauvegarder vos patrons.')}</strong>{' '}
              {props.reminder.lastExportAt
                ? t('Dernière sauvegarde le {d}.', { d: new Date(props.reminder.lastExportAt).toLocaleDateString(lang) })
                : t('Ils ne sont enregistrés que dans ce navigateur.')}
            </p>
            <div className="row-gap">
              <button type="button" className="btn primary sm" onClick={props.onExport}><Download size={15} /> {t('Exporter')}</button>
              <button type="button" className="btn ghost sm" onClick={props.reminder.onSnooze}>{t('Plus tard')}</button>
            </div>
          </div>
        )}

        <div className="library-head">
          <div>
            <h1>{t('Mes patrons')}</h1>
            <p className="muted">{tn(patterns.length, '{n} patron · enregistré sur cet appareil', '{n} patrons · enregistrés sur cet appareil')}</p>
          </div>
          <div className="library-controls">
            <Segmented label={t('Filtrer par progression')} value={filter} onChange={setFilter} options={[
              { value: 'all', label: <>{t('Tous')} <small>{counts.all}</small></> },
              { value: 'todo', label: <>{t('À commencer')} <small>{counts.todo}</small></> },
              { value: 'in-progress', label: <>{t('En cours')} <small>{counts['in-progress']}</small></> },
              { value: 'done', label: <>{t('Terminés')} <small>{counts.done}</small></> },
            ]} />
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t('Trier')}>
              {(Object.keys(SORTS) as Sort[]).map((k) => <option key={k} value={k}>{t(SORTS[k][0])}</option>)}
            </select>
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="tag-bar" role="group" aria-label={t('Filtrer par tag')}>
            {allTags.map(([tg, n]) => (
              <button key={tg} type="button" className={`chip ${tag === tg ? 'active' : ''}`} aria-pressed={tag === tg}
                onClick={() => setTag(tag === tg ? null : tg)}>
                #{tg} <small>{n}</small>
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          patterns.length === 0 ? (
            <EmptyState icon="🧶" title={t('Votre bibliothèque est vide')}
              action={<button className="btn primary" onClick={onNew}><Plus size={18} /> {t('Ajouter un patron')}</button>}>
              {t('Collez le texte d\'un patron (« R1 : 6 ms dans un anneau magique (6) »…) ou joignez son PDF pour obtenir le compteur, le rendu du tissu et l\'aperçu 3D.')}
            </EmptyState>
          ) : (
            <EmptyState icon="🔎" title={t('Aucun résultat')}
              action={<button className="btn ghost" onClick={() => { setQuery(''); setTag(null); setFilter('all') }}>{t('Effacer les filtres')}</button>}>
              {t('Aucun patron ne correspond à cette recherche.')}
            </EmptyState>
          )
        ) : (
          <div className="grid">
            {visible.map((p) => (
              <PatternCard key={p.id} pattern={p} onOpen={onOpen} onDelete={onDelete} onTag={setTag} />
            ))}
          </div>
        )}
        <p className="footnote">{t('Vos données restent dans ce navigateur. Pensez à exporter une sauvegarde de temps en temps.')}</p>
      </main>
    </>
  )
}
