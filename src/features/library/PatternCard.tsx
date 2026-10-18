import { Copy, Ellipsis, ListOrdered, Trash2, Box, Timer } from 'lucide-react'
import type { Pattern } from '../../domain/types'
import { patternProgress } from '../../domain/progress'
import { formatDuration, totalSeconds } from '../../domain/time'
import { routeHash, type PatternTab } from '../../hooks/useHashRoute'
import { t, tn } from '../../i18n'
import { Menu } from '../../ui/Menu'
import { ProgressBar } from '../../ui/Progress'
import { FabricSwatch } from '../shared/FabricSwatch'

interface Props {
  pattern: Pattern
  onOpen: (id: string, tab?: PatternTab) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onTag: (tag: string) => void
}

export function PatternCard({ pattern, onOpen, onDelete, onDuplicate, onTag }: Props) {
  const progress = patternProgress(pattern)
  const { rounds, steps, pct } = progress
  const finished = progress.total > 0 && progress.done === progress.total
  const cover = pattern.thumb || pattern.image
  const time = totalSeconds(pattern)

  return (
    <article className="card">
      <div className="card-cover">
        {cover ? <img src={cover} alt="" loading="lazy" /> : <FabricSwatch pattern={pattern} />}
        {finished && <span className="badge success">{t('Terminé')}</span>}
        {!finished && progress.done > 0 && <span className="badge">{t('En cours')}</span>}
        {pattern.timerStartedAt && <span className="badge timer"><Timer size={12} /> {t('Chrono lancé')}</span>}
      </div>
      <div className="card-body">
        <h3 className="card-title">
          <a href={routeHash({ patternId: pattern.id, tab: 'patron' })} className="stretched"
            onClick={(e) => { e.preventDefault(); onOpen(pattern.id) }}>
            {pattern.name}
          </a>
        </h3>
        <p className="card-meta">
          {[
            pattern.hook && t('Crochet {h}', { h: pattern.hook }),
            rounds.total ? tn(rounds.total, '{n} rang', '{n} rangs') : null,
            time >= 60 ? formatDuration(time) : null,
            pattern.fileId && t('PDF / fichier'),
          ].filter(Boolean).join(' · ') || t('Patron libre')}
        </p>
        {pattern.tags.length > 0 && (
          <div className="card-tags">
            {pattern.tags.slice(0, 4).map((tg) => (
              <button key={tg} type="button" className="chip sm raise" onClick={() => onTag(tg)}>#{tg}</button>
            ))}
          </div>
        )}
        <div className="card-progress">
          <ProgressBar value={pct} tone={finished ? 'done' : 'accent'} label={t('Progression {p} %', { p: pct })} />
          <span>
            {progress.total === 0 ? t('Pas encore commencé') : [
              rounds.total ? t('{d}/{n} rangs', { d: rounds.done, n: rounds.total }) : null,
              steps.total ? t('{d}/{n} étapes', { d: steps.done, n: steps.total }) : null,
            ].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>
      <div className="card-menu raise">
        <Menu label={t('Actions pour {name}', { name: pattern.name })} icon={<Ellipsis size={18} />} items={[
          { label: t('Ouvrir le compteur'), icon: <ListOrdered size={16} />, onSelect: () => onOpen(pattern.id, 'compteur'), disabled: !rounds.total },
          { label: t('Aperçu 3D'), icon: <Box size={16} />, onSelect: () => onOpen(pattern.id, '3d'), disabled: !rounds.total },
          { label: t('Dupliquer…'), icon: <Copy size={16} />, onSelect: () => onDuplicate(pattern.id) },
          { label: t('Supprimer'), icon: <Trash2 size={16} />, onSelect: () => onDelete(pattern.id), danger: true },
        ]} />
      </div>
    </article>
  )
}
