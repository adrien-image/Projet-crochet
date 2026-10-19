import { useMemo, useState } from 'react'
import { CircleCheck, Circle, Paperclip, ListOrdered, StickyNote, Spool, Timer, Ruler } from 'lucide-react'
import type { Pattern } from '../../domain/types'
import { roundsOf, patternProgress, percent } from '../../domain/progress'
import { textLines } from './textLines'
import { materialLabel } from './yarnLabels'
import { ballsFor, estimateYarn, formatMeters, yarnMaterial, yarnWeight, YARN_MARGIN } from '../../domain/yarn'
import { colorName } from '../../domain/colors'
import { formatDuration, lastWeekSeconds, totalSeconds } from '../../domain/time'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { useTicker } from '../../hooks/useTicker'
import { t, tn, getLang } from '../../i18n'
import { ProgressBar } from '../../ui/Progress'
import { Checklist } from './Checklist'
import { setChecklist, setPieceColor, setRoundsDone, type Update } from './actions'
import { buildPieces } from '../../domain/pieces'
import { estimateSize, HOOK_SIZES, resize } from '../../domain/size'
import { TimerButton } from './PatternView'
import { PhotoGallery } from './PhotoGallery'

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

function YarnCard({ pattern, update }: { pattern: Pattern, update: Update }) {
  const est = useMemo(() => estimateYarn(pattern), [pattern])
  const pieces = useMemo(() => buildPieces(pattern), [pattern])
  if (!est.meters) return null
  const lang = getLang()
  const weight = yarnWeight(est.hook)
  const material = yarnMaterial(`${pattern.yarn}\n${pattern.text}`)
  return (
    <section className="panel compact yarn-card">
      <h3><Spool size={16} /> {t('Fils à prévoir')}</h3>
      <p className="yarn-total">≈ {formatMeters(est.meters, lang)} <span className="muted sm">± {Math.round(YARN_MARGIN * 100)} %</span></p>
      <p className="yarn-type">
        <strong>{t('Épaisseur {c}', { c: weight.category })}</strong> · {weight.names}
        {material && <> · {materialLabel(material)}</>}
      </p>
      <ul className="yarn-list">
        {est.byColor.map((c) => {
          const { grams } = ballsFor(c.meters, weight, material)
          const known = colorName(c.color)
          return (
            <li key={c.color}>
              <span className="dot" style={{ background: c.color }} aria-hidden="true" />
              <span className="yarn-name">
                <strong>{c.name ?? (known ? t(known) : t('Fil'))}{c.guessed && <span className="chip xs warn guess" title={t('Le patron ne précise pas cette couleur : vérifiez-la ci-dessous.')}>{t('supposée')}</span>}</strong>
                <span className="muted sm">{c.pieces.join(', ')}</span>
              </span>
              <span className="yarn-amount">
                {formatMeters(c.meters * (1 + YARN_MARGIN), lang)}
                <span className="muted sm">≈ {grams} g</span>
              </span>
            </li>
          )
        })}
      </ul>
      <details className="piece-colors" open={pieces.some((p) => p.colorGuessed)}>
        <summary>{t('Couleur de chaque pièce')}</summary>
        {pieces.map((p) => (
          <label key={p.label} className="piece-color">
            <input type="color" value={p.color} aria-label={t('Couleur : {p}', { p: p.label })}
              onChange={(e) => update((x) => setPieceColor(x, p.label, e.target.value))} />
            <span>{p.label}{p.copies > 1 ? ` × ${p.copies}` : ''}</span>
            {p.colorGuessed && <span className="chip xs warn">{t('supposée')}</span>}
            {pattern.pieceColors[p.label] && (
              <button type="button" className="btn ghost sm" onClick={() => update((x) => setPieceColor(x, p.label, null))}>{t('Couleur du patron')}</button>
            )}
          </label>
        ))}
      </details>
      <p className="muted sm">
        {est.assumedHook
          ? t('Estimation pour un crochet de 4 mm (précisez la taille du crochet pour l\'affiner).')
          : t('Estimation d\'après les mailles du patron et un crochet de {h} mm, marge comprise.', { h: est.hook.toLocaleString(lang) })}
        {' '}{t('Pour un amigurumi, un fil de cette épaisseur se crochète serré avec ce crochet.')}
      </p>
    </section>
  )
}

/** Taille finale, et ce qu'elle devient avec un autre crochet (fil et épaisseur assortis). */
function SizeCard({ pattern }: { pattern: Pattern }) {
  const base = useMemo(() => estimateSize(pattern), [pattern])
  const [hook, setHook] = useState<number | null>(null)
  if (!base) return null
  const lang = getLang()
  const cm = (d: [number, number, number]) => d.map((x) => x.toLocaleString(lang, { maximumFractionDigits: 1 })).join(' × ')
  const other = hook && hook !== base.hook ? resize(base, hook) : null
  return (
    <section className="panel compact size-card">
      <h3><Ruler size={16} /> {t('Taille et crochet')}</h3>
      <p className="size-main"><strong>≈ {cm(base.dims)} cm</strong></p>
      <p className="muted sm">{base.stated ? t('Taille annoncée par le patron, crochet de {h} mm.', { h: base.hook.toLocaleString(lang) }) : t('Estimée d\'après les mailles, crochet de {h} mm.', { h: base.hook.toLocaleString(lang) })}</p>
      <div className="field">
        <label htmlFor="resize-hook">{t('Avec un autre crochet')}</label>
        <select id="resize-hook" className="input" value={hook ?? base.hook} onChange={(e) => setHook(Number(e.target.value))}>
          {[...new Set([...HOOK_SIZES, base.hook])].sort((a, b) => a - b).map((h) => (
            <option key={h} value={h}>{h.toLocaleString(lang)} mm{h === base.hook ? ` (${t('patron')})` : ''}</option>
          ))}
        </select>
      </div>
      {other && (
        <div className="resized" aria-live="polite">
          <div className="stat-row"><span>{t('Taille')}</span><strong>≈ {cm(other.dims)} cm</strong></div>
          <div className="stat-row"><span>{t('Fil')}</span><strong>≈ {formatMeters(other.meters * (1 + YARN_MARGIN), lang)}</strong></div>
          <div className="stat-row"><span>{t('Épaisseur')}</span><strong>{other.weight.category} · {other.weight.names}</strong></div>
          <p className="muted sm">{t('Même patron, mêmes rangs : chaque maille grandit avec le crochet et un fil plus épais.')}</p>
        </div>
      )}
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
}

export function OverviewTab({ pattern, update, onOpenCounter }: Props) {
  const rounds = roundsOf(pattern)
  const { rounds: rp, steps } = patternProgress(pattern)
  const done = new Set(pattern.roundsDone)
  const current = rounds.find((r) => !done.has(r.key))

  // le texte, ligne par ligne : les lignes de rang deviennent cochables
  const lines = textLines(pattern.text, rounds)

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
                  if (!l.line.trim()) return <div key={i} className="ins-gap" />
                  return l.title ? <h4 key={i} className="ins-section">{l.title}</h4> : <p key={i} className="ins-text">{l.line}</p>
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
        <PhotoGallery pattern={pattern} update={update} />
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
        <YarnCard pattern={pattern} update={update} />
        <SizeCard pattern={pattern} />
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
