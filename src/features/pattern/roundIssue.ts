import type { Round } from '../../domain/types'
import { t } from '../../i18n'

/** Problème d'un rang : compte annoncé différent, ou rang qui ne prend pas toutes les mailles du précédent. */
export function roundIssue(r: Round): string | null {
  if (!r.valid && r.expected != null) return t('⚠ {c} mailles calculées, {e} annoncées', { c: r.count, e: r.expected })
  if (r.fits === false) return t('⚠ Ce rang se travaille sur {c} mailles, le rang précédent en compte {p}.', { c: r.consumed, p: r.prevCount ?? 0 })
  return null
}
