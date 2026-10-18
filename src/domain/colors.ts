// Couleurs : palette du diagramme (par section) et couleurs de fil réalistes (rendu tissu / 3D).

const PALETTE = ['#c2703d', '#5f8a4f', '#4f76a3', '#a3507a', '#8f7a3c', '#6b5fa8']

/** Couleur stable par section, pour le diagramme à symboles. */
export function sectionColor(section: string | null | undefined): string {
  let h = 0
  for (const c of section || '') h = (h * 31 + c.charCodeAt(0)) % 997
  return PALETTE[h % PALETTE.length]
}

/** Couleurs de fil courantes (FR / EN). L'ordre compte : les expressions composées d'abord. */
const YARN_COLORS: [RegExp, string][] = [
  [/\bbleu\s+(?:clair|ciel|pastel)|\blight\s+blue|\bsky\s+blue/i, '#9cc3e6'],
  [/\bbleu\s+(?:marine|fonc[ée])|\bnavy/i, '#2c3e66'],
  [/\bvert\s+(?:clair|pastel|menthe)|\bmint|\blight\s+green/i, '#a8d5b0'],
  [/\bvert\s+(?:fonc[ée]|sapin)|\bdark\s+green/i, '#2f5d3a'],
  [/\brose\s+(?:p[âa]le|clair|poudr[ée])|\blight\s+pink|\bpale\s+pink/i, '#f2c4cf'],
  [/\bgris\s+(?:clair|perle)|\blight\s+gr[ae]y/i, '#c9c8c6'],
  [/\bgris\s+(?:fonc[ée]|anthracite)|\bdark\s+gr[ae]y|\bcharcoal/i, '#55565a'],
  [/\b(?:gris|grise|grey|gray)\b/i, '#9b9a9c'],
  [/\b(?:rose|pink)\b/i, '#e99aae'],
  [/\b(?:rouge|red|bordeaux)\b/i, '#c3323c'],
  [/\b(?:blanc|blanche|white)\b/i, '#f4f1ea'],
  [/\b(?:[ée]cru|ivoire|cr[eè]me|cream|off-?white)\b/i, '#efe6d2'],
  [/\b(?:noir|noire|black)\b/i, '#2a2a2d'],
  [/\b(?:bleu|bleue|blue)\b/i, '#4a72b0'],
  [/\b(?:turquoise|teal)\b/i, '#3aa7a3'],
  [/\b(?:vert|verte|green)\b/i, '#5e9a58'],
  [/\b(?:jaune|yellow|moutarde|mustard)\b/i, '#e8c34a'],
  [/\b(?:orange|corail|coral)\b/i, '#e8854a'],
  [/\b(?:marron|brun|brune|brown|chocolat|caramel)\b/i, '#8a5a3c'],
  [/\b(?:beige|sable|tan|camel)\b/i, '#d9c3a0'],
  [/\b(?:violet|violette|purple|mauve|lilas|lilac|lavande|lavender)\b/i, '#8c6bb5'],
]

export const DEFAULT_YARN = '#e9dcc6'

/** Première couleur de fil mentionnée dans un texte, ou null. */
export function findYarnColor(text: string | null | undefined): string | null {
  if (!text) return null
  let best: { index: number, color: string } | null = null
  for (const [re, color] of YARN_COLORS) {
    const m = re.exec(text)
    if (m && (!best || m.index < best.index)) best = { index: m.index, color }
  }
  return best?.color ?? null
}

/** Assombrit ou éclaircit une couleur #rrggbb (f < 1 assombrit). */
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const out = f < 1 ? v * f : v + (255 - v) * (f - 1)
    return Math.max(0, Math.min(255, Math.round(out)))
  })
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Luminance relative (0 sombre → 1 clair). */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
