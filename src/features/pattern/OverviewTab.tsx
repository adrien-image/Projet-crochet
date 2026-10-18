import { useMemo } from 'react'
import { CircleCheck, Circle, Paperclip, ListOrdered, ImagePlus, StickyNote, Spool, Timer } from 'lucide-react'
import type { Pattern } from '../../domain/types'
import { roundsOf, patternProgress, percent } from '../../domain/progress'
import { splitSections } from '../../domain/parser'
import { estimateYarn, formatMeters, YARN_MARGIN } from '../../domain/yarn'
import { formatDuration, lastWeekSeconds, totalSeconds } from '../../domain/time'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { useTicker } from '../../hooks/useTicker'
import { t, tn, getLang } from '../../i18n'
import { ProgressBar } from '../../ui/Progress'
import { Checklist } from './Checklist'
import { FabricSwatch } from '../shared/FabricSwatch'
import { setChecklist, setRoundsDone, type Update } from './actions'
import { TimerButton } from './PatternView'

function AttachedFile({ pattern }: { pattern: Pattern }) {
  const url = useAssetUrl(pattern.fileId)
  if (!pattern.fileId) return pattern.fileData ? <p className="muted">{t('Fichier en cours de migration…')}</p> : null
  if (!url) return <p className="muted">{t('Chargement du fichier…')}</p>
  const type = pattern.fileType || ''
  const name = pattern.fileName || t('patron')
  return (
    <section className="panel">
      <div className="panel-head">
        <h3><Paperclip size={16} /> {name}</h3>
        <div className="row-gap">
          <a className="btn ghost sm" href={url} target="_blank" rel="noreferrer noopener">{t('Ouvrir')}</a>
          <a className="btn ghost sm" href={url} download={name}>{t('Télécharger')}</a>
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
          <span><ImagePlus size={18} /> {t('Ajouter une photo')}</span>
        </button>
      )}
    </div>
  )
}

function YarnCard({ pattern }: { pattern: Pattern }) {
  const est = useMemo(() => estimateYarn(pattern), [pattern])
  if (!est.meters) return null
  const lang = getLang()
  return (
    <section className="panel compact">
      <h3><Spool size={16} /> {t('Fil nécessaire')}</h3>
      <p className="yarn-total">≈ {formatMeters(est.meters, lang)} <span className="muted sm">± {Math.round(YARN_MARGIN * 100)} %</span></p>
      {est.byColor.length > 1 && (
        <ul className="yarn-list">
          {est.byColor.map((c) => (
            <li key={c.color}><span className="dot" style={{ background: c.color }} aria-hidden="true" /> {formatMeters(c.meters, lang)}</li>
          ))}
        </ul>
      )}
      <p className="muted sm">
        {est.assumedHook
          ? t('Estimation pour un crochet de 4 mm (précisez la taille du crochet pour l\'affiner).')
          : t('Estimation d\'après les mailles du patron et un crochet de {h} mm.', { h: est.hook.toLocaleString(lang) })}
      </p>
    </section>
  )
}

function TimeCard({ pattern, update }: { pattern: Pattern, update: Update }) {
  const now = useTicker(!!pattern.timerStartedAt, 30_000)
  const total = totalSeconds(pattern, now)
  const week = lastWeekSeconds(pattern, now)
  return (
    <section className="panel compact">
      <h3><Timer size={16} /> {t('Temps passé')}</h3>
      <div className="stat-row"><span>{t('Au total')}</span><strong className="tabular">{total ? formatDuration(total) : '—'}</strong></div>
      <div className="stat-row"><span>{t('7 derniers jours')}</span><strong className="tabular">{week ? formatDuration(week) : '—'}</strong></div>
      {pattern.sessions.length > 0 && <div className="stat-row"><span>{t('Séances')}</span><strong>{pattern.sessions.length}</strong></div>}
      <TimerButton pattern={pattern} update={update} />
    </section>
  )
}

interface Props {
  pattern: Pattern
  update: Update
  onOpenCounter: () => void
  onEdit: () => void
}

