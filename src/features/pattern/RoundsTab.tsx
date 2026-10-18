import { useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Download, Printer, Check } from 'lucide-react'
import type { Pattern, StitchType } from '../../domain/types'
import { patternStats, STITCH_INFO } from '../../domain/parser'
import { roundsOf } from '../../domain/progress'
import { buildPieces } from '../../domain/pieces'
import { chartsToSvg, downloadText } from '../../render2d/chartExport'
import { t, tn } from '../../i18n'
import { Segmented } from '../../ui/Segmented'
import { EmptyState } from '../../ui/EmptyState'
import { useConfirm } from '../../ui/confirmContext'
import { FabricCanvas } from '../shared/FabricCanvas'
import { RoundChart } from '../shared/RoundChart'
import { StitchGlyph } from '../shared/StitchGlyph'
import { setRoundNote, setRoundsDone, type Update } from './actions'
import { RoundNoteEditor } from './RoundNoteEditor'

type View = 'tissu' | 'diagramme'

const fileSlug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()

export function RoundsTab({ pattern, update }: { pattern: Pattern, update: Update }) {
  const confirm = useConfirm()
  const rounds = roundsOf(pattern)
  const pieces = useMemo(() => buildPieces(pattern), [pattern])
  const done = useMemo(() => new Set(pattern.roundsDone), [pattern.roundsDone])
  const [view, setView] = useState<View>('tissu')
  const [showProgress, setShowProgress] = useState(true)
  const firstTodo = rounds.findIndex((r) => !done.has(r.key))
  const [activeKey, setActiveKey] = useState<string | null>(rounds[firstTodo < 0 ? 0 : firstTodo]?.key ?? null)
  const mark = (keys: string[], value: boolean) => update((p) => setRoundsDone(p, keys, value))

  if (!rounds.length) {
    return (
      <EmptyState icon="📊" title={t('Aucun rang détecté')}>
        {t('Écrivez un rang par ligne, par exemple « R1 : 6 ms dans un anneau magique (6) », « R2 : aug dans chaque maille (12) » ou « Rnd 3: (sc, inc) x6 (18) », et les pièces en MAJUSCULES.')}
      </EmptyState>
    )
  }

  const activeIdx = Math.max(0, rounds.findIndex((r) => r.key === activeKey))
  const active = rounds[activeIdx]
  const stats = patternStats(rounds)
  const doneCount = rounds.filter((r) => done.has(r.key)).length
  const breakdown = Object.entries(active.stitches.reduce<Record<string, number>>((acc, s) => {
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})) as [StitchType, number][]
  const go = (d: number) => setActiveKey(rounds[Math.max(0, Math.min(rounds.length - 1, activeIdx + d))].key)
  const isDone = done.has(active.key)

  return (
    <div className="rounds">
      <div className="toolbar">
        <Segmented label={t('Affichage')} value={view} onChange={setView} options={[
          { value: 'tissu', label: t('Tissu'), title: t('Rendu réaliste des mailles') },
          { value: 'diagramme', label: t('Diagramme'), title: t('Symboles internationaux') },
        ]} />
        {view === 'tissu' && (
          <label className="switch">
            <input type="checkbox" checked={showProgress} onChange={(e) => setShowProgress(e.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            <span>{t('Montrer l\'avancement')}</span>
          </label>
        )}
        <span className="muted sm grow">
          {tn(stats.rounds, '{n} rang', '{n} rangs')} · {tn(stats.pieces, '{n} pièce', '{n} pièces')} · {tn(doneCount, '{n} fait', '{n} faits')}
          {stats.invalid + stats.misfit > 0 && <span className="text-warn"> · {t('{n} à vérifier', { n: stats.invalid + stats.misfit })}</span>}
        </span>
        <div className="row-gap no-print">
          <button type="button" className="btn ghost sm" onClick={() => downloadText(chartsToSvg(pattern.name, rounds, done), `${fileSlug(pattern.name) || 'patron'}-diagramme.svg`, 'image/svg+xml')}>
            <Download size={16} /> SVG
          </button>
          <button type="button" className="btn ghost sm" onClick={() => window.print()}><Printer size={16} /> {t('Imprimer')}</button>
        </div>
      </div>

      <div className="rounds-layout">
        <div className="rounds-main">
          <h2 className="print-only">{pattern.name}</h2>
          {pieces.map((piece) => (
            <section key={piece.index} className="panel piece">
              <div className="panel-head">
                <h3>
                  <span className="dot" style={{ background: piece.color }} aria-hidden="true" />
                  {piece.label}
                  {piece.copies > 1 && <span className="chip xs">× {piece.copies}</span>}
                </h3>
                <span className="muted sm">{tn(piece.rounds.length, '{n} rang', '{n} rangs')}</span>
              </div>
              {view === 'tissu' ? (
                <FabricCanvas rounds={piece.rounds} color={piece.color} done={done} activeKey={activeKey}
                  showProgress={showProgress} flat={piece.flat} onSelect={setActiveKey}
                  label={t('Rendu du tissu : {p}, {n} rangs', { p: piece.label, n: piece.rounds.length })} />
              ) : (
                <div className="chart-grid">
                  {piece.rounds.map((r) => (
                    <RoundChart key={r.key} round={r} done={done.has(r.key)} active={r.key === activeKey} onClick={() => setActiveKey(r.key)} />
                  ))}
                </div>
              )}
            </section>
          ))}
          <p className="muted sm">
            {view === 'tissu'
              ? t('Vue dépliée : du premier rang (en bas) au dernier (en haut), chaque rang aussi large que son nombre de mailles. Touchez un rang pour le détail.')
              : t('Lecture : en rond, dans le sens inverse des aiguilles d\'une montre depuis le haut (flèche) ; à plat, un rang sur deux de droite à gauche.')}
          </p>
        </div>

        {/* téléphone : barre compacte du rang sélectionné */}
        <div className={`selection-bar no-print ${isDone ? 'done' : ''}`}>
          <button type="button" className="icon-btn" disabled={activeIdx === 0} onClick={() => go(-1)} aria-label={t('Rang précédent')}><ChevronLeft size={18} /></button>
          <div className="selection-text">
            <strong>{active.label}</strong>
            <span className="muted sm">{t('{n} m.', { n: active.count })}{active.section ? ` · ${active.section}` : ''}</span>
          </div>
          <button type="button" className={`icon-btn ${isDone ? 'on' : ''}`} aria-pressed={isDone}
            aria-label={isDone ? t('Marquer comme non terminé') : t('Marquer comme terminé')}
            onClick={() => mark([active.key], !isDone)}><Check size={18} /></button>
          <button type="button" className="icon-btn" disabled={activeIdx === rounds.length - 1} onClick={() => go(1)} aria-label={t('Rang suivant')}><ChevronRight size={18} /></button>
        </div>

        <aside className="rounds-side no-print">
          <section className={`panel round-detail ${isDone ? 'done' : ''}`}>
            <div className="counter-nav">
              <button type="button" className="icon-btn" disabled={activeIdx === 0} onClick={() => go(-1)} aria-label={t('Rang précédent')}><ChevronLeft size={18} /></button>
              <div className="counter-title sm">
                {active.section && <span className="eyebrow">{active.section}</span>}
                <strong>{active.label}</strong>
              </div>
              <button type="button" className="icon-btn" disabled={activeIdx === rounds.length - 1} onClick={() => go(1)} aria-label={t('Rang suivant')}><ChevronRight size={18} /></button>
            </div>
            <p className="counter-text">{active.text}</p>
            <div className="chips">
              {breakdown.length === 0 && <span className="muted">{t('Aucune maille reconnue.')}</span>}
              {breakdown.map(([s, c]) => (
                <span key={s} className="chip"><StitchGlyph type={s} size={15} /> {c} × {t(STITCH_INFO[s]?.label ?? s)}</span>
              ))}
              {active.color && <span className="chip"><span className="dot" style={{ background: active.color }} aria-hidden="true" /> {t('Couleur du fil')}</span>}
              {active.loop && <span className="chip accent">{active.loop === 'blo' ? t('Brin arrière') : t('Brin avant')}</span>}
              {active.flat && <span className="chip">↔ {t('Aller-retour')}</span>}
            </div>
            <div className="facts-row">
              <span>{t('Total')}</span><strong>{tn(active.count, '{n} maille', '{n} mailles')}</strong>
            </div>
            {active.expected != null && (
              <p className={active.valid ? 'text-ok' : 'text-warn'}>
                {active.valid
                  ? t('✓ Compte vérifié : {n}', { n: active.expected })
                  : t('⚠ {c} mailles calculées, {e} annoncées', { c: active.count, e: active.expected })}
              </p>
            )}
            {active.fits === false && (
              <p className="text-warn">{t('⚠ Ce rang se travaille sur {c} mailles, le rang précédent en compte {p}.', { c: active.consumed, p: active.prevCount ?? 0 })}</p>
            )}
            <label className="switch">
              <input type="checkbox" checked={isDone} onChange={() => mark([active.key], !isDone)} />
              <span className="switch-track" aria-hidden="true" />
              <span>{t('Rang terminé')}</span>
            </label>
            <div className="row-gap wrap">
              <button type="button" className="btn primary sm" onClick={() => {
                mark(rounds.slice(0, activeIdx + 1).map((r) => r.key), true)
                go(1)
              }}>
                <Check size={16} /> {t('Terminé jusqu\'ici')}
              </button>
              {doneCount > 0 && (
                <button type="button" className="btn ghost sm" onClick={async () => {
                  if (await confirm({ title: t('Décocher tous les rangs ?'), message: t('La progression des rangs de ce patron sera remise à zéro.'), confirm: t('Tout décocher'), danger: true })) {
                    mark(rounds.map((r) => r.key), false)
                  }
                }}>
                  {t('Tout décocher')}
                </button>
              )}
            </div>
            <RoundNoteEditor key={active.key} label={active.label} note={pattern.roundNotes[active.key]}
              onChange={(note) => update((p) => setRoundNote(p, active.key, note))} />
          </section>

          <details className="panel legend" open={view === 'diagramme'}>
            <summary><h3>{t('Légende des symboles')}</h3><ChevronDown size={18} className="chevron" aria-hidden="true" /></summary>
            {(Object.keys(STITCH_INFO) as StitchType[]).map((s) => (
              <div key={s} className="legend-row">
                <StitchGlyph type={s} size={18} />
                <span>{t(STITCH_INFO[s].label)}</span>
                <small>{STITCH_INFO[s].abbr}</small>
              </div>
            ))}
          </details>
        </aside>
      </div>
    </div>
  )
}
