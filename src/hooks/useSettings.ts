import { useCallback, useState } from 'react'
import { loadSettings, saveSettings, type Settings } from '../storage/settings'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const update = useCallback((fn: (s: Settings) => Settings) => setSettings((s) => {
    const next = fn(s)
    saveSettings(next)
    return next
  }), [])
  return [settings, update] as const
}
