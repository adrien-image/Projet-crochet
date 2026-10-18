import { useCallback, useEffect, useRef, useState } from 'react'
import { loadPatterns, savePatterns, migratePatternAssets } from '../storage'
import { collectGarbage } from '../assets'

/** Liste des patrons, persistée dans localStorage ; fichiers migrés vers IndexedDB. */
export function usePatterns(onSaveError) {
  const [patterns, setPatterns] = useState(loadPatterns)
  const latest = useRef(patterns)
  const firstSave = useRef(true)
  const migrating = useRef(new Set())
  const onError = useRef(onSaveError)

  useEffect(() => { onError.current = onSaveError }, [onSaveError])

  useEffect(() => {
    latest.current = patterns
    if (firstSave.current) {
      firstSave.current = false
      return
    }
    if (!savePatterns(patterns)) onError.current?.()
  }, [patterns])

  // anciens fichiers en data: (ou import) → IndexedDB
  useEffect(() => {
    for (const p of patterns) {
      if ((!p.image && !p.fileData) || migrating.current.has(p.id)) continue
      migrating.current.add(p.id)
      migratePatternAssets(p).then((patch) => {
        if (patch) setPatterns((ps) => ps.map((x) => (x.id === p.id ? { ...x, ...patch } : x)))
      }).finally(() => migrating.current.delete(p.id))
    }
  }, [patterns])

  // ménage des fichiers orphelins (patrons supprimés, formulaires annulés) au démarrage
  useEffect(() => {
    const t = setTimeout(() => {
      const keep = new Set()
      for (const p of latest.current) {
        if (p.imageId) keep.add(p.imageId)
        if (p.fileId) keep.add(p.fileId)
      }
      collectGarbage(keep)
    }, 4000)
    return () => clearTimeout(t)
  }, [])

  const update = useCallback((id, fn) => setPatterns((ps) => ps.map((p) => (
    p.id === id ? { ...fn(p), updatedAt: new Date().toISOString() } : p
  ))), [])

  return { patterns, setPatterns, update }
}
