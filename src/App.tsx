import { useCallback, useMemo, useState } from 'react'
import type { Pattern } from './domain/types'
import { parsePattern, parseOptions, remapRoundKeys } from './domain/parser'
import { uid } from './storage/util'
import { exportBackup, importBackup } from './storage/patterns'
import { samplePatterns } from './storage/samples'
import { downloadBlob } from './render2d/chartExport'
import { usePatterns } from './hooks/usePatterns'
import { useHashRoute, type PatternTab } from './hooks/useHashRoute'
import { useToast } from './hooks/useToast'
import { ToastView } from './ui/Toast'
import { LibraryView } from './features/library/LibraryView'
import { PatternView } from './features/pattern/PatternView'
import { PatternForm, type PatternDraft } from './features/pattern/PatternForm'

export default function App() {
  const { toast, show: notify, hide: hideToast } = useToast()
  const onSaveError = useCallback(() => notify(
    'Stockage du navigateur plein : la dernière modification n\'est pas sauvegardée. Exportez une sauvegarde puis supprimez des patrons.',
    { error: true },
  ), [notify])
  const { patterns, setPatterns, update } = usePatterns(onSaveError)
  const [route, navigate] = useHashRoute()
  const [editing, setEditing] = useState<Pattern | 'new' | null>(null)

  const open = useMemo(() => patterns.find((p) => p.id === route.patternId) ?? null, [patterns, route.patternId])
  const openPattern = (id: string, tab: PatternTab = 'patron') => navigate({ patternId: id, tab })

  const savePattern = (data: PatternDraft) => {
    if (data.id) {
      const id = data.id
      update(id, (p) => {
        const next = { ...p, ...data } as Pattern
        // le texte a changé : on retrouve les rangs déjà cochés dans la nouvelle version
        if (p.text !== next.text || p.notation !== next.notation || p.size !== next.size) {
          next.roundsDone = remapRoundKeys(
            parsePattern(p.text, parseOptions(p)), parsePattern(next.text, parseOptions(next)), p.roundsDone,
          )
        }
        return next
      })
    } else {
      const now = new Date().toISOString()
      const p: Pattern = {
        ...data, id: uid(), createdAt: now, updatedAt: now, checklist: [], roundsDone: [], stitchCounter: 0, pieceColors: {},
      } as Pattern
      setPatterns((ps) => [p, ...ps])
      openPattern(p.id)
    }
    setEditing(null)
    notify('Patron enregistré')
  }

  // suppression immédiate, annulable quelques secondes depuis le message
  const deletePattern = (id: string) => {
    const index = patterns.findIndex((x) => x.id === id)
    if (index < 0) return
    const removed = patterns[index]
    setPatterns((ps) => ps.filter((x) => x.id !== id))
    if (route.patternId === id) navigate({ patternId: null, tab: 'patron' })
    notify(`« ${removed.name} » supprimé`, {
      action: {
        label: 'Annuler',
        run: () => setPatterns((ps) => {
          if (ps.some((x) => x.id === id)) return ps
          const next = [...ps]
          next.splice(Math.min(index, next.length), 0, removed)
          return next
        }),
      },
    })
  }

  const onImport = async (file: File) => {
    try {
      const imported = await importBackup(file)
      setPatterns((ps) => {
        const ids = new Set(ps.map((p) => p.id))
        return [...imported.map((p) => (ids.has(p.id) ? { ...p, id: uid() } : p)), ...ps]
      })
      notify(`${imported.length} patron${imported.length > 1 ? 's importés' : ' importé'}`)
    } catch {
      notify('Ce fichier de sauvegarde est illisible.', { error: true })
    }
  }

  const onExport = async () => {
    try {
      downloadBlob(await exportBackup(patterns), `mon-crochet-${new Date().toISOString().slice(0, 10)}.json`)
    } catch {
      notify('Export impossible.', { error: true })
    }
  }

  const restoreSamples = () => {
    setPatterns((ps) => {
      const names = new Set(ps.map((p) => p.name))
      return [...ps, ...samplePatterns().filter((p) => !names.has(p.name))]
    })
    notify('Patrons d\'exemple restaurés')
  }

  const setRoundsDone = (pid: string, keys: string[], done: boolean) => update(pid, (p) => {
    const set = new Set(p.roundsDone)
    for (const k of keys) {
      if (done) set.add(k)
      else set.delete(k)
    }
    return { ...p, roundsDone: [...set] }
  })

  return (
    <div className="app">
      {open ? (
        <PatternView
          pattern={open}
          tab={route.tab}
          onTab={(tab) => navigate({ patternId: open.id, tab }, { replace: true })}
          onBack={() => navigate({ patternId: null, tab: 'patron' })}
          onEdit={() => setEditing(open)}
          onDelete={() => deletePattern(open.id)}
          onChecklist={(fn) => update(open.id, (p) => ({ ...p, checklist: fn(p.checklist) }))}
          onSetRounds={(keys, done) => setRoundsDone(open.id, keys, done)}
          onStitchCounter={(n) => update(open.id, (p) => ({ ...p, stitchCounter: Math.max(0, n) }))}
          onPieceColor={(label, color) => update(open.id, (p) => {
            if (label === '*') return { ...p, pieceColors: {} }
            const pieceColors = { ...p.pieceColors }
            if (color) pieceColors[label] = color
            else delete pieceColors[label]
            return { ...p, pieceColors }
          })}
        />
      ) : (
        <LibraryView patterns={patterns} onOpen={openPattern} onNew={() => setEditing('new')} onDelete={deletePattern}
          onExport={onExport} onImport={onImport} onRestoreSamples={restoreSamples} />
      )}
      {editing && (
        <PatternForm initial={editing === 'new' ? null : editing} onSave={savePattern} onCancel={() => setEditing(null)} />
      )}
      <ToastView toast={toast} onHide={hideToast} />
    </div>
  )
}
