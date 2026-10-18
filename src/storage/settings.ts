// Préférences de l'appareil (langue, rappels de sauvegarde, suppressions pour la synchronisation).

export type Lang = 'fr' | 'en'

export interface Settings {
  lang: Lang | null
  firstUseAt: string
  lastExportAt: string | null
  reminderSnoozedUntil: string | null
  /** patrons supprimés (id → date), pour ne pas les faire réapparaître lors d'une synchronisation */
  deleted: Record<string, string>
  persistAsked: boolean
}

export const SETTINGS_KEY = 'crochet.settings.v1'
const KEY = SETTINGS_KEY

/** Suppressions (id → date ISO) d'un fichier ou de localStorage : uniquement des chaînes. */
export function cleanDeleted(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, at] of Object.entries(raw)) {
    // une date dans le futur (fichier forgé ou horloge fausse) supprimerait le patron pour toujours
    if (id !== '__proto__' && typeof at === 'string' && Date.parse(at) <= Date.now() + 86400e3) out[id] = at
  }
  return out
}

export function defaultSettings(): Settings {
  return { lang: null, firstUseAt: new Date().toISOString(), lastExportAt: null, reminderSnoozedUntil: null, deleted: {}, persistAsked: false }
}

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (raw && typeof raw === 'object') {
      const d = defaultSettings()
      return {
        lang: raw.lang === 'fr' || raw.lang === 'en' ? raw.lang : null,
        firstUseAt: typeof raw.firstUseAt === 'string' ? raw.firstUseAt : d.firstUseAt,
        lastExportAt: typeof raw.lastExportAt === 'string' ? raw.lastExportAt : null,
        reminderSnoozedUntil: typeof raw.reminderSnoozedUntil === 'string' ? raw.reminderSnoozedUntil : null,
        deleted: cleanDeleted(raw.deleted),
        persistAsked: !!raw.persistAsked,
      }
    }
  } catch {
    // préférences illisibles : valeurs par défaut
  }
  return defaultSettings()
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // stockage plein : les préférences ne sont pas essentielles
  }
}

const DAY = 86400 * 1000

/**
 * Faut-il rappeler d'exporter une sauvegarde ? Oui si des patrons ont été modifiés depuis la
 * dernière sauvegarde et que celle-ci date de plus de 14 jours (ou n'existe pas après 7 jours d'usage).
 */
export function needsBackupReminder(s: Settings, lastChangeAt: string | null, now = Date.now()): boolean {
  if (!lastChangeAt) return false
  if (s.reminderSnoozedUntil && Date.parse(s.reminderSnoozedUntil) > now) return false
  if (s.lastExportAt) return Date.parse(lastChangeAt) > Date.parse(s.lastExportAt) && now - Date.parse(s.lastExportAt) > 14 * DAY
  return now - Date.parse(s.firstUseAt) > 7 * DAY
}

/** Demande au navigateur de ne pas effacer les données de l'application (stockage persistant). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function storageInfo(): Promise<{ persisted: boolean, usage: number | null, quota: number | null }> {
  try {
    const persisted = (await navigator.storage?.persisted?.()) ?? false
    const est = await navigator.storage?.estimate?.()
    return { persisted, usage: est?.usage ?? null, quota: est?.quota ?? null }
  } catch {
    return { persisted: false, usage: null, quota: null }
  }
}
