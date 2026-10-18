import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Pattern } from './domain/types'
import { parsePattern, parseOptions, remapRoundKeys } from './domain/parser'
import { stopTimer } from './domain/time'
import { uid } from './storage/util'
import { duplicatePattern, exportBackup, importBackup } from './storage/patterns'
import { samplePatterns } from './storage/samples'
import { needsBackupReminder, requestPersistence } from './storage/settings'
import { decodeShare, encodeShare, shareUrl } from './storage/share'
import { downloadBlob } from './render2d/chartExport'
import { usePatterns } from './hooks/usePatterns'
import { useHashRoute, type PatternTab } from './hooks/useHashRoute'
import { useToast } from './hooks/useToast'
import { useSettings } from './hooks/useSettings'
import { useFileSync } from './hooks/useFileSync'
import { setLang, t, tn, type Lang } from './i18n'
import { ToastView } from './ui/Toast'
import { Dialog } from './ui/Dialog'
import { LibraryView } from './features/library/LibraryView'
import { StorageDialog } from './features/library/StorageDialog'
import { PatternView, type ShareKind } from './features/pattern/PatternView'
import { PatternForm, type PatternDraft } from './features/pattern/PatternForm'
import { DuplicateDialog } from './features/pattern/DuplicateDialog'

const fileSlug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'patron'
const shareCodeFromHash = () => window.location.hash.match(/^#\/partage\/([A-Za-z0-9_-]+)$/)?.[1] ?? null

export default function App({ onLang }: { onLang: (lang: Lang) => void }) {
  const { toast, show: notify, hide: hideToast } = useToast()
  const onSaveError = useCallback(() => notify(
    t('Stockage du navigateur plein : la dernière modification n\'est pas sauvegardée. Exportez une sauvegarde puis supprimez des patrons.'),
    { error: true },
  ), [notify])
  const { patterns, setPatterns, update } = usePatterns(onSaveError)
  const [settings, updateSettings] = useSettings()
  const sync = useFileSync(patterns, setPatterns, settings, updateSettings)
  const [route, navigate] = useHashRoute()
  const [editing, setEditing] = useState<Pattern | 'new' | null>(null)
  const [storageOpen, setStorageOpen] = useState(false)
  const [incoming, setIncoming] = useState<Pattern | null>(null)
  const [duplicating, setDuplicating] = useState<Pattern | null>(null)

  const open = useMemo(() => patterns.find((p) => p.id === route.patternId) ?? null, [patterns, route.patternId])
  const openPattern = (id: string, tab: PatternTab = 'patron') => navigate({ patternId: id, tab })

  // une seule demande de stockage persistant, au premier geste qui crée des données
  const protect = () => {
    if (settings.persistAsked) return
    updateSettings((s) => ({ ...s, persistAsked: true }))
    requestPersistence()
  }

  // lien de partage reçu : #/partage/<code>
  useEffect(() => {
    const check = () => {
      const code = shareCodeFromHash()
      if (!code) return
      decodeShare(code)
        .then(setIncoming)
        .catch(() => notify(t('Ce lien de partage est invalide ou incomplet.'), { error: true }))
        .finally(() => window.history.replaceState(null, '', window.location.pathname + window.location.search))
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [notify])

  const updateOpen = (fn: (p: Pattern) => Pattern) => { if (open) update(open.id, fn) }

  const savePattern = (data: PatternDraft) => {
    protect()
    if (data.id) {
      const id = data.id
      update(id, (p) => {
        const next = { ...p, ...data } as Pattern
        // le texte a changé : on retrouve les rangs déjà cochés (et leurs notes) dans la nouvelle version
        if (p.text !== next.text || p.notation !== next.notation || p.size !== next.size) {
          const before = parsePattern(p.text, parseOptions(p))
          const after = parsePattern(next.text, parseOptions(next))
          next.roundsDone = remapRoundKeys(before, after, p.roundsDone)
          const notes: Pattern['roundNotes'] = {}
          for (const [k, note] of Object.entries(p.roundNotes)) {
            const [mapped] = remapRoundKeys(before, after, [k])
            if (mapped) notes[mapped] = note
          }
          next.roundNotes = notes
        }
        return next
      })
    } else {
      const now = new Date().toISOString()
      const p: Pattern = {
        ...data, id: uid(), createdAt: now, updatedAt: now, checklist: [], roundsDone: [], stitchCounter: 0, pieceColors: {},
        roundNotes: {}, placements: {}, timeSpent: 0, timerStartedAt: null, sessions: [], gallery: data.gallery ?? [],
      } as Pattern
      setPatterns((ps) => [p, ...ps])
      openPattern(p.id)
    }
    setEditing(null)
    notify(t('Patron enregistré'))
  }

  // suppression immédiate, annulable quelques secondes depuis le message
  const deletePattern = (id: string) => {
    const index = patterns.findIndex((x) => x.id === id)
    if (index < 0) return
    const removed = patterns[index]
    setPatterns((ps) => ps.filter((x) => x.id !== id))
    updateSettings((s) => ({ ...s, deleted: { ...s.deleted, [id]: new Date().toISOString() } }))
    if (route.patternId === id) navigate({ patternId: null, tab: 'patron' })
    notify(t('« {name} » supprimé', { name: removed.name }), {
      action: {
        label: t('Annuler'),
        run: () => {
          updateSettings((s) => {
            const deleted = { ...s.deleted }
            delete deleted[id]
            return { ...s, deleted }
          })
          setPatterns((ps) => {
            if (ps.some((x) => x.id === id)) return ps
            const next = [...ps]
            next.splice(Math.min(index, next.length), 0, { ...removed, updatedAt: new Date().toISOString() })
            return next
          })
        },
      },
    })
  }

  const addPatterns = (list: Pattern[]) => setPatterns((ps) => {
    const ids = new Set(ps.map((p) => p.id))
    return [...list.map((p) => (ids.has(p.id) ? { ...p, id: uid() } : p)), ...ps]
  })

  const onImport = async (file: File) => {
    protect()
    try {
      const imported = await importBackup(file)
      addPatterns(imported)
      notify(tn(imported.length, '{n} patron importé', '{n} patrons importés'))
    } catch {
      notify(t('Ce fichier de sauvegarde est illisible.'), { error: true })
    }
  }

  const onExport = async () => {
    protect()
    try {
      downloadBlob(await exportBackup(patterns), `mon-crochet-${new Date().toISOString().slice(0, 10)}.json`)
      updateSettings((s) => ({ ...s, lastExportAt: new Date().toISOString(), reminderSnoozedUntil: null }))
    } catch {
      notify(t('Export impossible.'), { error: true })
    }
  }

  const onShare = async (kind: ShareKind) => {
    if (!open) return
    try {
      if (kind === 'file') {
        downloadBlob(await exportBackup([open]), `${fileSlug(open.name)}.crochet.json`)
        return
      }
      const url = shareUrl(await encodeShare(open))
      if (kind === 'native' && navigator.share) {
        await navigator.share({ title: open.name, text: t('Patron de crochet : {name}', { name: open.name }), url })
        return
      }
      await navigator.clipboard.writeText(url)
      notify(t('Lien copié. La personne qui l\'ouvre recevra une copie du patron (sans votre progression ni vos fichiers).'))
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') notify(t('Partage impossible sur ce navigateur.'), { error: true })
    }
  }

  const duplicate = (name: string, keepProgress: boolean) => {
    if (!duplicating) return
    protect()
    const copy = duplicatePattern(duplicating, keepProgress, name)
    setPatterns((ps) => [copy, ...ps])
    setDuplicating(null)
    openPattern(copy.id)
    notify(t('Copie créée : « {name} »', { name: copy.name }))
  }

  const restoreSamples = () => {
    setPatterns((ps) => {
      const names = new Set(ps.map((p) => p.name))
      return [...ps, ...samplePatterns().filter((p) => !names.has(p.name))]
    })
    notify(t('Patrons d\'exemple restaurés'))
  }

  // un seul chronomètre à la fois : en lancer un arrête les autres
  useEffect(() => {
    const running = patterns.filter((p) => p.timerStartedAt)
    if (running.length <= 1) return
    const newest = running.reduce((a, b) => ((a.timerStartedAt ?? '') > (b.timerStartedAt ?? '') ? a : b))
    setPatterns((ps) => ps.map((p) => (p.timerStartedAt && p.id !== newest.id ? stopTimer(p) : p)))
  }, [patterns, setPatterns])

  const lastChangeAt = useMemo(() => patterns.reduce<string | null>((m, p) => (!m || p.updatedAt > m ? p.updatedAt : m), null), [patterns])
  const reminder = needsBackupReminder(settings, lastChangeAt) && sync.status !== 'synced'

  const changeLang = (lang: Lang) => {
    setLang(lang)
    updateSettings((s) => ({ ...s, lang }))
    onLang(lang)
  }

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
          onDuplicate={() => setDuplicating(open)}
          onShare={onShare}
          update={updateOpen}
        />
      ) : (
        <LibraryView patterns={patterns} onOpen={openPattern} onNew={() => setEditing('new')} onDelete={deletePattern}
          onDuplicate={(id) => setDuplicating(patterns.find((p) => p.id === id) ?? null)}
          onExport={onExport} onImport={onImport} onRestoreSamples={restoreSamples} onLang={changeLang}
          onStorage={() => setStorageOpen(true)}
          reminder={{
            show: reminder,
            lastExportAt: settings.lastExportAt,
            onSnooze: () => updateSettings((s) => ({ ...s, reminderSnoozedUntil: new Date(Date.now() + 7 * 86400e3).toISOString() })),
          }}
          sync={sync} />
      )}
      {editing && (
        <PatternForm initial={editing === 'new' ? null : editing} onSave={savePattern} onCancel={() => setEditing(null)} />
      )}
      {duplicating && <DuplicateDialog pattern={duplicating} onDuplicate={duplicate} onCancel={() => setDuplicating(null)} />}
      {storageOpen && <StorageDialog onClose={() => setStorageOpen(false)} onExport={onExport} lastExportAt={settings.lastExportAt} />}
      {incoming && (
        <Dialog open title={t('Patron partagé')} size="sm" onClose={() => setIncoming(null)}
          footer={(
            <>
              <button type="button" className="btn ghost" onClick={() => setIncoming(null)}>{t('Ignorer')}</button>
              <button type="button" className="btn primary" onClick={() => {
                protect()
                addPatterns([incoming])
                openPattern(incoming.id)
                setIncoming(null)
                notify(t('Patron ajouté à votre bibliothèque'))
              }}>{t('Ajouter à ma bibliothèque')}</button>
            </>
          )}>
          <p><strong>{incoming.name}</strong></p>
          {incoming.description && <p className="muted">{incoming.description}</p>}
          <p className="muted sm">{tn(parsePattern(incoming.text, parseOptions(incoming)).length, '{n} rang', '{n} rangs')}</p>
        </Dialog>
      )}
      <ToastView toast={toast} onHide={hideToast} />
    </div>
  )
}
