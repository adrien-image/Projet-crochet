import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert } from 'lucide-react'
import { requestPersistence, storageInfo } from '../../storage/settings'
import { t, getLang } from '../../i18n'
import { Dialog } from '../../ui/Dialog'

const size = (bytes: number) => {
  const lang = getLang()
  if (bytes >= 1e9) return `${(bytes / 1e9).toLocaleString(lang, { maximumFractionDigits: 1 })} Go`
  if (bytes >= 1e6) return `${(bytes / 1e6).toLocaleString(lang, { maximumFractionDigits: 1 })} Mo`
  return `${Math.max(1, Math.round(bytes / 1e3)).toLocaleString(lang)} ko`
}

export function StorageDialog({ onClose, onExport, lastExportAt }: { onClose: () => void, onExport: () => void, lastExportAt: string | null }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof storageInfo>> | null>(null)
  const refresh = () => { storageInfo().then(setInfo) }
  useEffect(refresh, [])

  return (
    <Dialog open title={t('Stockage et sécurité des données')} onClose={onClose} size="sm"
      footer={<button type="button" className="btn primary" onClick={onClose}>{t('Fermer')}</button>}>
      <div className="storage">
        <p className="muted">{t('Vos patrons, photos et fichiers sont enregistrés uniquement dans ce navigateur, sur cet appareil.')}</p>
        {info && (
          <div className={`storage-state ${info.persisted ? 'ok' : 'warn'}`}>
            {info.persisted ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
            <div>
              <strong>{info.persisted ? t('Stockage protégé') : t('Stockage non protégé')}</strong>
              <p className="sm">
                {info.persisted
                  ? t('Le navigateur ne supprimera pas ces données pour libérer de la place.')
                  : t('Si l\'appareil manque de place, le navigateur pourrait effacer ces données.')}
              </p>
              {!info.persisted && (
                <button type="button" className="btn secondary sm" onClick={() => requestPersistence().then(refresh)}>{t('Protéger mes données')}</button>
              )}
            </div>
          </div>
        )}
        {info?.usage != null && (
          <p className="sm">{t('Espace utilisé : {u}', { u: size(info.usage) })}{info.quota ? ` / ${size(info.quota)}` : ''}</p>
        )}
        <p className="sm">
          {lastExportAt
            ? t('Dernière sauvegarde exportée le {d}.', { d: new Date(lastExportAt).toLocaleDateString(getLang()) })
            : t('Aucune sauvegarde exportée pour l\'instant.')}
        </p>
        <button type="button" className="btn ghost sm" onClick={onExport}>{t('Exporter une sauvegarde')}</button>
      </div>
    </Dialog>
  )
}
