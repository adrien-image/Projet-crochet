import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Garde le focus clavier dans une fenêtre modale et le rend à l'élément d'origine à la fermeture. */
export function useFocusTrap(ref, onEscape) {
  const escape = useRef(onEscape)
  useEffect(() => { escape.current = onEscape }, [onEscape])

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const previous = document.activeElement
    if (!root.contains(document.activeElement)) root.querySelector(FOCUSABLE)?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        escape.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    root.addEventListener('keydown', onKey)
    return () => {
      root.removeEventListener('keydown', onKey)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [ref])
}
