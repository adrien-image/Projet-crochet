import { useCallback, useEffect, useState } from 'react'
import { loadSettings, saveSettings, SETTINGS_KEY, type Settings } from '../storage/settings'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const update = useCallback((fn: (s: Settings) => Settings) => setSettings((s) => {
    const next = fn(s)
    saveSettings(next)
    return next
  }), [])
  // préférences modifiées dans un autre onglet (suppressions, dernière sauvegarde…)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === SETTINGS_KEY) setSettings(loadSettings()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return [settings, update] as const
}
