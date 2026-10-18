import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Pattern } from '../domain/types'
import type { Settings } from '../storage/settings'
import {
  chooseSyncFile, forgetSyncFile, getSyncHandle, hasPermission, mergeLibraries, readSyncFile, syncSupported, writeSyncFile,
} from '../storage/sync'

export type SyncStatus = 'unsupported' | 'off' | 'reconnect' | 'syncing' | 'synced' | 'error'

const WRITE_DELAY = 3000

type Handle = NonNullable<Awaited<ReturnType<typeof getSyncHandle>>>

/**
 * Synchronisation de la bibliothèque avec un fichier (Dropbox, Drive, iCloud… via leur dossier
 * local). Lecture et fusion au démarrage et au retour sur l'onglet, écriture après chaque modification.
 */
export function useFileSync(
  patterns: Pattern[],
  setPatterns: Dispatch<SetStateAction<Pattern[]>>,
  settings: Settings,
  updateSettings: (fn: (s: Settings) => Settings) => void,
) {
  const [status, setStatus] = useState<SyncStatus>(() => (syncSupported() ? 'off' : 'unsupported'))
  const [fileName, setFileName] = useState<string | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const handle = useRef<Handle | null>(null)
  const latest = useRef({ patterns, deleted: settings.deleted })
  useEffect(() => { latest.current = { patterns, deleted: settings.deleted } })
  const skipWrite = useRef(false)

  const pull = useCallback(async (h: Handle) => {
    const remote = await readSyncFile(h)
    if (!remote) return
    const merged = mergeLibraries(latest.current.patterns, remote.patterns, latest.current.deleted, remote.deleted)
    if (merged.changed) {
      skipWrite.current = false
      setPatterns(merged.patterns)
    }
    updateSettings((s) => ({ ...s, deleted: merged.deleted }))
  }, [setPatterns, updateSettings])

  const push = useCallback(async (h: Handle) => {
    await writeSyncFile(h, latest.current.patterns, latest.current.deleted)
    setLastSyncAt(new Date().toISOString())
  }, [])

  const run = useCallback(async (h: Handle, interactive: boolean) => {
    if (!(await hasPermission(h, interactive))) {
      setStatus('reconnect')
      return
    }
    setStatus('syncing')
    try {
      await pull(h)
      await push(h)
      setStatus('synced')
    } catch {
      setStatus('error')
    }
  }, [pull, push])

  // au démarrage : fichier déjà lié ?
  useEffect(() => {
    if (!syncSupported()) return
    let alive = true
    getSyncHandle().then((h) => {
      if (!alive || !h) return
      handle.current = h
      setFileName(h.name)
      run(h, false)
    }).catch(() => {})
    return () => { alive = false }
  }, [run])

  // écriture regroupée après chaque modification
  useEffect(() => {
    if (status !== 'synced' || !handle.current) return
    if (skipWrite.current) {
      skipWrite.current = false
      return
    }
    const h = handle.current
    const t = setTimeout(() => { push(h).catch(() => setStatus('error')) }, WRITE_DELAY)
    return () => clearTimeout(t)
  }, [patterns, settings.deleted, status, push])

  // retour sur l'onglet : un autre appareil a pu modifier le fichier
  useEffect(() => {
    if (status !== 'synced') return
    const onFocus = () => { if (handle.current && document.visibilityState === 'visible') pull(handle.current).catch(() => {}) }
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [status, pull])

  const link = useCallback(async () => {
    const h = await chooseSyncFile()
    if (!h) return
    handle.current = h
    setFileName(h.name)
    await run(h, true)
  }, [run])

  const reconnect = useCallback(async () => {
    if (handle.current) await run(handle.current, true)
  }, [run])

  const unlink = useCallback(async () => {
    await forgetSyncFile()
    handle.current = null
    setFileName(null)
    setStatus(syncSupported() ? 'off' : 'unsupported')
  }, [])

  return { status, fileName, lastSyncAt, link, reconnect, unlink }
}
