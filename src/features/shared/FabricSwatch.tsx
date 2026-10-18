import { useEffect, useRef } from 'react'
import type { Pattern } from '../../domain/types'
import { buildPieces } from '../../domain/pieces'
import { drawFabric, layoutFabric } from '../../render2d/fabric'
import { shade } from '../../domain/colors'

/** Couverture générée quand un patron n'a pas de photo : un morceau de son tissu, à sa couleur. */
export function FabricSwatch({ pattern }: { pattern: Pattern }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const W = 320
    const H = 200
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = W * dpr
    c.height = H * dpr
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const pieces = buildPieces(pattern)
    const piece = pieces.reduce<typeof pieces[number] | null>((a, b) => (!a || b.rounds.length > a.rounds.length ? b : a), null)
    const color = piece?.color ?? '#e9dcc6'
    ctx.fillStyle = shade(color, 0.92)
    ctx.fillRect(0, 0, W, H)
    if (!piece) return
    // rangs les plus larges de la pièce, répétés pour remplir toute la vignette
    const widest = Math.max(...piece.rounds.map((r) => r.count))
    const wide = piece.rounds.filter((r) => r.count >= widest * 0.7)
    const base = (wide.length ? wide : piece.rounds).map((r) => ({ ...r, stitches: r.stitches.slice(0, 24), count: Math.min(r.count, 24) }))
    const sample = Array.from({ length: 14 }, (_, i) => base[i % base.length])
    const layout = layoutFabric(sample, W + 60, { maxUnit: 24, margin: 0, align: 'left' })
    ctx.save()
    ctx.translate(-18, (H - layout.height) / 2)
    drawFabric(ctx, layout, { color })
    ctx.restore()
  }, [pattern])
  return <canvas ref={ref} className="swatch" aria-hidden="true" />
}
