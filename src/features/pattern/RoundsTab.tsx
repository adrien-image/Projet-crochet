import { useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Download, Printer, Check } from 'lucide-react'
import type { Pattern, StitchType } from '../../domain/types'
import { patternStats, STITCH_INFO } from '../../domain/parser'
import { roundsOf } from '../../domain/progress'
import { buildPieces } from '../../domain/pieces'
import { chartsToSvg, downloadText } from '../../render2d/chartExport'
import { Segmented } from '../../ui/Segmented'
import { EmptyState } from '../../ui/EmptyState'
import { useConfirm } from '../../ui/confirmContext'
import { FabricCanvas } from '../shared/FabricCanvas'
import { RoundChart } from '../shared/RoundChart'
import { StitchGlyph } from '../shared/StitchGlyph'

type View = 'tissu' | 'diagramme'

const fileSlug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()

export function RoundsTab({ pattern, onSetRounds }: { pattern: Pattern, onSetRounds: (keys: string[], done: boolean) => void }) {
  const confirm = useConfirm()
  const rounds = roundsOf(pattern)
  const pieces = useMemo(() => buildPieces(pattern), [pattern])
  const done = useMemo(() => new Set(pattern.roundsDone), [pattern.roundsDone])
  const [view, setView] = useState<View>('tissu')
  const [showProgress, setShowProgress] = useState(true)
  const firstTodo = rounds.findIndex((r) => !done.has(r.key))
  const [activeKey, setActiveKey] = useState<string | null>(rounds[firstTodo < 0 ? 0 : firstTodo]?.key ?? null)

  if (!rounds.length) {
    return (
      <EmptyState icon="📊" title="Aucun rang détecté">
        Écrivez un rang par ligne, par exemple « R1 : 6 ms dans un anneau magique (6) », « R2 : aug dans chaque maille (12) »
        ou « Rnd 3: (sc, inc) x6 (18) », et les pièces en MAJUSCULES.
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

  return (
    <div className="rounds">
      <div className="toolbar">
        <Segmented label="Affichage" value={view} onChange={setView} options={[
          { value: 'tissu', label: 'Tissu', title: 'Rendu réaliste des mailles' },
          { value: 'diagramme', label: 'Diagramme', title: 'Symboles internationaux' },
        ]} />
        {view === 'tissu' && (
          <label className="switch">
            <input type="checkbox" checked={showProgress} onChange={(e) => setShowProgress(e.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            <span>Montrer l'avancement</span>
          </label>
        )}
        <span className="muted sm grow">
          {stats.rounds} rangs · {stats.pieces} pièce{stats.pieces > 1 ? 's' : ''} · {doneCount} faits
          {stats.invalid + stats.misfit > 0 && <span className="text-warn"> · {stats.invalid + stats.misfit} à vérifier</span>}
        </span>
        <div className="row-gap no-print">
          <button type="button" className="btn ghost sm" onClick={() => downloadText(chartsToSvg(pattern.name, rounds, done), `${fileSlug(pattern.name) || 'patron'}-diagramme.svg`, 'image/svg+xml')}>
            <Download size={16} /> SVG
          </button>
          <button type="button" className="btn ghost sm" onClick={() => window.print()}><Printer size={16} /> Imprimer</button>
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
                <span className="muted sm">{piece.rounds.length} rangs</span>
              </div>
              {view === 'tissu' ? (
                <FabricCanvas rounds={piece.rounds} color={piece.color} done={done} activeKey={activeKey}
                  showProgress={showProgress} flat={piece.flat} onSelect={setActiveKey}
                  label={`Rendu du tissu : ${piece.label}, ${piece.rounds.length} rangs`} />
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
              ? 'Vue dépliée : du premier rang (en bas) au dernier (en haut), chaque rang aussi large que son nombre de mailles. Touchez un rang pour le détail.'
              : 'Lecture : en rond, dans le sens inverse des aiguilles d\'une montre depuis le haut (flèche) ; à plat, un rang sur deux de droite à gauche.'}
          </p>
        </div>

        {/* téléphone : barre compacte du rang sélectionné */}
        <div className={`selection-bar no-print ${done.has(active.key) ? 'done' : ''}`}>
          <button type="button" className="icon-btn" disabled={activeIdx === 0} onClick={() => go(-1)} aria-label="Rang précédent"><ChevronLeft size={18} /></button>
          <div className="selection-text">
            <strong>{active.label}</strong>
            <span className="muted sm">{active.count} m.{active.section ? ` · ${active.section}` : ''}</span>
          </div>
          <button type="button" className={`icon-btn ${done.has(active.key) ? 'on' : ''}`} aria-pressed={done.has(active.key)}
            aria-label={done.has(active.key) ? 'Marquer comme non terminé' : 'Marquer comme terminé'}
            onClick={() => onSetRounds([active.key], !done.has(active.key))}><Check size={18} /></button>
          <button type="button" className="icon-btn" disabled={activeIdx === rounds.length - 1} onClick={() => go(1)} aria-label="Rang suivant"><ChevronRight size={18} /></button>
        </div>

        <aside className="rounds-side no-print">
          <section className={`panel round-detail ${done.has(active.key) ? 'done' : ''}`}>
            <div className="counter-nav">
              <button type="button" className="icon-btn" disabled={activeIdx === 0} onClick={() => go(-1)} aria-label="Rang précédent"><ChevronLeft size={18} /></button>
              <div className="counter-title sm">
                {active.section && <span className="eyebrow">{active.section}</span>}
                <strong>{active.label}</strong>
              </div>
              <button type="button" className="icon-btn" disabled={activeIdx === rounds.length - 1} onClick={() => go(1)} aria-label="Rang suivant"><ChevronRight size={18} /></button>
            </div>
            <p className="counter-text">{active.text}</p>
            <div className="chips">
              {breakdown.length === 0 && <span className="muted">Aucune maille reconnue.</span>}
              {breakdown.map(([t, c]) => (
                <span key={t} className="chip"><StitchGlyph type={t} size={15} /> {c} × {STITCH_INFO[t]?.label ?? t}</span>
              ))}
              {active.loop && <span className="chip accent">{active.loop === 'blo' ? 'Brin arrière' : 'Brin avant'}</span>}
              {active.flat && <span className="chip">↔ Aller-retour</span>}
            </div>
            <div className="facts-row">
              <span>Total</span><strong>{active.count} mailles</strong>
            </div>
            {active.expected != null && (
              <p className={active.valid ? 'text-ok' : 'text-warn'}>
                {active.valid ? `✓ Compte vérifié : ${active.expected}` : `⚠ ${active.count} mailles calculées, ${active.expected} annoncées`}
              </p>
            )}
            {active.fits === false && (
              <p className="text-warn">⚠ Ce rang se travaille sur {active.consumed} mailles, le rang précédent en compte {active.prevCount}.</p>
            )}
            <label className="switch">
              <input type="checkbox" checked={done.has(active.key)} onChange={() => onSetRounds([active.key], !done.has(active.key))} />
              <span className="switch-track" aria-hidden="true" />
              <span>Rang terminé</span>
            </label>
            <div className="row-gap wrap">
              <button type="button" className="btn primary sm" onClick={() => {
                onSetRounds(rounds.slice(0, activeIdx + 1).map((r) => r.key), true)
                go(1)
              }}>
                <Check size={16} /> Terminé jusqu'ici
              </button>
              {doneCount > 0 && (
                <button type="button" className="btn ghost sm" onClick={async () => {
                  if (await confirm({ title: 'Décocher tous les rangs ?', message: 'La progression des rangs de ce patron sera remise à zéro.', confirm: 'Tout décocher', danger: true })) {
                    onSetRounds(rounds.map((r) => r.key), false)
                  }
                }}>
                  Tout décocher
                </button>
              )}
            </div>
          </section>

          <details className="panel legend" open={view === 'diagramme'}>
            <summary><h3>Légende des symboles</h3><ChevronDown size={18} className="chevron" aria-hidden="true" /></summary>
            {(Object.keys(STITCH_INFO) as StitchType[]).map((t) => (
              <div key={t} className="legend-row">
                <StitchGlyph type={t} size={18} />
                <span>{STITCH_INFO[t].label}</span>
                <small>{STITCH_INFO[t].abbr}</small>
              </div>
            ))}
          </details>
        </aside>
      </div>
    </div>
  )
}
