import { useMemo, useState } from 'react'
import { parsePattern, stitchCount, STITCH_INFO } from './patternParser'
import RoundChart from './RoundChart'

export default function Visualizer({ pattern, checklist, onToggle }) {
  const [activeRound, setActiveRound] = useState(0)
  const rounds = useMemo(() => parsePattern(pattern.text), [pattern.text])

  if (rounds.length === 0) {
    return (
      <div className="empty">
        <div className="big">📊</div>
        Aucun rang détecté dans le texte du patron.<br />
        Écrivez les rangs au format « R1 : 6 ms » (un par ligne) pour activer le visualiseur.
      </div>
    )
  }

  const doneSet = new Set(checklist.filter((i) => i.done).map((i) => i.id))
  const active = rounds[Math.min(activeRound, rounds.length - 1)]

  const roundDone = (idx) => {
    const it = checklist.find((i) => i.id === `round-${idx}`)
    return it ? it.done : false
  }

  const toggleRound = (idx) => {
    const id = `round-${idx}`
    const existing = checklist.find((i) => i.id === id)
    if (existing) {
      onToggle(existing)
    } else {
      onToggle({ id, text: `Rang ${rounds[idx].label} (${rounds[idx].section || 'patron'})`, done: true })
    }
  }

  return (
    <div className="viz">
      <div className="viz-list">
        {rounds.map((r, i) => (
          <RoundChart key={i} round={r} index={i} totalRounds={rounds.length}
            done={roundDone(i)} active={i === activeRound}
            onClick={() => { setActiveRound(i); }} />
        ))}
      </div>

      <div className="viz-side">
        <h4 className="panel-title">Détail du rang</h4>
        <div className={`round-card large ${roundDone(activeRound) ? 'done' : ''}`}>
          <strong>{active.label}</strong>
          {active.section && <span className="round-section" style={{ marginLeft: 8 }}>{active.section}</span>}
          <p className="stitch-list">
            {Object.entries(active.stitches.reduce((acc, s) => {
              acc[s] = (acc[s] || 0) + 1
              return acc
            }, {})).map(([t, c]) => (
              <span key={t} className="stitch-chip">
                <b>{STITCH_INFO[t]?.symbol}</b> {c}× {STITCH_INFO[t]?.label ?? t}
              </span>
            ))}
          </p>
          {active.expected != null && (
            <p className={active.valid ? 'ok-msg' : 'warn-msg'}>
              {active.valid
                ? `✓ Compte validé : ${stitchCount(active.stitches)} mailles = attendu (${active.expected})`
                : `⚠ Incohérence : ${stitchCount(active.stitches)} mailles détectées, ${active.expected} attendues`}
            </p>
          )}
          <label className="round-toggle">
            <input type="checkbox" checked={roundDone(activeRound)}
              onChange={() => toggleRound(activeRound)} />
            <span>Ce rang est terminé</span>
          </label>
        </div>

        <div className="legend">
          <h4 className="panel-title">Légende des symboles</h4>
          {Object.entries(STITCH_INFO).map(([t, info]) => (
            <div key={t} className="legend-row">
              <b>{info.symbol}</b> {info.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
