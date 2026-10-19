import { useRef, useState } from 'react'
import { ArrowLeft, Box, Copy, Download, Ellipsis, FileText, Grid3x3, Link2, Printer, ListOrdered, Pause, Pencil, Play, Share2, Trash2 } from 'lucide-react'
import type { Pattern } from '../../domain/types'
import { patternProgress } from '../../domain/progress'
import { formatDuration, startTimer, stopTimer, totalSeconds } from '../../domain/time'
import type { PatternTab } from '../../hooks/useHashRoute'
import { useTicker } from '../../hooks/useTicker'
import { t } from '../../i18n'
import { Menu } from '../../ui/Menu'
import { ProgressRing } from '../../ui/Progress'
import { ErrorBoundary } from '../../ui/ErrorBoundary'
import type { Update } from './actions'
import { OverviewTab } from './OverviewTab'
import { CounterTab } from './CounterTab'
import { RoundsTab } from './RoundsTab'
import { Model3DTab } from './Model3DTab'
import { PrintSheet } from './PrintSheet'

const TABS: { id: PatternTab, label: string, icon: typeof FileText }[] = [
  { id: 'patron', label: 'Patron', icon: FileText },
  { id: 'compteur', label: 'Compteur', icon: ListOrdered },
  { id: 'rangs', label: 'Rangs', icon: Grid3x3 },
  { id: '3d', label: '3D', icon: Box },
]

export type ShareKind = 'link' | 'print' | 'file' | 'markdown' | 'native'

interface Props {
  pattern: Pattern
  tab: PatternTab
  onTab: (tab: PatternTab) => void
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onShare: (kind: ShareKind) => void
  update: Update
}

/** Chronomètre de la séance, dans l'en-tête. */
export function TimerButton({ pattern, update, compact }: { pattern: Pattern, update: Update, compact?: boolean }) {
  const running = !!pattern.timerStartedAt
  const now = useTicker(running)
  const total = totalSeconds(pattern, now)
  return (
    <button type="button" className={`btn ${running ? 'timer-on' : 'ghost'} ${compact ? 'sm' : ''}`} aria-pressed={running}
      onClick={() => update((p) => (p.timerStartedAt ? stopTimer(p) : startTimer(p)))}
      title={running ? t('Mettre le chronomètre en pause') : t('Lancer le chronomètre')}>
      {running ? <Pause size={16} /> : <Play size={16} />}
      <span className="tabular">{total ? formatDuration(total) : t('Chrono')}</span>
    </button>
  )
}

export function PatternView(props: Props) {
  const [printing, setPrinting] = useState(false)
  const { pattern, tab, onTab, update } = props
  const progress = patternProgress(pattern)
  const tabsRef = useRef<HTMLDivElement>(null)
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  // onglets : flèches gauche / droite (motif WAI-ARIA « tabs »)
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = TABS.findIndex((x) => x.id === tab)
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
    onTab(next.id)
    tabsRef.current?.querySelector<HTMLButtonElement>(`#tab-${next.id}`)?.focus()
  }

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <button type="button" className="btn ghost back" onClick={props.onBack}><ArrowLeft size={18} /><span className="hide-sm">{t('Bibliothèque')}</span></button>
          <span className="appbar-title">{pattern.name}</span>
          <div className="appbar-actions">
            <TimerButton pattern={pattern} update={update} compact />
            <button type="button" className="btn secondary" onClick={props.onEdit}><Pencil size={16} /><span className="hide-sm">{t('Modifier')}</span></button>
            <Menu label={t('Plus d\'actions')} icon={<Ellipsis size={20} />} items={[
              ...(canShare ? [{ label: t('Partager…'), icon: <Share2 size={16} />, onSelect: () => props.onShare('native') }] : []),
              { label: t('Copier le lien de partage'), icon: <Link2 size={16} />, onSelect: () => props.onShare('link') },
              { label: t('Copier un lien imprimable'), icon: <Link2 size={16} />, onSelect: () => props.onShare('print') },
              { label: t('Télécharger le patron (fichier)'), icon: <Download size={16} />, onSelect: () => props.onShare('file') },
              { label: t('Exporter en texte (Markdown)'), icon: <FileText size={16} />, onSelect: () => props.onShare('markdown') },
              { label: t('Imprimer le patron (ou PDF)'), icon: <Printer size={16} />, onSelect: () => setPrinting(true) },
              { label: t('Dupliquer le patron…'), icon: <Copy size={16} />, onSelect: props.onDuplicate },
              { label: t('Supprimer le patron'), icon: <Trash2 size={16} />, onSelect: props.onDelete, danger: true },
            ]} />
          </div>
        </div>
      </header>

      <main className="page pattern-page">
        <div className="pattern-hero">
          <div className="pattern-hero-text">
            <h1>{pattern.name}</h1>
            {tab === 'patron' && pattern.description && <p className="muted">{pattern.description}</p>}
            {tab === 'patron' && (
              <div className="chips">
                {pattern.hook && <span className="chip">{t('Crochet {h}', { h: pattern.hook })}</span>}
                {pattern.yarn && <span className="chip">{pattern.yarn}</span>}
                {pattern.tags.map((tg) => <span key={tg} className="chip ghost">#{tg}</span>)}
              </div>
            )}
          </div>
          {progress.total > 0 && <ProgressRing value={progress.pct} size={64} label={t('Progression : {p} %', { p: progress.pct })} />}
        </div>

        <div className="tabs" role="tablist" aria-label={t('Sections du patron')} ref={tabsRef} onKeyDown={onKey}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} id={`tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => onTab(id)}>
              <Icon size={18} aria-hidden="true" /><span>{t(label)}</span>
            </button>
          ))}
        </div>

        <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="tab-panel">
          <ErrorBoundary key={tab}>
            {tab === 'patron' && <OverviewTab pattern={pattern} update={update} onOpenCounter={() => onTab('compteur')} />}
            {tab === 'compteur' && <CounterTab pattern={pattern} update={update} />}
            {tab === 'rangs' && <RoundsTab pattern={pattern} update={update} />}
            {tab === '3d' && <Model3DTab pattern={pattern} update={update} />}
          </ErrorBoundary>
        </section>
      </main>
      {printing && <PrintSheet pattern={props.pattern} onDone={() => setPrinting(false)} />}
    </>
  )
}
