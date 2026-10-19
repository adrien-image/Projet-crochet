import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Pattern } from '../../domain/types'
import { roundsOf } from '../../domain/progress'
import { buildPieces } from '../../domain/pieces'
import { colorName } from '../../domain/colors'
import { ballsFor, estimateYarn, formatMeters, yarnMaterial, yarnWeight, YARN_MARGIN } from '../../domain/yarn'
import { estimateSize } from '../../domain/size'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { getLang, t } from '../../i18n'
import { RoundChart } from '../shared/RoundChart'
import { photosOf } from './actions'
import { textLines } from './textLines'
import { materialLabel } from './yarnLabels'

function SheetPhoto({ id, thumb, image }: { id: string | null, thumb: string | null, image?: string | null }) {
  const url = useAssetUrl(id)
  const src = url || image || thumb
  return src ? <img src={src} alt="" /> : null
}

/**
 * Fiche imprimable du patron (et « Enregistrer au format PDF » du navigateur) : photo, matériel, fils,
 * taille, instructions avec une case par rang, notes de rang et diagrammes. Affichée seulement à l'impression.
 */
export function PrintSheet({ pattern, onDone }: { pattern: Pattern, onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })
  const rounds = roundsOf(pattern)
  const lines = useMemo(() => textLines(pattern.text, rounds), [pattern.text, rounds])
  const pieces = useMemo(() => buildPieces(pattern), [pattern])
  const yarn = useMemo(() => estimateYarn(pattern), [pattern])
  const size = useMemo(() => estimateSize(pattern), [pattern])
  const finished = new Set(pattern.roundsDone)
  const lang = getLang()
  const weight = yarnWeight(yarn.hook)
  const material = yarnMaterial(`${pattern.yarn}\n${pattern.text}`)
  const photos = photosOf(pattern).slice(0, 4)

  useEffect(() => {
    document.body.classList.add('printing-sheet')
    let cancelled = false
    const after = () => {
      document.body.classList.remove('printing-sheet')
      done.current()
    }
    window.addEventListener('afterprint', after, { once: true })
    // les photos d'abord (sinon l'aperçu d'impression les montre vides)
    const imgs = [...(root.current?.querySelectorAll('img') ?? [])]
    Promise.race([
      Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r })))),
      new Promise((r) => setTimeout(r, 1500)),
    ]).then(() => { if (!cancelled) window.print() })
    return () => {
      cancelled = true
      window.removeEventListener('afterprint', after)
      document.body.classList.remove('printing-sheet')
    }
  }, [])

  return createPortal(
    <div ref={root} className="print-sheet" aria-hidden="true">
      <header className="ps-head">
        <div>
          <h1>{pattern.name}</h1>
          {pattern.description && <p>{pattern.description}</p>}
          <dl className="ps-facts">
            {pattern.hook && <><dt>{t('Crochet')}</dt><dd>{pattern.hook}</dd></>}
            {pattern.yarn && <><dt>{t('Fil')}</dt><dd>{pattern.yarn}</dd></>}
            {size && <><dt>{t('Taille')}</dt><dd>≈ {size.dims.map((d) => d.toLocaleString(lang)).join(' × ')} cm</dd></>}
            <dt>{t('Rangs')}</dt><dd>{rounds.length}</dd>
          </dl>
        </div>
        {photos.length > 0 && (
          <div className="ps-photos">
            {photos.map((ph, i) => <SheetPhoto key={i} id={ph.id} thumb={ph.thumb} image={ph.image ?? ph.data} />)}
          </div>
        )}
      </header>

      {yarn.meters > 0 && (
        <section className="ps-block">
          <h2>{t('Fils à prévoir')}</h2>
          <p className="ps-muted">{t('Épaisseur {c}', { c: weight.category })} · {weight.names}{material ? ` · ${materialLabel(material)}` : ''} · ≈ {formatMeters(yarn.meters, lang)} ± {Math.round(YARN_MARGIN * 100)} %</p>
          <table className="ps-table">
            <tbody>
              {yarn.byColor.map((c) => {
                const known = colorName(c.color)
                return (
                  <tr key={c.color}>
                    <td><span className="ps-dot" style={{ background: c.color }} /></td>
                    <td><strong>{c.name ?? (known ? t(known) : t('Fil'))}</strong></td>
                    <td>{c.pieces.join(', ')}</td>
                    <td className="ps-num">{formatMeters(c.meters * (1 + YARN_MARGIN), lang)}</td>
                    <td className="ps-num">≈ {ballsFor(c.meters, weight, material).grams} g</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {pattern.checklist.length > 0 && (
        <section className="ps-block">
          <h2>{t('Étapes')}</h2>
          <ul className="ps-checks">
            {pattern.checklist.map((c) => <li key={c.id}><span className="ps-box">{c.done ? '✓' : ''}</span>{c.text}</li>)}
          </ul>
        </section>
      )}

      <section className="ps-block">
        <h2>{t('Instructions')}</h2>
        <div className="ps-text">
          {lines.map((l, i) => {
            if (!l.line.trim()) return <div key={i} className="ps-gap" />
            if (l.title) return <h3 key={i}>{l.title}</h3>
            if (!l.rounds) return <p key={i}>{l.line}</p>
            const all = l.rounds.every((r) => finished.has(r.key))
            const notes = l.rounds.map((r) => pattern.roundNotes[r.key]?.text).filter(Boolean)
            return (
              <div key={i} className="ps-round">
                <span className="ps-box">{all ? '✓' : ''}</span>
                <span>{l.line.trim()}{notes.length > 0 && <em className="ps-note"> — {notes.join(' · ')}</em>}</span>
              </div>
            )
          })}
        </div>
      </section>

      {pieces.length > 0 && (
        <section className="ps-block ps-charts">
          <h2>{t('Diagrammes')}</h2>
          {pieces.map((p) => (
            <div key={p.index} className="ps-piece">
              <h3>{p.label}{p.copies > 1 ? ` × ${p.copies}` : ''}</h3>
              <div className="ps-chart-grid">
                {p.rounds.map((r) => <RoundChart key={r.key} round={r} done={finished.has(r.key)} active={false} onClick={() => {}} />)}
              </div>
            </div>
          ))}
        </section>
      )}
      <footer className="ps-foot">{t('Imprimé depuis Mon Crochet')}</footer>
    </div>,
    document.body,
  )
}
