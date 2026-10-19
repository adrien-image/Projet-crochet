import { useEffect, useMemo, useRef } from 'react'
import type { Round } from '../../domain/types'
import { drawFabric, hitRow, layoutFabric } from '../../render2d/fabric'
import { useElementWidth } from '../../hooks/useElementSize'

interface Props {
  rounds: Round[]
  color: string
  done: Set<string>
  activeKey: string | null
  showProgress: boolean
  flat?: boolean
  onSelect?: (key: string) => void
  label: string
}

const cssVar = (name: string, fallback: string) =>
  (typeof window !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback

/** Pièce dessinée comme du vrai tissu ; un clic sur une rangée sélectionne le rang. */
export function FabricCanvas({ rounds, color, done, activeKey, showProgress, flat, onSelect, label }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const width = useElementWidth(wrap)
  const layout = useMemo(
    () => (width ? layoutFabric(rounds, width, { align: flat ? 'left' : 'center', margin: width < 420 ? 30 : 40 }) : null),
    [rounds, width, flat],
  )

  useEffect(() => {
    const c = canvas.current
    if (!c || !layout) return
    // les navigateurs refusent les canvas trop grands (32 767 px de côté, ~16 Mpx sur iOS) : une longue
    // pièce plate (écharpe de 500 rangs) est dessinée moins finement plutôt que pas du tout
    const dpr = Math.max(0.25, Math.min(window.devicePixelRatio || 1, 2, 16000 / layout.height, 16000 / layout.width, Math.sqrt(16e6 / (layout.width * layout.height))))
    c.width = Math.round(layout.width * dpr)
    c.height = Math.round(layout.height * dpr)
    c.style.width = `${layout.width}px`
    c.style.height = `${layout.height}px`
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, layout.width, layout.height)
    drawFabric(ctx, layout, {
      color, done, showProgress, activeKey, labels: true,
      ink: cssVar('--ink-3', '#7d6f61'), accent: cssVar('--accent', '#c2683c'),
    })
  }, [layout, color, done, activeKey, showProgress])

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!layout || !onSelect) return
    const rect = e.currentTarget.getBoundingClientRect()
    const row = hitRow(layout, e.clientX - rect.left, e.clientY - rect.top)
    if (row) onSelect(row.round.key)
  }

  return (
    <div ref={wrap} className="fabric-wrap">
      <canvas ref={canvas} className="fabric-canvas" role="img" aria-label={label} onClick={onClick} />
    </div>
  )
}
