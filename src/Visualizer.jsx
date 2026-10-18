import { useMemo, useState } from 'react'
import { parsePattern, patternStats, STITCH_INFO } from './patternParser'
import { roundItemText } from './storage'
import { sectionColor } from './colors'
import RoundChart from './RoundChart'
import StitchGlyph from './StitchGlyph'

const isNarrow = () => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 800px)').matches

function groupBySection(rounds) {
  const groups = []
  rounds.forEach((r, i) => {
    const last = groups[groups.length - 1]
    if (last && last.section === r.section) last.items.push(i)
    else groups.push({ section: r.section, items: [i] })
  })
  return groups
}

export default function Visualizer({ pattern, onSetRounds }) {
  const [activeRound, setActiveRound] = useState(0)
  const rounds = useMemo(() => parsePattern(pattern.text), [pattern.text])
  const groups = useMemo(() => groupBySection(rounds), [rounds])

  if (rounds.length === 0) {
    return (
      <div className="empty">
        <div className="big">📊</div>
        Aucun rang détecté dans le texte du patron.<br />
        Écrivez un rang par ligne, par exemple « R1 : 6 ms dans un anneau magique (6) »,
        « R2 : aug dans chaque maille (12) » ou « Rnd 3: (sc, inc) x6 (18) ».
      </div>
    )
  }

  const doneIds = new Set(pattern.checklist.filter((i) => i.done).map((i) => i.id))
  const activeIdx = Math.min(activeRound, rounds.length - 1)
  const active = rounds[activeIdx]
  const isDone = (idx) => doneIds.has(rounds[idx].key)
  const doneCount = rounds.filter((r) => doneIds.has(r.key)).length
  const stats = patternStats(rounds)

  const setDone = (indices, done) =>
    onSetRounds(indices.map((i) => ({ id: rounds[i].key, text: roundItemText(rounds[i]) })), done)

  const breakdown = Object.entries(active.stitches.reduce((acc, s) => {
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {}))

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveRound(Math.min(activeIdx + 1, rounds.length - 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveRound(Math.max(activeIdx - 1, 0))
    }
  }

  return (
    <div className="viz">
      <div className="viz-list" onKeyDown={onKeyDown}>
        <p className="viz-summary">
          {stats.rounds} rangs · {stats.sections} pièce{stats.sections > 1 ? 's' : ''} ·{' '}
          <strong>{doneCount}/{rounds.length} faits</strong>
          {(stats.invalid > 0 || stats.misfit > 0) && (
            <span className="warn-msg"> · ⚠ {stats.invalid + stats.misfit} rang(s) à vérifier</span>
          )}
        </p>
        {groups.map((g, gi) => (
          <section key={gi} className="viz-group">
            {g.section && (
              <h5 className="viz-group-title" style={{ color: sectionColor(g.section) }}>{g.section}</h5>
            )}
            <div className="viz-grid">
              {g.items.map((i) => (
                <RoundChart key={rounds[i].key} round={rounds[i]} done={isDone(i)} active={i === activeIdx}
                  onClick={() => setActiveRound(i)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="viz-side">
        <div className={`round-detail ${isDone(activeIdx) ? 'done' : ''}`}>
          <div className="round-detail-head">
            <button type="button" className="btn small secondary" disabled={activeIdx === 0}
              onClick={() => setActiveRound(activeIdx - 1)} aria-label="Rang précédent">←</button>
            <div className="round-detail-title">
              <strong>{active.label}</strong>
              {active.section && <span className="round-section">{active.section}</span>}
            </div>
            <button type="button" className="btn small secondary" disabled={activeIdx === rounds.length - 1}
              onClick={() => setActiveRound(activeIdx + 1)} aria-label="Rang suivant">→</button>
          </div>

          <div className="stitch-list">
            {breakdown.length === 0 && <span className="placeholder">Aucune maille reconnue sur ce rang.</span>}
            {breakdown.map(([t, c]) => (
              <span key={t} className="stitch-chip">
                <StitchGlyph type={t} size={16} /> {c}× {STITCH_INFO[t]?.label ?? t}
              </span>
            ))}
          </div>

          <p className="count-line">Total : <strong>{active.count} mailles</strong></p>
          {active.expected != null && (
            <p className={active.valid ? 'ok-msg' : 'warn-msg'}>
              {active.valid
                ? `✓ Compte validé : ${active.count} = attendu (${active.expected})`
                : `⚠ Incohérence : ${active.count} mailles calculées, ${active.expected} attendues`}
            </p>
          )}
          {active.fits === false && (
            <p className="warn-msg">
              ⚠ Ce rang se travaille sur {active.consumed} mailles, mais le rang précédent en compte {active.prevCount}.
            </p>
          )}

          <label className="round-toggle">
            <input type="checkbox" checked={isDone(activeIdx)} onChange={() => setDone([activeIdx], !isDone(activeIdx))} />
            <span>Ce rang est terminé</span>
          </label>
          <div className="round-actions">
            <button type="button" className="btn small" onClick={() => {
              setDone(rounds.slice(0, activeIdx + 1).map((_, i) => i), true)
              if (activeIdx < rounds.length - 1) setActiveRound(activeIdx + 1)
            }}>
              ✓ Terminé jusqu'ici
            </button>
            {doneCount > 0 && (
              <button type="button" className="btn small secondary" onClick={() => {
                if (confirm('Décocher tous les rangs ?')) setDone(rounds.map((_, i) => i), false)
              }}>
                Tout décocher
              </button>
            )}
          </div>
        </div>

        <details className="legend" open={!isNarrow()}>
          <summary className="panel-title">Légende des symboles</summary>
          {Object.entries(STITCH_INFO).map(([t, info]) => (
            <div key={t} className="legend-row">
              <StitchGlyph type={t} size={18} />
              <span>{info.label}</span>
              <small>{info.abbr}</small>
            </div>
          ))}
        </details>
      </div>
    </div>
  )
}
