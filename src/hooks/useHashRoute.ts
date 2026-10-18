import { useCallback, useEffect, useState } from 'react'

export type PatternTab = 'patron' | 'compteur' | 'rangs' | '3d'
export const TABS: PatternTab[] = ['patron', 'compteur', 'rangs', '3d']

export interface Route {
  patternId: string | null
  tab: PatternTab
}

// #/patron/<id>[/<onglet>] : bouton « retour », rechargement et liens directs fonctionnent.
function parse(): Route {
  const m = window.location.hash.match(/^#\/patron\/([^/]+)(?:\/([a-z0-9]+))?/)
  const tab = (m?.[2] ?? 'patron') as PatternTab
  return { patternId: m ? decodeURIComponent(m[1]) : null, tab: TABS.includes(tab) ? tab : 'patron' }
}

export function routeHash(r: Route): string {
  if (!r.patternId) return ''
  return `#/patron/${encodeURIComponent(r.patternId)}${r.tab === 'patron' ? '' : `/${r.tab}`}`
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(parse)

  useEffect(() => {
    const onChange = () => setRoute(parse())
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [])

  /** `replace` : change d'onglet sans empiler une entrée d'historique */
  const navigate = useCallback((next: Route, opts: { replace?: boolean } = {}) => {
    const hash = routeHash(next)
    const url = window.location.pathname + window.location.search + hash
    if (opts.replace) window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)
    setRoute(next)
    if (!opts.replace) window.scrollTo?.(0, 0)
  }, [])

  return [route, navigate] as const
}
