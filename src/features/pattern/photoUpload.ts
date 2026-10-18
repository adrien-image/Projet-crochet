// Ajout de photos (galerie de l'onglet Patron et formulaire), dans la limite par patron.
import { MAX_GALLERY } from '../../storage/patterns'
import { storePhotos } from '../../storage/photos'
import { t, tn } from '../../i18n'
import type { PhotoRef } from './actions'

/** couverture + galerie */
export const PHOTO_LIMIT = MAX_GALLERY + 1

export async function uploadPhotos(files: FileList | File[] | null, count: number): Promise<{ photos: PhotoRef[], error: string }> {
  const list = [...(files ?? [])]
  const room = Math.max(0, PHOTO_LIMIT - count)
  const { photos, failed } = await storePhotos(list.slice(0, room))
  const error = failed ? tn(failed, '{n} fichier n\'a pas pu être lu.', '{n} fichiers n\'ont pas pu être lus.')
    : list.length > room ? t('{m} photos au maximum par patron.', { m: PHOTO_LIMIT })
      : ''
  return { photos, error }
}
