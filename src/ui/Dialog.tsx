import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { t } from '../i18n'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** formulaire : la boîte entière est un <form> */
  onSubmit?: () => void
}

/**
 * Boîte de dialogue native (<dialog> + showModal) : focus piégé, fond inerte et touche Échap
 * gérés par le navigateur. Plein écran sur mobile.
 */
export function Dialog({ open, title, onClose, children, footer, size = 'md', onSubmit }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      close.current()
    }
    d.addEventListener('cancel', onCancel)
    return () => d.removeEventListener('cancel', onCancel)
  }, [])

  const body = (
    <>
      <header className="dialog-head">
        <h2>{title}</h2>
        <button type="button" className="icon-btn ghost" onClick={onClose} aria-label={t('Fermer')}><X size={20} /></button>
      </header>
      <div className="dialog-body">{children}</div>
      {footer && <footer className="dialog-foot">{footer}</footer>}
    </>
  )

  return (
    <dialog ref={ref} className={`dialog dialog-${size}`} aria-label={title}
      onClick={(e) => { if (e.target === ref.current) onClose() }}>
      {open && (onSubmit
        ? <form className="dialog-inner" onSubmit={(e) => { e.preventDefault(); onSubmit() }}>{body}</form>
        : <div className="dialog-inner">{body}</div>)}
    </dialog>
  )
}
