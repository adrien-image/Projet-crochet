import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ChecklistItem } from '../../domain/types'
import { uid } from '../../storage/util'

type Update = (fn: (list: ChecklistItem[]) => ChecklistItem[]) => void

export function Checklist({ items, onChange }: { items: ChecklistItem[], onChange: Update }) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ id: string, text: string } | null>(null)

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    onChange((list) => [...list, { id: uid(), text, done: false }])
    setDraft('')
  }
  const move = (index: number, delta: number) => onChange((list) => {
    const j = index + delta
    if (j < 0 || j >= list.length) return list
    const next = [...list]
    ;[next[index], next[j]] = [next[j], next[index]]
    return next
  })
  const saveEdit = () => {
    if (!editing) return
    const text = editing.text.trim()
    if (text) onChange((list) => list.map((i) => (i.id === editing.id ? { ...i, text } : i)))
    setEditing(null)
  }

  return (
    <div className="checklist">
      {items.length > 0 && (
        <ul>
          {items.map((item, index) => (
            <li key={item.id} className={`check-item ${item.done ? 'done' : ''}`}>
              {editing?.id === item.id ? (
                <form className="check-edit" onSubmit={(e) => { e.preventDefault(); saveEdit() }}>
                  <input className="input" value={editing.text} autoFocus aria-label="Modifier l'étape"
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(null) } }}
                    onBlur={saveEdit} />
                </form>
              ) : (
                <label className="check-label">
                  <input type="checkbox" className="sr-only" checked={item.done}
                    onChange={() => onChange((list) => list.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))} />
                  <span className="check-box" aria-hidden="true">{item.done && <Check size={14} strokeWidth={3} />}</span>
                  <span className="check-text">{item.text}</span>
                </label>
              )}
              <div className="check-actions">
                <button type="button" className="icon-btn ghost sm" aria-label="Monter" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></button>
                <button type="button" className="icon-btn ghost sm" aria-label="Descendre" disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></button>
                <button type="button" className="icon-btn ghost sm" aria-label={`Modifier l'étape ${item.text}`} onClick={() => setEditing({ id: item.id, text: item.text })}><Pencil size={15} /></button>
                <button type="button" className="icon-btn ghost sm danger" aria-label={`Supprimer l'étape ${item.text}`}
                  onClick={() => onChange((list) => list.filter((i) => i.id !== item.id))}><Trash2 size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="check-add" onSubmit={add}>
        <input className="input" value={draft} placeholder="Ajouter une étape (ex. Coudre les bras)"
          aria-label="Nouvelle étape" onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="btn secondary" aria-label="Ajouter l'étape"><Plus size={18} /></button>
      </form>
    </div>
  )
}
