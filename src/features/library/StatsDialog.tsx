import { useMemo, useState } from 'react'
import type { Pattern } from '../../domain/types'
import { libraryStats, type WeekStats } from '../../domain/stats'
import { formatDuration } from '../../domain/time'
import { formatMeters } from '../../domain/yarn'
import { getLang, t, tn } from '../../i18n'
import { Dialog } from '../../ui/Dialog'
import { Segmented } from '../../ui/Segmented'

type Measure = 'seconds' | 'rounds' | 'meters'

const W = 600
const H = 190
const LEFT = 52
const BOTTOM = 26
const TOP = 10

/** Maximum « rond » de l'axe (1, 2, 2,5 ou 5 × 10ⁿ). */
function niceMax(v: number): number {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p
}

/** Barre arrondie en haut, posée sur la ligne de base. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function WeeklyChart({ weeks, measure, format }: { weeks: WeekStats[], measure: Measure, format: (v: number) => string }) {
  const [active, setActive] = useState<number | null>(null)
  const lang = getLang()
  const values = weeks.map((w) => w[measure])
  const top = Math.max(...values)
  // durées : graduations en heures (ou en minutes) rondes
  const max = measure !== 'seconds' ? niceMax(top) : top >= 3600 ? niceMax(top / 3600) * 3600 : niceMax(Math.max(top, 60) / 60) * 60
  const plotW = W - LEFT - 8
  const plotH = H - TOP - BOTTOM
  const band = plotW / weeks.length
  const barW = Math.min(28, band * 0.62)
  const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(lang, { day: 'numeric', month: 'short' })
  const ticks = [0, max / 2, max]
  return (
    <div className="week-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Graphique par semaine')}>
        {ticks.map((v) => {
          const y = TOP + plotH - (v / max) * plotH
          return (
            <g key={v}>
              <line x1={LEFT} x2={W - 8} y1={y} y2={y} className={v === 0 ? 'wc-base' : 'wc-grid'} />
              <text x={LEFT - 8} y={y + 4} textAnchor="end" className="wc-tick">{format(v)}</text>
            </g>
          )
        })}
        {weeks.map((w, i) => {
          const v = w[measure]
          const h = (v / max) * plotH
          const x = LEFT + i * band + (band - barW) / 2
          return (
            <g key={w.week} tabIndex={0} role="img" aria-label={`${t('Semaine du {d}', { d: day(w.week) })} : ${format(v)}`}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
              <rect x={LEFT + i * band} y={TOP} width={band} height={plotH} className="wc-hit" />
              {v > 0 && <path d={barPath(x, TOP + plotH - h, barW, h)} className={`wc-bar ${active === i ? 'active' : ''}`} />}
              {(i % 3 === 2 || i === weeks.length - 1) && (
                <text x={LEFT + i * band + band / 2} y={H - 8} textAnchor="middle" className="wc-tick">{i === weeks.length - 1 ? t('cette sem.') : day(w.week)}</text>
              )}
            </g>
          )
        })}
      </svg>
      {active != null && (
        <div className="wc-tip" role="status" style={{
          left: `${((LEFT + active * band + band / 2) / W) * 100}%`,
          top: `${((TOP + plotH - (values[active] / max) * plotH) / H) * 100}%`,
        }}>
          <span className="muted">{t('Semaine du {d}', { d: day(weeks[active].week) })}</span>
          <strong>{format(values[active])}</strong>
        </div>
      )}
    </div>
  )
}

/** Statistiques : temps passé, rangs terminés, fil utilisé, par semaine et par patron. */
export function StatsDialog({ patterns, onClose }: { patterns: Pattern[], onClose: () => void }) {
  const [measure, setMeasure] = useState<Measure>('seconds')
  const stats = useMemo(() => libraryStats(patterns), [patterns])
  const lang = getLang()
  const formats: Record<Measure, (v: number) => string> = {
    seconds: (v) => (v ? formatDuration(Math.round(v)) : '0'),
    rounds: (v) => String(Math.round(v * 10) / 10),
    meters: (v) => (v ? formatMeters(v, lang) : '0'),
  }
  const started = stats.patterns.filter((p) => p.seconds > 0 || p.roundsDone > 0)

  return (
    <Dialog open title={t('Statistiques')} size="lg" onClose={onClose}
      footer={<button type="button" className="btn primary" onClick={onClose}>{t('Fermer')}</button>}>
      <div className="stats">
        <div className="stat-tiles">
          <div className="stat-tile"><span>{t('Temps de crochet')}</span><strong>{formatDuration(stats.seconds)}</strong></div>
          <div className="stat-tile"><span>{t('Rangs terminés')}</span><strong>{stats.roundsDone}</strong></div>
          <div className="stat-tile"><span>{t('Patrons')}</span><strong>{stats.finished} <small>{t('finis')}</small> · {stats.inProgress} <small>{t('en cours')}</small></strong></div>
          <div className="stat-tile"><span>{t('Fil utilisé')}</span><strong>≈ {formatMeters(stats.metersUsed, lang)}</strong></div>
        </div>

        <section>
          <div className="stats-head">
            <h3>{t('Les 12 dernières semaines')}</h3>
            <Segmented size="sm" label={t('Mesure')} value={measure} onChange={setMeasure} options={[
              { value: 'seconds', label: t('Temps') },
              { value: 'rounds', label: t('Rangs') },
              { value: 'meters', label: t('Fil') },
            ]} />
          </div>
          <WeeklyChart weeks={stats.weeks} measure={measure} format={formats[measure]} />
          <p className="muted sm">{measure === 'seconds'
            ? t('Temps compté par le chronomètre de chaque patron.')
            : t('D\'après la date à laquelle chaque rang a été coché ; le fil est estimé d\'après les mailles du rang.')}</p>
          <details className="stats-table">
            <summary>{t('Voir les données')}</summary>
            <table>
              <thead><tr><th>{t('Semaine du')}</th><th>{t('Temps')}</th><th>{t('Rangs')}</th><th>{t('Fil')}</th></tr></thead>
              <tbody>
                {stats.weeks.map((w) => (
                  <tr key={w.week}><td>{new Date(`${w.week}T12:00:00`).toLocaleDateString(lang)}</td><td>{formats.seconds(w.seconds)}</td><td>{w.rounds}</td><td>{formats.meters(w.meters)}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>

        <section>
          <h3>{t('Par patron')}</h3>
          {started.length === 0 ? <p className="muted">{t('Aucun patron commencé pour l\'instant.')}</p> : (
            <div className="stats-scroll">
              <table className="stats-patterns">
                <thead><tr><th>{t('Patron')}</th><th>{t('Temps')}</th><th>{t('Rangs')}</th><th>{t('Rangs / h')}</th><th>{t('Fil utilisé')}</th></tr></thead>
                <tbody>
                  {started.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.seconds ? formatDuration(p.seconds) : '—'}</td>
                      <td>{p.roundsDone} / {p.rounds}</td>
                      <td>{p.perHour != null ? p.perHour.toLocaleString(lang, { maximumFractionDigits: 1 }) : '—'}</td>
                      <td>{p.meters ? `${formatMeters(p.metersUsed, lang)} / ${formatMeters(p.meters, lang)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted sm">{tn(stats.patterns.length, '{n} patron dans la bibliothèque.', '{n} patrons dans la bibliothèque.')}</p>
        </section>
      </div>
    </Dialog>
  )
}
