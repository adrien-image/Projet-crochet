// Ajout de photos de l'ouvrage : image réduite dans IndexedDB, miniature légère pour l'affichage.
import { putAsset } from './assets'
import { compressImage, makeThumbnail } from './images'

/** taille des miniatures de la galerie (elles restent dans localStorage) */
const THUMB_PX = 240

export async function storePhoto(file: File): Promise<{ id: string, thumb: string | null }> {
  const dataUrl = await compressImage(file)
  return { id: await putAsset(dataUrl), thumb: await makeThumbnail(dataUrl, THUMB_PX) }
}

/** Plusieurs photos ; les fichiers illisibles sont ignorés (et comptés). */
export async function storePhotos(files: Iterable<File>): Promise<{ photos: { id: string, thumb: string | null }[], failed: number }> {
  const photos = []
  let failed = 0
  for (const f of files) {
    if (!f.type.startsWith('image/')) {
      failed++
      continue
    }
    try {
      photos.push(await storePhoto(f))
    } catch {
      failed++
    }
  }
  return { photos, failed }
}
