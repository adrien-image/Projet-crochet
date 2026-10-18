import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Minus, RotateCcw, Undo2 } from 'lucide-react'
import type { Pattern, StitchType } from '../../domain/types'
import { STITCH_INFO } from '../../domain/parser'
import { roundsOf } from '../../domain/progress'
import { useWakeLock, wakeLockSupported } from '../../hooks/useWakeLock'
import { t, tn } from '../../i18n'
import { StitchGlyph } from '../shared/StitchGlyph'
import { ProgressBar } from '../../ui/Progress'
import { EmptyState } from '../../ui/EmptyState'
import { setRoundNote, setRoundsDone, setStitchCounter, type Update } from './actions'
import { RoundNoteEditor } from './RoundNoteEditor'

/** Mode « au crochet » : un rang à la fois, gros compteur tactile, écran maintenu allumé. */
export function CounterTab({ pattern, update }: { pattern: Pattern, update: Update }) {
  const rounds = roundsOf(pattern)
  const done = new Set(pattern.roundsDone)
  const firstTodo = rounds.findIndex((r) => !done.has(r.key))
  const [index, setIndex] = useState(firstTodo < 0 ? Math.max(rounds.length - 1, 0) : firstTodo)
  const [keepAwake, setKeepAwake] = useState(true)
  const awake = useWakeLock(keepAwake)
  const stitches = pattern.stitchCounter || 0
  const [bump, setBump] = useState(0)

  const i = Math.min(index, Math.max(rounds.length - 1, 0))
  const round = rounds[i]
  const isDone = round ? done.has(round.key) : false
  const doneCount = rounds.filter((r) => done.has(r.key)).length
  const target = round ? (round.expected ?? round.count) : 0

  const add = (n: number) => {
    update((p) => setStitchCounter(p, (p.stitchCounter || 0) + n))
    if (n > 0) {
      setBump((b) => b + 1)
      navigator.vibrate?.(8)
    }
  }
  const finishRound = () => {
    if (!round) return
    update((p) => setStitchCounter(setRoundsDone(p, [round.key], true), 0))
    if (i < rounds.length - 1) setIndex(i + 1)
  }
  const undoRound = () => {
    const prev = rounds.slice(0, i + 1).map((r) => r.key).filter((k) => done.has(k)).pop()
    if (!prev) return
    update((p) => setRoundsDone(p, [prev], false))
    setIndex(rounds.findIndex((r) => r.key === prev))
  }

  // raccourcis clavier : espace = +1 maille, Entrée = rang terminé, Retour arrière = −1
  const handlers = useRef({ add, finishRound })
  useEffect(() => { handlers.current = { add, finishRound } })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, button, [contenteditable], dialog')) return
      if (e.key === ' ') {
        e.preventDefault()
        handlers.current.add(1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handlers.current.finishRound()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        handlers.current.add(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!round) {
    return (
      <EmptyState icon="🔢" title={t('Aucun rang à compter')}>
        {t('Ajoutez le texte du patron (« R1 : 6 ms… ») avec « Modifier » pour utiliser le compteur.')}
      </EmptyState>
    )
  }

  const breakdown = Object.entries(round.stitches.reduce<Record<string, number>>((acc, s) => {
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})) as [StitchType, number][]
  const pct = Math.round((doneCount / rounds.length) * 100)
  const complete = target > 0 && stitches >= target
  const ringPct = target ? Math.min(1, stitches / target) : 0
  const R = 46
  const C = 2 * Math.PI * R

  return (
    <div className="counter">
      <div className="counter-progress">
        <div className="stat-row"><span>{t('{d} / {n} rangs terminés', { d: doneCount, n: rounds.length })}</span><strong>{pct} %</strong></div>
        <ProgressBar value={pct} tone="accent" label={t('Rangs terminés')} />
      </div>

      <section className={`counter-round panel ${isDone ? 'done' : ''}`}>
        <div className="counter-nav">
          <button type="button" className="icon-btn lg" disabled={i === 0} onClick={() => setIndex(i - 1)} aria-label={t('Rang précédent')}><ChevronLeft /></button>
          <div className="counter-title">
            {round.section && <span className="eyebrow">{round.section}</span>}
            <strong>{round.label}</strong>
            <span className="muted sm">{t('{i} sur {n}', { i: i + 1, n: rounds.length })}{isDone ? ` · ${t('terminé ✓')}` : ''}</span>
          </div>
          <button type="button" className="icon-btn lg" disabled={i === rounds.length - 1} onClick={() => setIndex(i + 1)} aria-label={t('Rang suivant')}><ChevronRight /></button>
        </div>
        <p className="counter-text">{round.text}</p>
        <div className="chips">
          {breakdown.map(([s, c]) => (
            <span key={s} className="chip"><StitchGlyph type={s} size={15} /> {c} × {t(STITCH_INFO[s]?.label ?? s)}</span>
          ))}
          {round.color && <span className="chip"><span className="dot" style={{ background: round.color }} aria-hidden="true" /> {t('Couleur du fil')}</span>}
          {round.loop && <span className="chip accent">{round.loop === 'blo' ? t('Brin arrière uniquement') : t('Brin avant uniquement')}</span>}
          {round.flat && <span className="chip">↔ {t('Rang aller-retour')}</span>}
        </div>
        <RoundNoteEditor key={round.key} label={round.label} note={pattern.roundNotes[round.key]}
          onChange={(note) => update((p) => setRoundNote(p, round.key, note))} />
      </section>

      <div className={`counter-stitches ${complete ? 'complete' : ''}`}>
        <button type="button" key={bump} className="counter-big" onClick={() => add(1)}
          aria-label={t('Ajouter une maille : {s} sur {n}', { s: stitches, n: target })}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r={R} className="ring-track" />
            <circle cx="50" cy="50" r={R} className="ring-value" strokeDasharray={C} strokeDashoffset={C * (1 - ringPct)} transform="rotate(-90 50 50)" />
          </svg>
          <span className="counter-value">{stitches}</span>
          <span className="counter-target">{tn(target, 'sur {n} maille', 'sur {n} mailles')}</span>
          <span className="counter-hint">{complete ? t('Rang complet !') : t('Touchez pour compter')}</span>
        </button>
        <div className="row-gap center">
          <button type="button" className="btn ghost" onClick={() => add(-1)} disabled={stitches === 0}><Minus size={16} /> 1</button>
          <button type="button" className="btn ghost" onClick={() => update((p) => setStitchCounter(p, 0))} disabled={stitches === 0}><RotateCcw size={16} /> {t('Remettre à 0')}</button>
        </div>
      </div>

      <div className="counter-actions">
        <button type="button" className="btn primary xl" onClick={finishRound} disabled={isDone && i === rounds.length - 1}>
          <Check size={20} /> {i < rounds.length - 1 ? t('Rang terminé — suivant') : t('Rang terminé')}
        </button>
        <button type="button" className="btn ghost" onClick={undoRound} disabled={doneCount === 0}>
          <Undo2 size={16} /> {t('Annuler le dernier rang')}
        </button>
      </div>

      <div className="counter-footer muted sm">
        {wakeLockSupported ? (
          <label className="switch">
            <input type="checkbox" checked={keepAwake} onChange={(e) => setKeepAwake(e.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            <span>{t('Garder l\'écran allumé')}{awake ? ` (${t('actif')})` : ''}</span>
          </label>
        ) : (
          <span>{t('Ce navigateur ne permet pas de garder l\'écran allumé.')}</span>
        )}
        <span className="hide-sm">{t('Clavier : Espace = +1 · Entrée = rang terminé · ⌫ = −1')}</span>
      </div>
    </div>
  )
}
