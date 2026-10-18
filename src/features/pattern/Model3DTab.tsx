import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Camera, Pause, Play, RotateCcw, Palette } from 'lucide-react'
import type { Pattern } from '../../domain/types'
import { roundsOf } from '../../domain/progress'
import { buildCords, buildPieces, findDetails } from '../../domain/pieces'
import { buildModel } from '../../render3d/model'
import type { Viewer3DHandle } from '../../render3d/Viewer3D'
import { downloadBlob } from '../../render2d/chartExport'
import { Segmented } from '../../ui/Segmented'
import { EmptyState } from '../../ui/EmptyState'

// three.js (~600 ko) n'est téléchargé qu'à l'ouverture de cet onglet
const Viewer3D = lazy(() => import('../../render3d/Viewer3D'))

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

interface Props {
  pattern: Pattern
  onPieceColor: (label: string, color: string | null) => void
}

export function Model3DTab({ pattern, onPieceColor }: Props) {
  const rounds = roundsOf(pattern)
  const total = rounds.length
  const [assembled, setAssembled] = useState(true)
  const [upTo, setUpTo] = useState(total)
  const [auto, setAuto] = useState(() => !reducedMotion())
  const viewer = useRef<Viewer3DHandle>(null)

  const pieces = useMemo(() => buildPieces(pattern), [pattern])
  const cords = useMemo(() => buildCords(pattern), [pattern])
  const details = useMemo(() => findDetails(pattern.text), [pattern.text])
  const limit = Math.min(upTo, total)
  const model = useMemo(
    () => buildModel(pieces, cords, details, { assembled, upTo: limit >= total ? Infinity : limit }),
    [pieces, cords, details, assembled, limit, total],
  )

  if (!total) {
    return (
      <EmptyState icon="🧸" title="Pas encore de rangs">
        L'aperçu 3D se construit à partir des rangs du patron (« R1 : 6 ms… »).
      </EmptyState>
    )
  }

  const done = new Set(pattern.roundsDone)
  const progressIdx = rounds.findIndex((r) => !done.has(r.key))
  const myProgress = progressIdx < 0 ? total : progressIdx
  const current = rounds[Math.max(0, limit - 1)]
  const legend = [...pieces.map((p) => ({ label: p.label, color: p.color, copies: p.copies })), ...cords.map((c) => ({ label: c.label, color: c.color, copies: 1 }))]
  const customized = Object.keys(pattern.pieceColors).length > 0

  const photo = async () => {
    const blob = await viewer.current?.screenshot()
    if (blob) downloadBlob(blob, `${pattern.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-3d.png`)
  }

  return (
    <div className="model3d">
      <div className="toolbar">
        <Segmented label="Présentation" value={assembled ? 'a' : 's'} onChange={(v) => setAssembled(v === 'a')} options={[
          { value: 'a', label: 'Assemblé', title: 'Pièces cousues ensemble (estimation à partir des noms)' },
          { value: 's', label: 'Pièces séparées' },
        ]} />
        <div className="row-gap grow end">
          <button type="button" className="icon-btn" onClick={() => setAuto((a) => !a)} aria-label={auto ? 'Arrêter la rotation' : 'Rotation automatique'} title={auto ? 'Arrêter la rotation' : 'Rotation automatique'}>
            {auto ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" className="icon-btn" onClick={() => viewer.current?.resetView()} aria-label="Recentrer la vue" title="Recentrer la vue"><RotateCcw size={18} /></button>
          <button type="button" className="icon-btn" onClick={photo} aria-label="Enregistrer une image" title="Enregistrer une image (PNG)"><Camera size={18} /></button>
        </div>
      </div>

      <div className="stage">
        <Suspense fallback={<div className="stage-loading">Chargement de l'aperçu 3D…</div>}>
          <Viewer3D ref={viewer} model={model} autoRotate={auto} refit={limit >= total || limit <= 1} />
        </Suspense>
        {limit < total && <div className="stage-badge">Après {current.label}{current.section ? ` · ${current.section}` : ''}</div>}
      </div>

      <div className="build">
        <label htmlFor="build-range">Construction</label>
        <input id="build-range" type="range" min={1} max={total} value={limit} onChange={(e) => setUpTo(Number(e.target.value))}
          aria-valuetext={`${limit} rangs sur ${total}`} />
        <span className="muted sm build-value">{limit} / {total}</span>
        <div className="row-gap">
          <button type="button" className="btn ghost sm" disabled={myProgress === 0 || myProgress === limit} onClick={() => setUpTo(myProgress)}>Mon avancement</button>
          <button type="button" className="btn ghost sm" disabled={limit === total} onClick={() => setUpTo(total)}>Pièce finie</button>
        </div>
      </div>

      <div className="legend3d">
        <span className="muted sm"><Palette size={15} /> Couleurs du fil</span>
        {legend.map((l) => (
          <label key={l.label} className="color-chip" title={`Couleur : ${l.label}`}>
            <input type="color" value={l.color} onChange={(e) => onPieceColor(l.label, e.target.value)} />
            <span className="dot" style={{ background: l.color }} aria-hidden="true" />
            {l.label}{l.copies > 1 ? ` × ${l.copies}` : ''}
          </label>
        ))}
        {customized && <button type="button" className="btn ghost sm" onClick={() => onPieceColor('*', null)}>Couleurs du patron</button>}
      </div>
      <p className="muted sm">
        Chaque pièce est reconstruite à partir des comptes de mailles et de la hauteur des mailles ; l'assemblage
        (oreilles, lobes, queue, yeux…) est déduit des noms des parties. Glissez pour tourner, pincez ou molette pour zoomer.
      </p>
    </div>
  )
}
