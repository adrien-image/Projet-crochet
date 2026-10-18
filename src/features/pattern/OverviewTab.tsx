import { CircleCheck, Circle, Paperclip, ListOrdered, ImagePlus } from 'lucide-react'
import type { ChecklistItem, Pattern } from '../../domain/types'
import { roundsOf, patternProgress, percent } from '../../domain/progress'
import { splitSections } from '../../domain/parser'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { ProgressBar } from '../../ui/Progress'
import { Checklist } from './Checklist'
import { FabricSwatch } from '../shared/FabricSwatch'

function AttachedFile({ pattern }: { pattern: Pattern }) {
  const url = useAssetUrl(pattern.fileId)
  if (!pattern.fileId) return pattern.fileData ? <p className="muted">Fichier en cours de migration…</p> : null
  if (!url) return <p className="muted">Chargement du fichier…</p>
  const type = pattern.fileType || ''
  const name = pattern.fileName || 'patron'
  return (
    <section className="panel">
      <div className="panel-head">
        <h3><Paperclip size={16} /> {name}</h3>
        <div className="row-gap">
          <a className="btn ghost sm" href={url} target="_blank" rel="noreferrer noopener">Ouvrir</a>
          <a className="btn ghost sm" href={url} download={name}>Télécharger</a>
        </div>
      </div>
      {type === 'application/pdf' && <iframe className="file-preview" src={url} title={name} />}
      {type.startsWith('image/') && type !== 'image/svg+xml' && <img className="file-image" src={url} alt={name} />}
    </section>
  )
}

function Photo({ pattern, onEdit }: { pattern: Pattern, onEdit: () => void }) {
  const url = useAssetUrl(pattern.imageId)
  const src = url || pattern.image || pattern.thumb
  return (
    <div className="photo">
      {src ? <img src={src} alt={pattern.name} /> : (
        <button type="button" className="photo-empty" onClick={onEdit}>
          <FabricSwatch pattern={pattern} />
          <span><ImagePlus size={18} /> Ajouter une photo</span>
        </button>
      )}
    </div>
  )
}

interface Props {
  pattern: Pattern
  onChecklist: (fn: (l: ChecklistItem[]) => ChecklistItem[]) => void
  onSetRounds: (keys: string[], done: boolean) => void
  onOpenCounter: () => void
  onEdit: () => void
}

export function OverviewTab({ pattern, onChecklist, onSetRounds, onOpenCounter, onEdit }: Props) {
  const rounds = roundsOf(pattern)
  const { rounds: rp, steps } = patternProgress(pattern)
  const done = new Set(pattern.roundsDone)
  const current = rounds.find((r) => !done.has(r.key))

  // le texte, ligne par ligne : les lignes de rang deviennent cochables
  const sectionTitles = new Set([...splitSections(pattern.text).keys()].filter(Boolean))
  const lines = (() => {
    const byText = new Map<string, typeof rounds>()
    for (const r of rounds) byText.set(r.text, [...(byText.get(r.text) ?? []), r])
    const seen = new Map<string, number>()
    return pattern.text.split(/\r?\n/).map((line) => {
      const t = line.trim()
      const group = byText.get(t)
      if (!group) return { line, rounds: null }
      // une même ligne peut apparaître dans plusieurs sections (lobe gauche / droit)
      const n = seen.get(t) ?? 0
      seen.set(t, n + 1)
      const sizes = group.length / Math.max(1, pattern.text.split(/\r?\n/).filter((l) => l.trim() === t).length)
      return { line, rounds: group.slice(n * sizes, (n + 1) * sizes) }
    })
  })()

  return (
    <div className="overview">
      <div className="overview-main">
        <AttachedFile pattern={pattern} />
        <section className="panel">
          <div className="panel-head">
            <h3>Instructions</h3>
            {rounds.length > 0 && <span className="muted sm">Touchez un rang pour le cocher</span>}
          </div>
          {pattern.text.trim() ? (
            <div className="instructions">
              {lines.map((l, i) => {
                if (!l.rounds) {
                  const t = l.line.trim()
                  if (!t) return <div key={i} className="ins-gap" />
                  const title = t.replace(/^#+\s*/, '').replace(/\s*:\s*$/, '').replace(/[#=*_\s]+$/, '')
                  return sectionTitles.has(title) || sectionTitles.has(t)
                    ? <h4 key={i} className="ins-section">{title}</h4>
                    : <p key={i} className="ins-text">{l.line}</p>
                }
                const keys = l.rounds.map((r) => r.key)
                const all = keys.every((k) => done.has(k))
                const isCurrent = !!current && keys.includes(current.key)
                return (
                  <button key={i} type="button" className={`ins-round ${all ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                    aria-pressed={all} onClick={() => onSetRounds(keys, !all)}>
                    {all ? <CircleCheck size={18} /> : <Circle size={18} />}
                    <span>{l.line.trim()}</span>
                    {isCurrent && <span className="chip xs accent">en cours</span>}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="muted">Aucun texte. Utilisez « Modifier » pour coller les instructions ou joindre un fichier.</p>
          )}
        </section>
      </div>

      <aside className="overview-side">
        <Photo pattern={pattern} onEdit={onEdit} />
        {(pattern.hook || pattern.yarn) && (
          <section className="panel compact">
            <h3>Matériel</h3>
            <dl className="facts">
              {pattern.hook && <><dt>Crochet</dt><dd>{pattern.hook}</dd></>}
              {pattern.yarn && <><dt>Fil</dt><dd>{pattern.yarn}</dd></>}
            </dl>
          </section>
        )}
        <section className="panel compact">
          <h3>Progression</h3>
          {rp.total > 0 && (
            <div className="stat">
              <div className="stat-row"><span>Rangs</span><strong>{rp.done}/{rp.total}</strong></div>
              <ProgressBar value={percent(rp)} tone="accent" label="Rangs terminés" />
            </div>
          )}
          <div className="stat">
            <div className="stat-row"><span>Étapes</span><strong>{steps.done}/{steps.total}</strong></div>
            <ProgressBar value={percent(steps)} tone="done" label="Étapes cochées" />
          </div>
          {rp.total > 0 && (
            <button type="button" className="btn primary block" onClick={onOpenCounter}>
              <ListOrdered size={18} /> {current ? `Continuer au ${current.label}` : 'Ouvrir le compteur'}
            </button>
          )}
        </section>
        <section className="panel compact">
          <h3>Étapes</h3>
          <Checklist items={pattern.checklist} onChange={onChecklist} />
        </section>
      </aside>
    </div>
  )
}
