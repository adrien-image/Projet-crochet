import { useEffect, useState } from 'react'

/** Re-rendu toutes les `ms` millisecondes tant que `active` est vrai (chronomètre). */
export function useTicker(active: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [active, ms])
  return now
}
