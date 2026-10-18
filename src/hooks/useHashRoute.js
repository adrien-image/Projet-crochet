import { useCallback, useEffect, useState } from 'react'

// Le patron ouvert est reflété dans l'URL (#/patron/<id>) : bouton « retour » et rechargement fonctionnent.
const idFromHash = () => decodeURIComponent(window.location.hash.match(/^#\/patron\/(.+)$/)?.[1] ?? '') || null

export function useHashRoute() {
  const [openId, setOpenId] = useState(idFromHash)

  useEffect(() => {
    const onHash = () => setOpenId(idFromHash())
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [])

  const navigate = useCallback((id) => {
    if (id) window.location.hash = `#/patron/${encodeURIComponent(id)}`
    else if (window.location.hash) window.history.pushState(null, '', window.location.pathname + window.location.search)
    setOpenId(id)
    window.scrollTo?.(0, 0)
  }, [])

  return [openId, navigate]
}
