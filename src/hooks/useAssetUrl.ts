import { useEffect, useState } from 'react'
import { getAssetUrl } from '../storage/assets'

/** URL affichable d'un fichier stocké dans IndexedDB (null pendant le chargement). */
export function useAssetUrl(id: string | null | undefined): string | null {
  const [state, setState] = useState<{ id: string | null, url: string | null }>({ id: null, url: null })
  useEffect(() => {
    if (!id) return
    let alive = true
    getAssetUrl(id).then((url) => { if (alive) setState({ id, url }) })
    return () => { alive = false }
  }, [id])
  return id && state.id === id ? state.url : null
}
