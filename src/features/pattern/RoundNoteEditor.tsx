import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import type { RoundNote } from '../../domain/types'
import { putAsset } from '../../storage/assets'
import { compressImage, makeThumbnail } from '../../storage/images'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { t } from '../../i18n'

/** Note et photo d'un rang (enregistrées en cours de frappe). */
export function RoundNoteEditor({ note, onChange, label }: { note: RoundNote | undefined, onChange: (n: RoundNote | null) => void, label: string }) {
  const [text, setText] = useState(note?.text ?? '')
  const [busy, setBusy] = useState(false)
  const photo = useAssetUrl(note?.photoId)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ note, onChange })
  useEffect(() => { latest.current = { note, onChange } })

  const save = (value: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const { note: n, onChange: cb } = latest.current
      cb({ text: value, photoId: n?.photoId ?? null, photoThumb: n?.photoThumb ?? null })
    }, 400)
  }
  // enregistrement immédiat si on quitte le rang avant la fin du délai
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const addPhoto = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try {
      const dataUrl = await compressImage(f, 1400)
      onChange({ text, photoId: await putAsset(dataUrl), photoThumb: await makeThumbnail(dataUrl, 200) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="round-note">
      <label className="sr-only" htmlFor={`note-${label}`}>{t('Note pour {r}', { r: label })}</label>
      <textarea id={`note-${label}`} className="input" rows={2} value={text}
        placeholder={t('Note pour ce rang (marqueur placé, couleur changée…)')}
        onChange={(e) => { setText(e.target.value); save(e.target.value) }}
        onBlur={() => { if (timer.current) { clearTimeout(timer.current); timer.current = null; onChange({ text, photoId: note?.photoId ?? null, photoThumb: note?.photoThumb ?? null }) } }} />
      <div className="row-gap wrap">
        {(photo || note?.photoThumb) && (
          <a href={photo ?? undefined} target="_blank" rel="noreferrer noopener" className="note-photo">
            <img src={photo ?? note?.photoThumb ?? undefined} alt={t('Photo du rang {r}', { r: label })} />
          </a>
        )}
        <label className={`btn ghost sm ${busy ? 'disabled' : ''}`}>
          <Camera size={15} /> {note?.photoId ? t('Changer la photo') : t('Ajouter une photo')}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => addPhoto(e.target.files?.[0])} />
        </label>
        {note?.photoId && (
          <button type="button" className="btn ghost sm danger" onClick={() => onChange({ text, photoId: null, photoThumb: null })}>
            <Trash2 size={15} /> {t('Retirer la photo')}
          </button>
        )}
      </div>
    </div>
  )
}
