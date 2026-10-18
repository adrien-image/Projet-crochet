import { useEffect, useState } from 'react'
import { getAssetUrl } from '../assets'

/** URL affichable d'un fichier stocké dans IndexedDB (null pendant le chargement). */
export function useAssetUrl(id) {
  const [state, setState] = useState({ id: null, url: null })
  useEffect(() => {
    if (!id) return
    let alive = true
    getAssetUrl(id).then((url) => { if (alive) setState({ id, url }) })
    return () => { alive = false }
  }, [id])
  return id && state.id === id ? state.url : null
}
