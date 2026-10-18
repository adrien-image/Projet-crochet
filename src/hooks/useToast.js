import { useCallback, useEffect, useState } from 'react'

/** Message temporaire, avec action optionnelle (« Annuler »). */
export function useToast() {
  const [toast, setToast] = useState(null) // { text, error, action: { label, run } }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.error || toast.action ? 6000 : 2200)
    return () => clearTimeout(t)
  }, [toast])

  const show = useCallback((text, opts = {}) => setToast({ text, ...opts, at: Date.now() }), [])
  const hide = useCallback(() => setToast(null), [])
  return { toast, show, hide }
}
