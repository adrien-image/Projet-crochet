import { useRef } from 'react'
import { ArrowLeft, Box, Ellipsis, FileText, Grid3x3, ListOrdered, Pencil, Trash2 } from 'lucide-react'
import type { ChecklistItem, Pattern } from '../../domain/types'
import { patternProgress } from '../../domain/progress'
import type { PatternTab } from '../../hooks/useHashRoute'
import { Menu } from '../../ui/Menu'
import { ProgressRing } from '../../ui/Progress'
import { OverviewTab } from './OverviewTab'
import { CounterTab } from './CounterTab'
import { RoundsTab } from './RoundsTab'
import { Model3DTab } from './Model3DTab'

const TABS: { id: PatternTab, label: string, icon: typeof FileText }[] = [
  { id: 'patron', label: 'Patron', icon: FileText },
  { id: 'compteur', label: 'Compteur', icon: ListOrdered },
  { id: 'rangs', label: 'Rangs', icon: Grid3x3 },
  { id: '3d', label: '3D', icon: Box },
]

interface Props {
  pattern: Pattern
  tab: PatternTab
  onTab: (tab: PatternTab) => void
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onChecklist: (fn: (l: ChecklistItem[]) => ChecklistItem[]) => void
  onSetRounds: (keys: string[], done: boolean) => void
  onStitchCounter: (n: number) => void
  onPieceColor: (label: string, color: string | null) => void
}

export function PatternView(props: Props) {
  const { pattern, tab, onTab } = props
  const progress = patternProgress(pattern)
  const tabsRef = useRef<HTMLDivElement>(null)

  // onglets : flèches gauche / droite (motif WAI-ARIA « tabs »)
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = TABS.findIndex((t) => t.id === tab)
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
    onTab(next.id)
    tabsRef.current?.querySelector<HTMLButtonElement>(`#tab-${next.id}`)?.focus()
  }

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <button type="button" className="btn ghost back" onClick={props.onBack}><ArrowLeft size={18} /><span className="hide-sm">Bibliothèque</span></button>
          <span className="appbar-title">{pattern.name}</span>
          <div className="appbar-actions">
            <button type="button" className="btn secondary" onClick={props.onEdit}><Pencil size={16} /><span className="hide-sm">Modifier</span></button>
            <Menu label="Plus d'actions" icon={<Ellipsis size={20} />} items={[
              { label: 'Supprimer le patron', icon: <Trash2 size={16} />, onSelect: props.onDelete, danger: true },
            ]} />
          </div>
        </div>
      </header>

      <main className="page pattern-page">
        <div className="pattern-hero">
          <div className="pattern-hero-text">
            <h1>{pattern.name}</h1>
            {tab === 'patron' && pattern.description && <p className="muted">{pattern.description}</p>}
            {tab === 'patron' && <div className="chips">
              {pattern.hook && <span className="chip">Crochet {pattern.hook}</span>}
              {pattern.yarn && <span className="chip">{pattern.yarn}</span>}
              {pattern.tags.map((t) => <span key={t} className="chip ghost">#{t}</span>)}
            </div>}
          </div>
          {progress.total > 0 && <ProgressRing value={progress.pct} size={64} label={`Progression : ${progress.pct} %`} />}
        </div>

        <div className="tabs" role="tablist" aria-label="Sections du patron" ref={tabsRef} onKeyDown={onKey}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} id={`tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => onTab(id)}>
              <Icon size={18} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </div>

        <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="tab-panel">
          {tab === 'patron' && (
            <OverviewTab pattern={pattern} onChecklist={props.onChecklist} onSetRounds={props.onSetRounds}
              onOpenCounter={() => onTab('compteur')} onEdit={props.onEdit} />
          )}
          {tab === 'compteur' && <CounterTab pattern={pattern} onSetRounds={props.onSetRounds} onStitchCounter={props.onStitchCounter} />}
          {tab === 'rangs' && <RoundsTab pattern={pattern} onSetRounds={props.onSetRounds} />}
          {tab === '3d' && <Model3DTab pattern={pattern} onPieceColor={props.onPieceColor} />}
        </section>
      </main>
    </>
  )
}
