import { test, expect } from 'vitest'
import { drawFabric, hitRow, layoutFabric } from '../src/render2d/fabric'
import { chartsToSvg } from '../src/render2d/chartExport'
import { chartLayout } from '../src/render2d/glyphs'
import { parsePattern } from '../src/domain/parser'
import { samplePattern } from '../src/storage/samples'

function stubContext() {
  const calls = { stroke: 0, fill: 0 }
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k: string) => (k in t ? t[k] : k === 'stroke' ? () => { calls.stroke++ } : k === 'fill' ? () => { calls.fill++ } : () => {}),
    set: (t, k: string, v) => { t[k] = v; return true },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

test('tissu : un rang par rangée, du premier en bas au dernier en haut, largeur ∝ mailles', () => {
  const rounds = parsePattern('R1: 6 sc\nR2: inc around (12)\nR3: 12 sc')
  const l = layoutFabric(rounds, 600)
  expect(l.rows.map((r) => r.round.label)).toEqual(['R1', 'R2', 'R3'])
  expect(l.rows[0].y).toBeGreaterThan(l.rows[2].y)
  expect(l.rows[1].w).toBeCloseTo(l.rows[0].w * 2)
  // centré
  expect(l.rows[0].x + l.rows[0].w / 2).toBeCloseTo(l.rows[1].x + l.rows[1].w / 2)
  const hit = hitRow(l, l.rows[1].x + 5, l.rows[1].y + l.rows[1].h / 2)
  expect(hit?.round.label).toBe('R2')
})

test('tissu : chaque maille est dessinée avec plusieurs brins', () => {
  const rounds = parsePattern(samplePattern().text)
  const l = layoutFabric(rounds.slice(0, 5), 800)
  const { ctx, calls } = stubContext()
  drawFabric(ctx, l, { color: '#9b9a9c', labels: true, activeKey: rounds[2].key })
  const stitches = rounds.slice(0, 5).reduce((n, r) => n + r.stitches.length, 0)
  expect(calls.stroke).toBeGreaterThan(stitches * 4)
})

test('diagramme : rangs en rond lus dans le sens inverse des aiguilles d\'une montre', () => {
  const [r] = parsePattern('R1: 6 sc')
  const l = chartLayout(r)
  // la 2e maille est à gauche de la 1re (angle négatif)
  expect(l.nodes[1].x).toBeLessThan(l.nodes[0].x)
  expect(l.nodes[1].rot).toBeLessThan(0)
})

test('export SVG autonome et échappé', () => {
  const svg = chartsToSvg('Test <script>', parsePattern('R1: 6 sc\nR2: inc around'))
  expect(svg.startsWith('<svg')).toBe(true)
  expect(svg).not.toContain('<script>')
  expect(svg).toContain('&lt;script&gt;')
})
