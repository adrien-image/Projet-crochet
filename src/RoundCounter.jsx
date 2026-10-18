import { useEffect, useState } from 'react'
import { STITCH_INFO } from './patternParser'
import { roundsOf } from './progress'
import { useWakeLock, wakeLockSupported } from './hooks/useWakeLock'
import StitchGlyph from './StitchGlyph'

// Mode « au crochet » : un rang à la fois, gros boutons, écran maintenu allumé.
export default function RoundCounter({ pattern, onSetRounds, onStitchCounter }) {
  const rounds = roundsOf(pattern)
  const done = new Set(pattern.roundsDone)
  const firstTodo = rounds.findIndex((r) => !done.has(r.key))
  const [index, setIndex] = useState(firstTodo < 0 ? Math.max(rounds.length - 1, 0) : firstTodo)
  const [keepAwake, setKeepAwake] = useState(true)
  const awake = useWakeLock(keepAwake)
  const stitches = pattern.stitchCounter || 0

  const i = Math.min(index, Math.max(rounds.length - 1, 0))
  const round = rounds[i]
  const isDone = round ? done.has(round.key) : false
  const doneCount = rounds.filter((r) => done.has(r.key)).length
  const target = round ? (round.expected ?? round.count) : 0

  const finishRound = () => {
    if (!round) return
    onSetRounds([round.key], true)
    onStitchCounter(0)
    if (i < rounds.length - 1) setIndex(i + 1)
  }
  const undoRound = () => {
    const prev = rounds.slice(0, i + 1).map((r) => r.key).filter((k) => done.has(k)).pop()
    if (!prev) return
    onSetRounds([prev], false)
    setIndex(rounds.findIndex((r) => r.key === prev))
  }

  // raccourcis clavier : espace = +1 maille, Entrée = rang terminé, Retour arrière = −1
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, button, [contenteditable]')) return
      if (e.key === ' ') {
        e.preventDefault()
        onStitchCounter(stitches + 1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        finishRound()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        onStitchCounter(stitches - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!round) {
    return (
      <div className="empty">
        <div className="big">🔢</div>
        Aucun rang détecté : ajoutez le texte du patron (« R1 : 6 ms… ») pour utiliser le compteur.
      </div>
    )
  }

  const breakdown = Object.entries(round.stitches.reduce((acc, s) => {
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {}))
  const pct = Math.round((doneCount / rounds.length) * 100)
  const complete = target > 0 && stitches >= target

  return (
    <div className="counter">
      <div className="counter-progress">
        <span>{doneCount}/{rounds.length} rangs · {pct}%</span>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className={`counter-round ${isDone ? 'done' : ''}`}>
        <div className="counter-nav">
          <button type="button" className="btn secondary" disabled={i === 0} onClick={() => setIndex(i - 1)}
            aria-label="Rang précédent">←</button>
          <div className="counter-title">
            {round.section && <span className="round-section">{round.section}</span>}
            <strong>{round.label}</strong>
            <span className="counter-sub">{i + 1} / {rounds.length}{isDone ? ' · ✓ terminé' : ''}</span>
          </div>
          <button type="button" className="btn secondary" disabled={i === rounds.length - 1}
            onClick={() => setIndex(i + 1)} aria-label="Rang suivant">→</button>
        </div>
        <p className="counter-text">{round.text}</p>
        <div className="stitch-list">
          {breakdown.map(([t, c]) => (
            <span key={t} className="stitch-chip"><StitchGlyph type={t} size={16} /> {c}× {STITCH_INFO[t]?.label ?? t}</span>
          ))}
          {round.loop && <span className="stitch-chip">{round.loop === 'blo' ? 'Brin arrière uniquement' : 'Brin avant uniquement'}</span>}
          {round.flat && <span className="stitch-chip">↔ Rang aller-retour</span>}
        </div>
      </div>

      <div className={`counter-stitches ${complete ? 'complete' : ''}`}>
        <span className="counter-label">Mailles de ce rang</span>
        <button type="button" className="counter-big" onClick={() => onStitchCounter(stitches + 1)}
          aria-label={`Ajouter une maille, ${stitches} sur ${target}`}>
          <span className="counter-value">{stitches}</span>
          <span className="counter-target">/ {target}</span>
        </button>
        <div className="counter-small">
          <button type="button" className="btn secondary" onClick={() => onStitchCounter(stitches - 1)}
            disabled={stitches === 0}>− 1</button>
          <button type="button" className="btn secondary" onClick={() => onStitchCounter(0)} disabled={stitches === 0}>
            Remettre à 0
          </button>
        </div>
        {complete && <p className="ok-msg">✓ Toutes les mailles du rang sont faites</p>}
      </div>

      <div className="counter-actions">
        <button type="button" className="btn counter-done" onClick={finishRound} disabled={isDone && i === rounds.length - 1}>
          ✓ Rang terminé{i < rounds.length - 1 ? ' → suivant' : ''}
        </button>
        <button type="button" className="btn secondary" onClick={undoRound} disabled={doneCount === 0}>
          ↶ Annuler le dernier rang
        </button>
      </div>

      <div className="counter-footer">
        {wakeLockSupported ? (
          <label className="round-toggle">
            <input type="checkbox" checked={keepAwake} onChange={(e) => setKeepAwake(e.target.checked)} />
            <span>Garder l'écran allumé {awake ? '(actif)' : ''}</span>
          </label>
        ) : (
          <span className="placeholder">Votre navigateur ne permet pas de garder l'écran allumé.</span>
        )}
        <span className="placeholder">Clavier : Espace = +1 maille · Entrée = rang terminé · ⌫ = −1</span>
      </div>
    </div>
  )
}
