import { Ellipsis, ListOrdered, Trash2, Box } from 'lucide-react'
import type { Pattern } from '../../domain/types'
import { patternProgress } from '../../domain/progress'
import { routeHash, type PatternTab } from '../../hooks/useHashRoute'
import { Menu } from '../../ui/Menu'
import { ProgressBar } from '../../ui/Progress'
import { FabricSwatch } from '../shared/FabricSwatch'

interface Props {
  pattern: Pattern
  onOpen: (id: string, tab?: PatternTab) => void
  onDelete: (id: string) => void
  onTag: (tag: string) => void
}

export function PatternCard({ pattern, onOpen, onDelete, onTag }: Props) {
  const progress = patternProgress(pattern)
  const { rounds, steps, pct } = progress
  const finished = progress.total > 0 && progress.done === progress.total
  const cover = pattern.thumb || pattern.image

  return (
    <article className="card">
      <div className="card-cover">
        {cover ? <img src={cover} alt="" loading="lazy" /> : <FabricSwatch pattern={pattern} />}
        {finished && <span className="badge success">Terminé</span>}
        {!finished && progress.done > 0 && <span className="badge">En cours</span>}
      </div>
      <div className="card-body">
        <h3 className="card-title">
          <a href={routeHash({ patternId: pattern.id, tab: 'patron' })} className="stretched"
            onClick={(e) => { e.preventDefault(); onOpen(pattern.id) }}>
            {pattern.name}
          </a>
        </h3>
        <p className="card-meta">
          {[pattern.hook && `Crochet ${pattern.hook}`, rounds.total ? `${rounds.total} rangs` : null, pattern.fileId && 'PDF / fichier']
            .filter(Boolean).join(' · ') || 'Patron libre'}
        </p>
        {pattern.tags.length > 0 && (
          <div className="card-tags">
            {pattern.tags.slice(0, 4).map((t) => (
              <button key={t} type="button" className="chip sm raise" onClick={() => onTag(t)}>#{t}</button>
            ))}
          </div>
        )}
        <div className="card-progress">
          <ProgressBar value={pct} tone={finished ? 'done' : 'accent'} label={`Progression ${pct} %`} />
          <span>
            {progress.total === 0 ? 'Pas encore commencé' : [
              rounds.total ? `${rounds.done}/${rounds.total} rangs` : null,
              steps.total ? `${steps.done}/${steps.total} étapes` : null,
            ].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>
      <div className="card-menu raise">
        <Menu label={`Actions pour ${pattern.name}`} icon={<Ellipsis size={18} />} items={[
          { label: 'Ouvrir le compteur', icon: <ListOrdered size={16} />, onSelect: () => onOpen(pattern.id, 'compteur'), disabled: !rounds.total },
          { label: 'Aperçu 3D', icon: <Box size={16} />, onSelect: () => onOpen(pattern.id, '3d'), disabled: !rounds.total },
          { label: 'Supprimer', icon: <Trash2 size={16} />, onSelect: () => onDelete(pattern.id), danger: true },
        ]} />
      </div>
    </article>
  )
}
