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
  const [error, setError] = useState('')
  const textRef = useRef(text)
  const photo = useAssetUrl(note?.photoId)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ note, onChange })
  useEffect(() => { latest.current = { note, onChange } })

  const pending = useRef<string | null>(null)
  const commit = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (pending.current == null) return
    const { note: n, onChange: cb } = latest.current
    cb({ text: pending.current, photoId: n?.photoId ?? null, photoThumb: n?.photoThumb ?? null })
    pending.current = null
  }
  const save = (value: string) => {
    textRef.current = value
    pending.current = value
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(commit, 400)
  }
  // enregistrement immédiat si on quitte le rang (ou la page) avant la fin du délai
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => commit(), [])

  const addPhoto = async (input: HTMLInputElement) => {
    const f = input.files?.[0]
    // la même photo pourra être choisie à nouveau
    input.value = ''
    if (!f) return
    setBusy(true)
    setError('')
    try {
      const dataUrl = await compressImage(f, 1400)
      const photo = { photoId: await putAsset(dataUrl), photoThumb: await makeThumbnail(dataUrl, 200) }
      // le texte tapé pendant l'envoi est gardé
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      pending.current = null
      latest.current.onChange({ text: textRef.current, ...photo })
    } catch {
      setError(t('Impossible de lire cette image.'))
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
        onBlur={commit} />
      <div className="row-gap wrap">
        {(photo || note?.photoThumb) && (
          <a href={photo ?? undefined} target="_blank" rel="noreferrer noopener" className="note-photo">
            <img src={photo ?? note?.photoThumb ?? undefined} alt={t('Photo du rang {r}', { r: label })} />
          </a>
        )}
        <label className={`btn ghost sm ${busy ? 'disabled' : ''}`}>
          <Camera size={15} /> {note?.photoId ? t('Changer la photo') : t('Ajouter une photo')}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => addPhoto(e.target)} />
        </label>
        {note?.photoId && (
          <button type="button" className="btn ghost sm danger" onClick={() => onChange({ text: textRef.current, photoId: null, photoThumb: null })}>
            <Trash2 size={15} /> {t('Retirer la photo')}
          </button>
        )}
      </div>
      {error && <p className="text-warn sm" role="alert">{error}</p>}
    </div>
  )
}
