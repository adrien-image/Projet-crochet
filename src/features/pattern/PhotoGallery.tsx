import { useState } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, Plus, Star, Trash2 } from 'lucide-react'
import type { Pattern } from '../../domain/types'
import { PHOTO_LIMIT, uploadPhotos } from './photoUpload'
import { useAssetUrl } from '../../hooks/useAssetUrl'
import { t } from '../../i18n'
import { Dialog } from '../../ui/Dialog'
import { FabricSwatch } from '../shared/FabricSwatch'
import { photosOf, setPhotos, type PhotoRef, type Update } from './actions'

/** Image d'une photo : fichier IndexedDB, sinon ancien format, sinon miniature. */
export function PhotoImage({ photo, alt, full }: { photo: PhotoRef, alt: string, full?: boolean }) {
  const url = useAssetUrl(full || !photo.thumb ? photo.id : null)
  const src = url || photo.image || photo.data || photo.thumb
  return src ? <img src={src} alt={alt} /> : <span className="photo-missing" aria-hidden="true" />
}

export function PhotoGallery({ pattern, update }: { pattern: Pattern, update: Update }) {
  const photos = photosOf(pattern)
  const [current, setCurrent] = useState(0)
  const [viewing, setViewing] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const index = Math.min(current, Math.max(0, photos.length - 1))
  const room = PHOTO_LIMIT - photos.length

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError('')
    const { photos: added, error: problem } = await uploadPhotos(files, photos.length)
    if (added.length) {
      update((p) => setPhotos(p, [...photosOf(p), ...added]))
      setCurrent(photos.length)
    }
    setError(problem)
    setBusy(false)
  }

  const remove = (i: number) => {
    update((p) => setPhotos(p, photosOf(p).filter((_, k) => k !== i)))
    if (viewing != null) setViewing(photos.length > 1 ? Math.min(i, photos.length - 2) : null)
    setCurrent((c) => Math.max(0, c >= i ? c - 1 : c))
  }

  const makeCover = (i: number) => {
    update((p) => {
      const list = photosOf(p)
      return setPhotos(p, [list[i], ...list.filter((_, k) => k !== i)])
    })
    setCurrent(0)
    if (viewing != null) setViewing(0)
  }

  const addButton = (label: string, className: string) => (
    <label className={`${className} ${busy || room <= 0 ? 'disabled' : ''}`} title={label}>
      {className.includes('photo-add') ? <Plus size={20} /> : <ImagePlus size={18} />}
      <span className={className.includes('photo-add') ? 'sr-only' : ''}>{busy ? t('Chargement…') : label}</span>
      <input type="file" accept="image/*" multiple className="sr-only" disabled={busy || room <= 0} onChange={(e) => { add(e.target.files); e.target.value = '' }} />
    </label>
  )

  if (!photos.length) {
    return (
      <div className="photo">
        <div className="photo-empty">
          <FabricSwatch pattern={pattern} />
          {addButton(t('Ajouter des photos'), 'photo-empty-add')}
        </div>
        {error && <p className="text-warn sm photo-error" role="alert">{error}</p>}
      </div>
    )
  }

  const shown = viewing ?? index
  return (
    <div className="photo">
      <button type="button" className="photo-main" onClick={() => setViewing(index)} aria-label={t('Agrandir la photo')}>
        <PhotoImage photo={photos[index]} alt={pattern.name} full />
        {photos.length > 1 && <span className="photo-count">{index + 1} / {photos.length}</span>}
      </button>
      <div className="photo-strip" role="list" aria-label={t('Photos de l\'ouvrage')}>
        {photos.map((ph, i) => (
          <button key={`${ph.id ?? 'legacy'}-${i}`} type="button" role="listitem" className={`photo-thumb ${i === index ? 'active' : ''}`}
            aria-current={i === index} aria-label={t('Photo {n}', { n: i + 1 })} onClick={() => setCurrent(i)}>
            <PhotoImage photo={ph} alt="" />
            {i === 0 && <Star size={12} className="photo-cover-mark" aria-hidden="true" />}
          </button>
        ))}
        {room > 0 && addButton(t('Ajouter des photos'), 'photo-thumb photo-add')}
      </div>
      {error && <p className="text-warn sm photo-error" role="alert">{error}</p>}

      {viewing != null && photos[shown] && (
        <Dialog open size="lg" title={t('Photo {n} sur {m}', { n: shown + 1, m: photos.length })} onClose={() => setViewing(null)}
          footer={(
            <>
              <button type="button" className="btn ghost sm danger" onClick={() => remove(shown)}><Trash2 size={15} /> {t('Supprimer')}</button>
              {shown > 0 && <button type="button" className="btn ghost sm" onClick={() => makeCover(shown)}><Star size={15} /> {t('Mettre en couverture')}</button>}
            </>
          )}>
          <div className="lightbox" onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' && shown > 0) setViewing(shown - 1)
            if (e.key === 'ArrowRight' && shown < photos.length - 1) setViewing(shown + 1)
          }}>
            <button type="button" className="icon-btn lightbox-nav" disabled={shown === 0} onClick={() => setViewing(shown - 1)} aria-label={t('Photo précédente')}><ChevronLeft size={20} /></button>
            <PhotoImage photo={photos[shown]} alt={t('Photo {n}', { n: shown + 1 })} full />
            <button type="button" className="icon-btn lightbox-nav" disabled={shown === photos.length - 1} onClick={() => setViewing(shown + 1)} aria-label={t('Photo suivante')}><ChevronRight size={20} /></button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
