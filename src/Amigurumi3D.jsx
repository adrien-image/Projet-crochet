import { useEffect, useMemo, useRef, useState } from 'react'
import { roundsOf } from './progress'
import { buildScene, renderScene } from './engine3d'

const INITIAL_VIEW = { yaw: 0.5, pitch: -0.35, zoom: 1 }

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function Amigurumi3D({ pattern }) {
  const canvasRef = useRef(null)
  const view = useRef({ ...INITIAL_VIEW })
  const drag = useRef(null)
  const [auto, setAuto] = useState(() => !prefersReducedMotion())
  const autoRef = useRef(auto)
  useEffect(() => { autoRef.current = auto }, [auto])

  const rounds = roundsOf(pattern)
  const scene = useMemo(() => buildScene(rounds), [rounds])
  const legend = useMemo(() => {
    if (!scene) return []
    const seen = new Map()
    for (const m of scene.meshes) {
      const key = m.label
      seen.set(key, { color: m.color, count: (seen.get(key)?.count ?? 0) + 1 })
    }
    return [...seen.entries()]
  }, [scene])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!scene || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf
    let last = performance.now()

    const draw = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      if (autoRef.current && !drag.current) view.current.yaw += dt * 0.4
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      renderScene(ctx, scene, w, h, view.current)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    const down = (e) => {
      drag.current = { x: e.clientX, y: e.clientY }
      canvas.setPointerCapture?.(e.pointerId)
    }
    const move = (e) => {
      if (!drag.current) return
      const v = view.current
      v.yaw += (e.clientX - drag.current.x) * 0.01
      v.pitch = Math.max(-1.4, Math.min(1.4, v.pitch - (e.clientY - drag.current.y) * 0.01))
      drag.current = { x: e.clientX, y: e.clientY }
    }
    const up = () => { drag.current = null }
    const wheel = (e) => {
      e.preventDefault()
      const v = view.current
      v.zoom = Math.max(0.4, Math.min(4, v.zoom * Math.exp(-e.deltaY * 0.0015)))
    }

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('wheel', wheel)
    }
  }, [scene])

  if (!scene) {
    return (
      <div className="empty">
        <div className="big">🧶</div>
        Aucun rang détecté — l'aperçu 3D nécessite un patron au format « R1 : 6 ms ».
      </div>
    )
  }

  const zoomBy = (f) => {
    const v = view.current
    v.zoom = Math.max(0.4, Math.min(4, v.zoom * f))
  }

  return (
    <div className="viz-3d">
      <div className="canvas-wrap">
        <canvas ref={canvasRef} className="canvas-3d" role="img"
          aria-label={`Aperçu 3D : ${legend.map(([name]) => name).join(', ')}`} />
        <div className="canvas-controls">
          <button type="button" className="icon-btn" onClick={() => setAuto((a) => !a)}
            title={auto ? 'Arrêter la rotation' : 'Rotation automatique'}>{auto ? '⏸' : '▶'}</button>
          <button type="button" className="icon-btn" onClick={() => zoomBy(1.2)} title="Zoomer">＋</button>
          <button type="button" className="icon-btn" onClick={() => zoomBy(1 / 1.2)} title="Dézoomer">－</button>
          <button type="button" className="icon-btn" onClick={() => { view.current = { ...INITIAL_VIEW } }}
            title="Réinitialiser la vue">⟲</button>
        </div>
      </div>
      <div className="pieces-legend">
        {legend.map(([name, { color, count }]) => (
          <span key={name} className="piece-chip">
            <i style={{ background: color }} /> {name}{count > 1 ? ` ×${count}` : ''}
          </span>
        ))}
      </div>
      <p className="hint-3d">Glissez pour tourner · molette pour zoomer · chaque pièce est reconstruite à partir des comptes de mailles (rayon ∝ nombre de mailles)</p>
    </div>
  )
}
