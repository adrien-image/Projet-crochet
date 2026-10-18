import { useState } from 'react'
import type { Pattern } from '../../domain/types'
import { patternProgress } from '../../domain/progress'
import { formatDuration } from '../../domain/time'
import { t } from '../../i18n'
import { Dialog } from '../../ui/Dialog'

interface Props {
  pattern: Pattern
  onDuplicate: (name: string, keepProgress: boolean) => void
  onCancel: () => void
}

/** Copie d'un patron : pour refaire l'ouvrage (de zéro) ou garder une version en cours. */
export function DuplicateDialog({ pattern, onDuplicate, onCancel }: Props) {
  const [name, setName] = useState(t('{name} (copie)', { name: pattern.name }))
  const { rounds, steps } = patternProgress(pattern)
  const started = rounds.done > 0 || steps.done > 0 || pattern.timeSpent > 0 || Object.keys(pattern.roundNotes).length > 0
  const [keep, setKeep] = useState(false)
  const progress = [
    rounds.total ? t('{d}/{n} rangs', { d: rounds.done, n: rounds.total }) : null,
    steps.total ? t('{d}/{n} étapes', { d: steps.done, n: steps.total }) : null,
    pattern.timeSpent ? formatDuration(pattern.timeSpent) : null,
  ].filter(Boolean).join(' · ')

  return (
    <Dialog open size="sm" title={t('Dupliquer le patron')} onClose={onCancel}
      onSubmit={() => { if (name.trim()) onDuplicate(name.trim(), keep && started) }}
      footer={(
        <>
          <button type="button" className="btn ghost" onClick={onCancel}>{t('Annuler')}</button>
          <button type="submit" className="btn primary" disabled={!name.trim()}>{t('Dupliquer')}</button>
        </>
      )}>
      <div className="form">
        <div className="field">
          <label htmlFor="dup-name">{t('Nom de la copie')}</label>
          <input id="dup-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <fieldset className="choice-list">
          <legend>{t('Progression')}</legend>
          <label className={`choice ${!keep ? 'on' : ''}`}>
            <input type="radio" name="dup-progress" checked={!keep} onChange={() => setKeep(false)} />
            <span>
              <strong>{t('Repartir de zéro')}</strong>
              <span className="muted sm">{t('Rangs et étapes décochés, chronomètre et notes de rang remis à zéro. Pour refaire l\'ouvrage.')}</span>
            </span>
          </label>
          <label className={`choice ${keep ? 'on' : ''} ${started ? '' : 'disabled'}`}>
            <input type="radio" name="dup-progress" checked={keep} disabled={!started} onChange={() => setKeep(true)} />
            <span>
              <strong>{t('Garder la progression')}</strong>
              <span className="muted sm">
                {started ? t('La copie reprend où vous en êtes : {p}.', { p: progress }) : t('Ce patron n\'est pas encore commencé.')}
              </span>
            </span>
          </label>
        </fieldset>
        <p className="muted sm">{t('Les photos, le fichier joint, les couleurs et le placement des pièces sont copiés.')}</p>
      </div>
    </Dialog>
  )
}