export function OverviewTab({ pattern, update, onOpenCounter, onEdit }: Props) {
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
      const tr = line.trim()
      const group = byText.get(tr)
      if (!group) return { line, rounds: null }
      // une même ligne peut apparaître dans plusieurs sections (lobe gauche / droit)
      const n = seen.get(tr) ?? 0
      seen.set(tr, n + 1)
      const sizes = group.length / Math.max(1, pattern.text.split(/\r?\n/).filter((l) => l.trim() === tr).length)
      return { line, rounds: group.slice(n * sizes, (n + 1) * sizes) }
    })
  })()

  return (
    <div className="overview">
      <div className="overview-main">
        <AttachedFile pattern={pattern} />
        <section className="panel">
          <div className="panel-head">
            <h3>{t('Instructions')}</h3>
            {rounds.length > 0 && <span className="muted sm">{t('Touchez un rang pour le cocher')}</span>}
          </div>
          {pattern.text.trim() ? (
            <div className="instructions">
              {lines.map((l, i) => {
                if (!l.rounds) {
                  const tr = l.line.trim()
                  if (!tr) return <div key={i} className="ins-gap" />
                  const title = tr.replace(/^#+\s*/, '').replace(/\s*:\s*$/, '').replace(/[#=*_\s]+$/, '')
                  return sectionTitles.has(title) || sectionTitles.has(tr)
                    ? <h4 key={i} className="ins-section">{title}</h4>
                    : <p key={i} className="ins-text">{l.line}</p>
                }
                const keys = l.rounds.map((r) => r.key)
                const all = keys.every((k) => done.has(k))
                const isCurrent = !!current && keys.includes(current.key)
                const noted = keys.filter((k) => pattern.roundNotes[k])
                return (
                  <button key={i} type="button" className={`ins-round ${all ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                    aria-pressed={all} onClick={() => update((p) => setRoundsDone(p, keys, !all))}>
                    {all ? <CircleCheck size={18} /> : <Circle size={18} />}
                    <span>{l.line.trim()}</span>
                    {l.rounds[0].color && <span className="dot" style={{ background: l.rounds[0].color }} title={t('Couleur du fil')} />}
                    {noted.length > 0 && (
                      <span className="note-mark" title={noted.map((k) => pattern.roundNotes[k].text).filter(Boolean).join(' · ') || t('Photo')}>
                        <StickyNote size={15} />
                      </span>
                    )}
                    {isCurrent && <span className="chip xs accent">{t('en cours')}</span>}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="muted">{t('Aucun texte. Utilisez « Modifier » pour coller les instructions ou joindre un PDF.')}</p>
          )}
        </section>
      </div>

      <aside className="overview-side">
        <Photo pattern={pattern} onEdit={onEdit} />
        <section className="panel compact">
          <h3>{t('Progression')}</h3>
          {rp.total > 0 && (
            <div className="stat">
              <div className="stat-row"><span>{t('Rangs')}</span><strong>{rp.done}/{rp.total}</strong></div>
              <ProgressBar value={percent(rp)} tone="accent" label={t('Rangs terminés')} />
            </div>
          )}
          <div className="stat">
            <div className="stat-row"><span>{t('Étapes')}</span><strong>{steps.done}/{steps.total}</strong></div>
            <ProgressBar value={percent(steps)} tone="done" label={t('Étapes cochées')} />
          </div>
          {rp.total > 0 && (
            <button type="button" className="btn primary block" onClick={onOpenCounter}>
              <ListOrdered size={18} /> {current ? t('Continuer au {r}', { r: current.label }) : t('Ouvrir le compteur')}
            </button>
          )}
        </section>
        <TimeCard pattern={pattern} update={update} />
        <YarnCard pattern={pattern} />
        {(pattern.hook || pattern.yarn) && (
          <section className="panel compact">
            <h3>{t('Matériel')}</h3>
            <dl className="facts">
              {pattern.hook && <><dt>{t('Crochet')}</dt><dd>{pattern.hook}</dd></>}
              {pattern.yarn && <><dt>{t('Fil')}</dt><dd>{pattern.yarn}</dd></>}
            </dl>
          </section>
        )}
        <section className="panel compact">
          <h3>{tn(pattern.checklist.length, 'Étape', 'Étapes')}</h3>
          <Checklist items={pattern.checklist} onChange={(fn) => update((p) => setChecklist(p, fn))} />
        </section>
      </aside>
    </div>
  )
}
