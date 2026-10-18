// Traductions : le texte français sert de clé, le dictionnaire anglais le traduit.
// Un test vérifie que chaque chaîne passée à t() existe en anglais.
import en from './en'

export type Lang = 'fr' | 'en'

let current: Lang = 'fr'

export const getLang = (): Lang => current
export const setLang = (l: Lang) => {
  current = l
  if (typeof document !== 'undefined') document.documentElement.lang = l
}
export const locale = () => (current === 'en' ? 'en-GB' : 'fr-FR')

export function detectLang(): Lang {
  const langs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []
  return langs.some((l) => l?.toLowerCase().startsWith('fr')) || !langs.length ? 'fr' : 'en'
}

/** Traduit une chaîne ; `{nom}` est remplacé par vars.nom. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const s = current === 'en' ? (en[key] ?? key) : key
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : s
}

/** Singulier / pluriel : tn(n, '{n} rang', '{n} rangs'). */
export function tn(n: number, one: string, many: string, vars: Record<string, string | number> = {}): string {
  return t(n > 1 ? many : one, { n, ...vars })
}
