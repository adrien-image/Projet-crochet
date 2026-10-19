import { Suspense, useMemo, useRef, useState } from 'react'
import { Camera, Check, Hand, Pause, Play, RotateCcw, Palette, Undo2 } from 'lucide-react'
import type { Pattern } from '../../domain/types'
import { roundsOf } from '../../domain/progress'
import { buildCords, buildPieces, findDetails } from '../../domain/pieces'
import { buildModel, placementKey } from '../../render3d/model'
import type { PickEvent, Viewer3DHandle } from '../../render3d/Viewer3D'
import { downloadBlob } from '../../render2d/chartExport'
import { t } from '../../i18n'
import { Segmented } from '../../ui/Segmented'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorBoundary } from '../../ui/ErrorBoundary'
import { lazyWithReload } from '../../ui/lazyWithReload'
import { setPieceColor, setPlacement, type Update } from './actions'

// three.js (~600 ko) n'est téléchargé qu'à l'ouverture de cet onglet
const Viewer3D = lazyWithReload(() => import('../../render3d/Viewer3D'))

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function Model3DTab({ pattern, update }: { pattern: Pattern, update: Update }) {
  const rounds = roundsOf(pattern)
  const total = rounds.length
  const [assembled, setAssembled] = useState(true)
  const [upTo, setUpTo] = useState(total)
  const [auto, setAuto] = useState(() => !reducedMotion())
  const [placing, setPlacing] = useState(false)
  const [selected, setSelected] = useState<{ label: string, copy: number } | null>(null)
  const viewer = useRef<Viewer3DHandle>(null)

  const pieces = useMemo(() => buildPieces(pattern), [pattern])
  const cords = useMemo(() => buildCords(pattern), [pattern])
  const details = useMemo(() => findDetails(pattern.text), [pattern.text])
  const limit = Math.min(upTo, total)
  const complete = limit >= total
  const model = useMemo(
    () => buildModel(pieces, cords, details, { assembled, upTo: complete ? Infinity : limit, placements: pattern.placements }),
    [pieces, cords, details, assembled, limit, complete, pattern.placements],
  )

  if (!total) {
    return (
      <EmptyState icon="🧸" title={t('Pas encore de rangs')}>
        {t('L\'aperçu 3D se construit à partir des rangs du patron (« R1 : 6 ms… »).')}
      </EmptyState>
    )
  }

  const done = new Set(pattern.roundsDone)
  const progressIdx = rounds.findIndex((r) => !done.has(r.key))
  const myProgress = progressIdx < 0 ? total : progressIdx
  const current = rounds[Math.max(0, limit - 1)]
  const legend = [...pieces.map((p) => ({ label: p.label, color: p.color, copies: p.copies })), ...cords.map((c) => ({ label: c.label, color: c.color, copies: 1 }))]
  const customized = Object.keys(pattern.pieceColors).length > 0
  const canPlace = assembled && complete && model.placeable.length > 0
  const slots = model.placeable.flatMap((p) => Array.from({ length: p.copies }, (_, copy) => ({ label: p.label, copy, copies: p.copies })))
  const placedCount = Object.keys(pattern.placements).length

  const photo = async () => {
    const blob = await viewer.current?.screenshot()
    if (blob) downloadBlob(blob, `${pattern.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-3d.png`)
  }

  const onPick = (e: PickEvent) => {
    if (!selected) return
    // on ne coud pas une pièce sur elle-même
    if (e.label === selected.label) return
    const key = placementKey(selected.label, selected.copy)
    update((p) => setPlacement(p, key, { point: e.point, normal: e.normal }))
    // pièce suivante pas encore placée
    const idx = slots.findIndex((s) => s.label === selected.label && s.copy === selected.copy)
    const next = slots.slice(idx + 1).find((s) => !pattern.placements[placementKey(s.label, s.copy)] && s.copy === 0)
    setSelected(next ? { label: next.label, copy: next.copy } : null)
  }

  const startPlacing = () => {
    setPlacing(true)
    setAuto(false)
    const first = slots[0]
    setSelected(first ? { label: first.label, copy: first.copy } : null)
  }

  return (
    <div className="model3d">
      <div className="toolbar">
        <Segmented label={t('Présentation')} value={assembled ? 'a' : 's'} onChange={(v) => { setAssembled(v === 'a'); setPlacing(false) }} options={[
          { value: 'a', label: t('Assemblé'), title: t('Pièces cousues ensemble (estimation à partir des noms)') },
          { value: 's', label: t('Pièces séparées') },
        ]} />
        {canPlace && !placing && (
          <button type="button" className="btn ghost sm" onClick={startPlacing}><Hand size={16} /> {t('Placer les pièces')}</button>
        )}
        <div className="row-gap grow end">
          <button type="button" className="icon-btn" onClick={() => setAuto((a) => !a)} disabled={placing}
            aria-label={auto ? t('Arrêter la rotation') : t('Rotation automatique')} title={auto ? t('Arrêter la rotation') : t('Rotation automatique')}>
            {auto ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" className="icon-btn" onClick={() => viewer.current?.resetView()} aria-label={t('Recentrer la vue')} title={t('Recentrer la vue')}><RotateCcw size={18} /></button>
          <button type="button" className="icon-btn" onClick={photo} aria-label={t('Enregistrer une image')} title={t('Enregistrer une image (PNG)')}><Camera size={18} /></button>
        </div>
      </div>

      {placing && (
        <div className="placing panel compact" role="region" aria-label={t('Placement des pièces')}>
          <p>
            {selected
              ? t('Choisissez la pièce, puis touchez l\'endroit du modèle où la coudre. Le 2e exemplaire est placé en symétrie.')
              : t('Toutes les pièces sont placées. Choisissez une pièce pour la déplacer.')}
          </p>
          <div className="chips">
            {slots.map((s) => {
              const key = placementKey(s.label, s.copy)
              const on = selected?.label === s.label && selected.copy === s.copy
              return (
                <button key={key} type="button" className={`chip ${on ? 'active' : ''}`} aria-pressed={on}
                  onClick={() => setSelected({ label: s.label, copy: s.copy })}>
                  {pattern.placements[key] && <Check size={14} />}
                  {s.label}{s.copies > 1 ? ` ${s.copy + 1}` : ''}
                </button>
              )
            })}
          </div>
          <div className="row-gap wrap">
            {selected && pattern.placements[placementKey(selected.label, selected.copy)] && (
              <button type="button" className="btn ghost sm" onClick={() => update((p) => setPlacement(p, placementKey(selected.label, selected.copy), null))}>
                <Undo2 size={15} /> {t('Position automatique pour cette pièce')}
              </button>
            )}
            {placedCount > 0 && (
              <button type="button" className="btn ghost sm" onClick={() => update((p) => setPlacement(p, '*', null))}>{t('Tout réinitialiser')}</button>
            )}
            <button type="button" className="btn primary sm" onClick={() => { setPlacing(false); setSelected(null) }}><Check size={15} /> {t('Terminé')}</button>
          </div>
        </div>
      )}

      <div className="stage">
        <ErrorBoundary label={t('L\'aperçu 3D n\'a pas pu s\'afficher.')}>
          <Suspense fallback={<div className="stage-loading">{t('Chargement de l\'aperçu 3D…')}</div>}>
            <Viewer3D ref={viewer} model={model} autoRotate={auto} refit={!placing && (complete || limit <= 1)}
              picking={placing && !!selected} onPick={onPick} highlight={placing ? selected?.label : null} />
          </Suspense>
        </ErrorBoundary>
        {limit < total && <div className="stage-badge">{t('Après {r}', { r: current.label })}{current.section ? ` · ${current.section}` : ''}</div>}
      </div>

      <div className="build">
        <label htmlFor="build-range">{t('Construction')}</label>
        <input id="build-range" type="range" min={1} max={total} value={limit} disabled={placing}
          onChange={(e) => setUpTo(Number(e.target.value))} aria-valuetext={t('{d} rangs sur {n}', { d: limit, n: total })} />
        <span className="muted sm build-value">{limit} / {total}</span>
        <div className="row-gap">
          <button type="button" className="btn ghost sm" disabled={placing || myProgress === 0 || myProgress === limit} onClick={() => setUpTo(myProgress)}>{t('Mon avancement')}</button>
          <button type="button" className="btn ghost sm" disabled={limit === total} onClick={() => setUpTo(total)}>{t('Pièce finie')}</button>
        </div>
      </div>

      <div className="legend3d">
        <span className="muted sm"><Palette size={15} /> {t('Couleurs du fil')}</span>
        {legend.map((l) => (
          <label key={l.label} className="color-chip" title={t('Couleur : {p}', { p: l.label })}>
            <input type="color" value={l.color} onChange={(e) => update((p) => setPieceColor(p, l.label, e.target.value))} />
            <span className="dot" style={{ background: l.color }} aria-hidden="true" />
            {l.label}{l.copies > 1 ? ` × ${l.copies}` : ''}
          </label>
        ))}
        {customized && <button type="button" className="btn ghost sm" onClick={() => update((p) => setPieceColor(p, '*', null))}>{t('Couleurs du patron')}</button>}
      </div>
      <p className="muted sm">
        {t('Chaque pièce est reconstruite à partir des comptes de mailles et de la hauteur des mailles ; l\'assemblage est déduit des noms des parties, ou placé à la main. Glissez (ou flèches du clavier) pour tourner, pincez, molette ou +/− pour zoomer.')}
      </p>
    </div>
  )
}
