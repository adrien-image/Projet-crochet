// Couleur stable par section, partagée entre le visualiseur et l'aperçu 3D.
const PALETTE = ['#c2703d', '#5f8a4f', '#4f76a3', '#a3507a', '#8f7a3c', '#6b5fa8']

export function sectionColor(section) {
  let h = 0
  for (const c of section || '') h = (h * 31 + c.charCodeAt(0)) % 997
  return PALETTE[h % PALETTE.length]
}
