import { useCallback, useEffect, useRef, useState } from 'react'
import type { Pattern } from '../domain/types'
import { loadPatterns, savePatterns, storeInlineAssets, applyStoredAssets, needsAssetMigration, assetIds, normalizePattern, STORAGE_KEY } from '../storage/patterns'
import { loadSettings } from '../storage/settings'
import { mergeLibraries } from '../storage/sync'
import { collectGarbage } from '../storage/assets'

const SAVE_DELAY = 400

/**
 * Liste des patrons, persistée dans localStorage. L'écriture est regroupée (un compteur de mailles
 * tapé 30 fois ne réécrit pas 30 fois toute la bibliothèque) et forcée quand la page est masquée.
 */
export function usePatterns(onSaveError: () => void) {
  const [patterns, setPatterns] = useState<Pattern[]>(loadPatterns)
  const latest = useRef(patterns)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const migrating = useRef(new Set<string>())
  const onError = useRef(onSaveError)
  useEffect(() => { onError.current = onSaveError }, [onSaveError])

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (!dirty.current) return
    dirty.current = false
    if (!savePatterns(latest.current)) onError.current()
  }, [])

  const first = useRef(true)
  // liste reprise telle quelle d'un autre onglet : déjà enregistrée, ne pas la réécrire (sinon ping-pong)
  const external = useRef(false)
  useEffect(() => {
    latest.current = patterns
    if (first.current || external.current) {
      first.current = false
      external.current = false
      return
    }
    dirty.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY)
  }, [patterns, flush])

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      flush()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flush])

  // l'application ouverte dans un autre onglet (ou la PWA installée) a enregistré sa bibliothèque :
  // on la reprend, sinon le prochain enregistrement d'ici effacerait ses modifications
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue == null) return
      let incoming: Pattern[]
      try {
        const data = JSON.parse(e.newValue)
        if (!Array.isArray(data)) return
        incoming = data.filter((p) => p && typeof p === 'object').map(normalizePattern)
      } catch {
        return
      }
      if (!dirty.current) {
        external.current = true
        setPatterns(incoming)
        return
      }
      // des modifications d'ici pas encore enregistrées : fusion (le plus récent gagne, suppressions comprises)
      const { deleted } = loadSettings()
      setPatterns((current) => mergeLibraries(current, incoming, deleted, deleted).patterns)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // anciens fichiers en data: (ou import) → IndexedDB
  useEffect(() => {
    for (const p of patterns) {
      if (!needsAssetMigration(p) || migrating.current.has(p.id)) continue
      migrating.current.add(p.id)
      storeInlineAssets(p).then((stored) => {
        // appliqué à l'état actuel : les modifications faites pendant l'enregistrement sont gardées
        if (stored) setPatterns((ps) => ps.map((x) => (x.id === p.id ? applyStoredAssets(x, stored) : x)))
      }).catch(() => {}).finally(() => migrating.current.delete(p.id))
    }
  }, [patterns])

  // ménage des fichiers orphelins (patrons supprimés, formulaires annulés) au démarrage
  useEffect(() => {
    const t = setTimeout(() => {
      const keep = new Set<string>()
      for (const p of latest.current) for (const id of assetIds(p)) keep.add(id)
      collectGarbage(keep).catch(() => {})
    }, 4000)
    return () => clearTimeout(t)
  }, [])

  const update = useCallback((id: string, fn: (p: Pattern) => Pattern) => setPatterns((ps) => ps.map((p) => (
    p.id === id ? { ...fn(p), updatedAt: new Date().toISOString() } : p
  ))), [])

  return { patterns, setPatterns, update, flush }
}
