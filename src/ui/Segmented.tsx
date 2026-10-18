import type { ReactNode } from 'react'

export interface SegmentOption<T extends string> { value: T, label: ReactNode, title?: string }

/** Contrôle segmenté (choix exclusif), navigable au clavier comme un groupe de boutons radio. */
export function Segmented<T extends string>({ value, options, onChange, label, size }: {
  value: T
  options: SegmentOption<T>[]
  onChange: (v: T) => void
  label: string
  size?: 'sm'
}) {
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const i = options.findIndex((o) => o.value === value)
    const next = options[(i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length]
    onChange(next.value)
  }
  return (
    <div className={`segmented ${size ?? ''}`} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} title={o.title}
          tabIndex={o.value === value ? 0 : -1} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
