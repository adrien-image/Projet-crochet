import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowDown, Check } from 'lucide-react'
import type { Notation, Round } from '../../domain/types'
import { parsePattern, patternStats } from '../../domain/parser'
import { t, tn } from '../../i18n'
import { Dialog } from '../../ui/Dialog'
import { textLines } from './textLines'
import { findOnPages, occurrenceOf, type PageSpot } from './pageMatch'
import type { PageLayout } from '../../storage/pdfText'

interface Props {
  text: string
  notation: Notation
  size: number
  /** aperçu des pages du PDF (data:) ; vide pour un patron saisi à la main */
  pages: string[]
  /** place des lignes sur ces pages : la ligne en cours est surlignée sur sa page */
  layout?: PageLayout[]
  /** texte lu par OCR : chaque ligne est suspecte */
  ocr?: boolean
  onChange: (text: string) => void
  onClose: () => void
}

/** Problème d'un rang : compte annoncé différent, ou rang qui ne prend pas toutes les mailles du précédent. */
function roundIssue(r: Round): string | null {
  if (!r.valid && r.expected != null) return t('⚠ {c} mailles calculées, {e} annoncées', { c: r.count, e: r.expected })
  if (r.fits === false) return t('⚠ Ce rang se travaille sur {c} mailles, le rang précédent en compte {p}.', { c: r.consumed, p: r.prevCount ?? 0 })
  return null
}

/**
 * Vérification d'un import : les pages du PDF à gauche, les lignes reconnues à droite (rangs, titres
 * de pièces, texte), les rangs dont le compte ne tombe pas juste signalés, chaque ligne modifiable.
 */
export function ImportReview({ text, notation, size, pages, layout = [], ocr, onChange, onClose }: Props) {
  const [onlyIssues, setOnlyIssues] = useState(false)
  const [spot, setSpot] = useState<PageSpot | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const mark = useRef<HTMLDivElement>(null)
  useEffect(() => { mark.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [spot])
  const locate = (index: number) => {
    const all = text.split(/\r?\n/)
    setSpot(findOnPages(all[index], layout, occurrenceOf(all, index)))
  }
  const rounds = useMemo(() => parsePattern(text, { notation, size }), [text, notation, size])
  const stats = patternStats(rounds)
  const lines = useMemo(() => textLines(text, rounds).map((l, i) => {
    const issues = (l.rounds ?? []).map(roundIssue).filter((x): x is string => !!x)
    return { ...l, index: i, issues: [...new Set(issues)] }
  }), [text, rounds])
  const flagged = lines.filter((l) => l.issues.length)
  const shown = lines.filter((l) => l.line.trim() && (!onlyIssues || l.issues.length))

  const edit = (index: number, value: string) => {
    const all = text.split(/\r?\n/)
    all[index] = value
    onChange(all.join('\n'))
  }
  const nextIssue = () => {
    const rows = [...(list.current?.querySelectorAll<HTMLElement>('.review-line.flagged') ?? [])]
    const focused = rows.findIndex((r) => r.contains(document.activeElement))
    const row = rows[(focused + 1) % rows.length]
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    row?.querySelector('input')?.focus()
  }

  return createPortal(
    <Dialog open title={t('Vérifier l\'import')} onClose={onClose} size="xl"
      footer={<button type="button" className="btn primary" onClick={onClose}><Check size={16} /> {t('Terminé')}</button>}>
      <div className={`review ${pages.length ? '' : 'no-pages'}`}>
        {pages.length > 0 && (
          <div className="review-pages" aria-label={t('Pages du PDF')}>
            {pages.map((src, i) => (
              <div key={i} className="review-page">
                <img src={src} alt={t('Page {n}', { n: i + 1 })} />
                {spot?.page === i && (
                  <div ref={mark} className="review-mark" aria-hidden="true" style={{
                    left: `${spot.box[0] * 100}%`, top: `${spot.box[1] * 100}%`,
                    width: `${(spot.box[2] - spot.box[0]) * 100}%`, height: `${(spot.box[3] - spot.box[1]) * 100}%`,
                  }} />
                )}
              </div>
            ))}
          </div>
        )}
        <div className="review-side">
          <div className="review-bar">
            <p className={`analysis ${flagged.length ? 'warn' : 'ok'}`} aria-live="polite">
              <strong>{tn(stats.rounds, '{n} rang', '{n} rangs')}</strong> · {tn(stats.pieces, '{n} pièce', '{n} pièces')}
              {flagged.length ? ` · ${tn(flagged.length, '{n} ligne à vérifier', '{n} lignes à vérifier')}` : ` · ${t('comptes cohérents ✓')}`}
            </p>
            {ocr && <p className="muted sm">{t('Texte lu sur des pages scannées : comparez chaque ligne avec la page.')}</p>}
            <div className="row-gap wrap">
              <label className="switch">
                <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
                <span className="switch-track" aria-hidden="true" />
                <span>{t('Seulement les lignes à vérifier')}</span>
              </label>
              {flagged.length > 0 && <button type="button" className="btn ghost sm" onClick={nextIssue}><ArrowDown size={15} /> {t('Suivante à vérifier')}</button>}
            </div>
          </div>
          <div className="review-lines" ref={list}>
            {shown.length === 0 && <p className="muted">{onlyIssues ? t('Rien à vérifier.') : t('Aucun texte.')}</p>}
            {shown.map((l) => {
              const kind = l.title ? 'title' : l.rounds ? 'round' : 'text'
              return (
                <div key={l.index} className={`review-line ${kind} ${l.issues.length ? 'flagged' : ''}`}>
                  <span className="review-tag">
                    {l.title ? t('Pièce') : l.rounds ? l.rounds.map((r) => r.label).join(', ') : ''}
                    {l.rounds && !l.issues.length && <span className="review-count"> · {l.rounds[l.rounds.length - 1].count}</span>}
                  </span>
                  <input className="input mono" value={l.line} aria-label={t('Ligne {n}', { n: l.index + 1 })}
                    onChange={(e) => edit(l.index, e.target.value)} onFocus={() => locate(l.index)} />
                  {l.issues.map((issue) => <span key={issue} className="review-issue"><AlertTriangle size={13} aria-hidden="true" /> {issue.replace(/^⚠\s*/, '')}</span>)}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Dialog>,
    document.body,
  )
}
