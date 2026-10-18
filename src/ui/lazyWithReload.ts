import { lazy, type ComponentType } from 'react'

const FLAG = 'crochet.chunkReload'

/**
 * Comme `lazy`, mais si le fichier n'existe plus (page ouverte avant une mise à jour de l'application),
 * la page est rechargée une fois pour obtenir la nouvelle version — `lazy` garderait l'échec en mémoire.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() => load().then((m) => {
    try { sessionStorage.removeItem(FLAG) } catch { /* stockage indisponible */ }
    return m
  }, (error) => {
    let reloaded = true
    try {
      reloaded = !!sessionStorage.getItem(FLAG)
      if (!reloaded) sessionStorage.setItem(FLAG, '1')
    } catch { /* stockage indisponible : pas de rechargement en boucle */ }
    if (reloaded || !navigator.onLine) throw error
    window.location.reload()
    return new Promise<never>(() => {})
  }))
}
