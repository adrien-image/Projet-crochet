import { useEffect, useState } from 'react'

export const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

/** Empêche l'écran de se mettre en veille tant que `enabled` est vrai (API Screen Wake Lock). */
export function useWakeLock(enabled) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (!enabled || !wakeLockSupported) return
    let sentinel = null
    let cancelled = false
    const request = async () => {
      if (document.visibilityState !== 'visible' || cancelled) return
      try {
        sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          sentinel.release()
          return
        }
        setActive(true)
        sentinel.addEventListener('release', () => setActive(false))
      } catch {
        setActive(false)
      }
    }
    // le verrou est perdu quand l'onglet passe en arrière-plan : on le redemande au retour
    const onVisible = () => { if (document.visibilityState === 'visible') request() }
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      sentinel?.release().catch(() => {})
    }
  }, [enabled])
  return enabled && active
}
