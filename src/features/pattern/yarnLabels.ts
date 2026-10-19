import type { YarnMaterial } from '../../domain/yarn'
import { t } from '../../i18n'

/** Nom affiché d'une matière de fil. */
export function materialLabel(m: YarnMaterial): string {
  const labels: Record<YarnMaterial, string> = { chenille: t('chenille / velours'), coton: t('coton'), laine: t('laine'), acrylique: t('acrylique'), mohair: t('mohair') }
  return labels[m]
}
