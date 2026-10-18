import { useCallback, useEffect, useState } from 'react'

export interface Toast {
  text: string
  error?: boolean
  action?: { label: string, run: () => void }
  at: number
}

/** Message temporaire, avec action optionnelle (« Annuler »). */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.error || toast.action ? 6000 : 2400)
    return () => clearTimeout(t)
  }, [toast])

  const show = useCallback((text: string, opts: Omit<Toast, 'text' | 'at'> = {}) => setToast({ text, ...opts, at: Date.now() }), [])
  const hide = useCallback(() => setToast(null), [])
  return { toast, show, hide }
}
