import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

/** Menu déroulant accessible (bouton + liste), fermé par Échap ou clic extérieur. */
export function Menu({ label, icon, items, align = 'end' }: { label: string, icon: ReactNode, items: MenuItem[], align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    root.current?.querySelector<HTMLButtonElement>('[role=menuitem]:not(:disabled)')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const btns = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)') ?? [])]
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    btns[(i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length]?.focus()
  }

  return (
    <div className="menu" ref={root}>
      <button type="button" className="icon-btn" aria-label={label} title={label} aria-haspopup="menu"
        aria-expanded={open} aria-controls={id} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
        {icon}
      </button>
      {open && (
        <div className={`menu-list ${align}`} role="menu" id={id} onKeyDown={onListKey} onClick={(e) => e.stopPropagation()}>
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" disabled={it.disabled}
              className={`menu-item ${it.danger ? 'danger' : ''}`}
              onClick={() => { setOpen(false); it.onSelect() }}>
              {it.icon}<span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
