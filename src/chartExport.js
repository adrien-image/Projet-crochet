// @ts-check
// Export des graphiques de rangs en un seul fichier SVG autonome (couleurs résolues, sans CSS).
import { glyphPaths, chartLayout, directionArrow, CHART_SIZE, RING_R } from './glyphs.js'
import { sectionColor } from './colors.js'
import { STITCH_INFO } from './patternParser.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

/** @param {string} type @param {number} s @param {string} color @param {number} sw */
function glyphSvg(type, s, color, sw) {
  return glyphPaths(type, s).map((p) => (p.circle
    ? `<circle r="${p.r}" fill="${color}"/>`
    : p.ellipse
      ? `<ellipse rx="${p.rx}" ry="${p.ry}" fill="none" stroke="${color}" stroke-width="${sw * 0.8}"/>`
      : `<path d="${p.d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`)).join('')
}

/**
 * @param {string} title
 * @param {import('./patternParser.js').Round[]} rounds
 * @param {Set<string>} [done]
 */
export function chartsToSvg(title, rounds, done = new Set()) {
  const cols = 6
  const cell = CHART_SIZE + 24
  const head = 50
  const rows = Math.ceil(rounds.length / cols)
  const legendTop = head + rows * cell + 10
  const used = [...new Set(rounds.flatMap((r) => r.stitches))]
  const width = cols * cell + 20
  const height = legendTop + 30 + Math.ceil(used.length / 3) * 24
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Segoe UI, system-ui, sans-serif">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<text x="20" y="32" font-size="20" font-weight="700" fill="#3e3529">${esc(title)}</text>`,
  ]
  rounds.forEach((r, i) => {
    const x = 10 + (i % cols) * cell
    const y = head + Math.floor(i / cols) * cell
    const layout = chartLayout(r)
    const color = sectionColor(r.section)
    const c = CHART_SIZE / 2
    const sw = layout.s < 3 ? 1.1 : 1.5
    out.push(`<g transform="translate(${x + 12} ${y})">`)
    out.push(layout.flat
      ? `<line x1="8" x2="${CHART_SIZE - 8}" y1="${c + 11}" y2="${c + 11}" stroke="#e8dfd2" stroke-width="1.5" stroke-dasharray="3 3"/>`
      : `<circle cx="${c}" cy="${c}" r="${RING_R}" fill="none" stroke="#e8dfd2" stroke-width="1.5" stroke-dasharray="3 3"/>`)
    out.push(`<path d="${directionArrow(layout)}" fill="none" stroke="#b9ad9c" stroke-width="1.2" stroke-linecap="round"/>`)
    for (const nd of layout.nodes) {
      out.push(`<g transform="translate(${nd.x.toFixed(2)} ${nd.y.toFixed(2)}) rotate(${nd.rot.toFixed(1)})">${glyphSvg(nd.type, layout.s, color, sw)}</g>`)
    }
    const label = `${r.label}${done.has(r.key) ? ' ✓' : ''}`
    out.push(`<text x="${c}" y="${layout.flat ? c - 16 : c + 4}" text-anchor="middle" font-size="12" font-weight="600" fill="#3e3529">${esc(label)}</text>`)
    out.push(`<text x="${c}" y="${CHART_SIZE + 12}" text-anchor="middle" font-size="10" fill="#8a7d6b">${esc(`${r.count} m.${r.section ? ` · ${r.section.slice(0, 22)}` : ''}`)}</text>`)
    out.push('</g>')
  })
  used.forEach((t, i) => {
    const x = 20 + (i % 3) * 240
    const y = legendTop + 20 + Math.floor(i / 3) * 24
    out.push(`<g transform="translate(${x + 8} ${y - 4})">${glyphSvg(t, 6, '#c2703d', 1.8)}</g>`)
    out.push(`<text x="${x + 24}" y="${y}" font-size="12" fill="#3e3529">${esc(STITCH_INFO[t]?.label ?? t)}</text>`)
  })
  out.push('</svg>')
  return out.join('\n')
}

/** Déclenche le téléchargement d'un texte. @param {string} content @param {string} name @param {string} type */
export function downloadText(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
