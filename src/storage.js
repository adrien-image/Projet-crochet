// @ts-check
import { parsePattern, parseOptions } from './patternParser.js'
import { putAsset, getAssetDataUrl } from './assets.js'

const STORAGE_KEY = 'crochet.patterns.v1'

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function samplePattern() {
  const p = {
    id: uid(),
    name: 'Souris amigurumi (patron original)',
    description: 'Exemple original fourni avec l\'application : souris avec museau effilé, grandes oreilles et queue. Crochet 3 mm, coton, environ 12 cm. Modifie-le ou supprime-le librement !',
    tags: ['amigurumi', 'souris', 'exemple'],
    createdAt: new Date().toISOString(),
    hook: '3 mm',
    yarn: 'Coton gris, un peu de rose pour le nez',
    text: 'Souris amigurumi — crochet 3 mm, fil coton, hauteur ≈ 12 cm.\nTravailler en spirale, sans joindre les rangs. Le museau s\'élargit doucement (3 augmentations par rang) pour former une pointe. Bourrer au fur et à mesure.\n\nMUSEAU (pointe du nez — début du corps)\nR1 : 6 ms dans un anneau magique (6)\nR2 : *1 ms, aug* x3 (9)\nR3 : *2 ms, aug* x3 (12)\nR4 : *3 ms, aug* x3 (15)\nR5 : *4 ms, aug* x3 (18)\nR6 : *5 ms, aug* x3 (21)\nR7 : *6 ms, aug* x3 (24)\nR8 : *7 ms, aug* x3 (27)\nR9 : *8 ms, aug* x3 (30)\nR10 : *9 ms, aug* x3 (33)\nR11 : *10 ms, aug* x3 (36)\nR12-R13 : 36 ms\n\nCORPS (suite du museau, arrondi vers l\'arrière)\nR14-R17 : 36 ms\nR18 : *4 ms, dim* x6 (30)\nR19 : 30 ms\nR20 : *3 ms, dim* x6 (24)\nR21 : 24 ms\nR22 : *2 ms, dim* x6 (18)\nR23 : *1 ms, dim* x6 (12)\nR24 : dim dans chaque maille (6)\nFermer, bourrer fermement, rentrer le fil.\n\nOREILLES (x2, grandes oreilles rondes)\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)\nR4 : *2 ms, aug* x6 (24)\nR5-R6 : 24 ms\nFermer à plat, aplatir en demi-disque, coudre de chaque côté de la tête.\n\nQUEUE (fine et longue)\nChaîner 40 ml, 1 mc dans la 2e maille depuis le crochet puis dans chaque maille suivante. Coudre à l\'arrière du corps.\n\nASSEMBLAGE\nCoudre les oreilles bien à plat sur les côtés de la tête (elles doivent dépasser largement).\nBroder le nez rose à la pointe du museau, deux yeux noirs au-dessus.\nCoudre la queue à l\'arrière. Terminé ! 🐭',
    checklist: [
      { id: uid() + 'a', text: 'Préparer le fil gris et le crochet 3 mm', done: true },
      { id: uid() + 'b', text: 'Bourrer le corps avant la fermeture', done: false },
      { id: uid() + 'c', text: 'Queue : chaînette de 40 ml', done: false },
      { id: uid() + 'd', text: 'Coudre les oreilles bien à plat', done: false },
      { id: uid() + 'e', text: 'Broder le nez et les yeux, coudre la queue', done: false },
    ],
  }
  // exemple : le museau est commencé
  p.roundsDone = parsePattern(p.text).slice(0, 7).map((r) => r.key)
  return normalizePattern(p)
}

export function heartPattern() {
  return normalizePattern({
    id: uid(),
    name: 'Coussin cœur amigurumi (patron original)',
    description: 'Exemple original fourni avec l\'application : cœur à deux lobes avec pointe en dessous, en pièces séparées ou en un seul morceau selon la méthode choisie. Crochet 4 mm, fil laine rouge, environ 15 cm de large. Modifie-le ou supprime-le librement !',
    tags: ['amigurumi', 'cœur', 'exemple', 'débutant'],
    createdAt: new Date().toISOString(),
    hook: '4 mm',
    yarn: 'Laine rouge',
    text: 'Coussin cœur amigurumi — crochet 4 mm, fil laine rouge, largeur ≈ 15 cm.\nTravailler en spirale, sans joindre les rangs. Bourrer au fur et à mesure.\n\nLOBE GAUCHE\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)\nR4 : *2 ms, aug* x6 (24)\nR5-R7 : 24 ms\nR8 : *5 ms, aug* x4 (28)\nR9-R10 : 28 ms\nNe pas fermer, mettre en attente. Bourrer légèrement.\n\nLOBE DROIT (identique au lobe gauche)\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)\nR4 : *2 ms, aug* x6 (24)\nR5-R7 : 24 ms\nR8 : *5 ms, aug* x4 (28)\nR9-R10 : 28 ms\nNe pas fermer, mettre en attente. Bourrer légèrement.\n\nASSEMBLAGE DES LOBES\nAligner les deux lobes côte à côte, coudre les côtés intérieurs sur 8 mailles pour former le haut du cœur (le creux central).\n\nCORPS DU CŒUR (suite sur les 2 lobes assemblés)\nR11 : 48 ms autour de l\'ensemble des deux lobes (48)\nR12-R13 : 48 ms\nR14 : *6 ms, dim* x6 (42)\nR15 : 42 ms\nR16 : *5 ms, dim* x6 (36)\nR17 : 36 ms\nR18 : *4 ms, dim* x6 (30)\nR19 : 30 ms\nR20 : *3 ms, dim* x6 (24)\nR21 : 24 ms\nR22 : *2 ms, dim* x6 (18)\nR23 : 18 ms\nR24 : *1 ms, dim* x6 (12)\nR25 : dim dans chaque maille (6)\nBourrer fermement, fermer, rentrer le fil. Terminé ! ❤️',
    checklist: [
      { id: uid() + 'h1', text: 'Coudre les deux lobes sur 8 mailles', done: false },
      { id: uid() + 'h2', text: 'Bourrer fermement avant la pointe', done: false },
      { id: uid() + 'h3', text: 'Rentrer les fils', done: false },
    ],
  })
}

export function samplePatterns() {
  return [samplePattern(), heartPattern()]
}

/**
 * @typedef {object} ChecklistItem
 * @property {string} id
 * @property {string} text
 * @property {boolean} done
 *
 * @typedef {object} Pattern
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string[]} tags
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} hook       taille de crochet
 * @property {string} yarn       fil
 * @property {'auto' | 'us' | 'uk'} notation
 * @property {number} size       index de la taille choisie (patrons multi-tailles)
 * @property {string} text
 * @property {ChecklistItem[]} checklist  étapes libres
 * @property {string[]} roundsDone        clés des rangs terminés (visualiseur / compteur)
 * @property {number} stitchCounter       compteur de mailles du rang en cours
 * @property {string | null} imageId      image (IndexedDB)
 * @property {string | null} thumb        miniature JPEG (data:) pour la grille
 * @property {string | null} fileId       fichier joint (IndexedDB)
 * @property {string | null} fileName
 * @property {string | null} fileType
 * @property {string | null} [image]      ancien format (data:), migré vers IndexedDB
 * @property {string | null} [fileData]   ancien format (data:), migré vers IndexedDB
 */

const str = (v) => (typeof v === 'string' ? v : '')

/**
 * Complète les champs manquants (données anciennes ou importées), sépare la progression
 * des rangs des étapes libres et migre les anciens identifiants « round-{index} ».
 * @param {any} p
 * @returns {Pattern}
 */
export function normalizePattern(p) {
  /** @type {Pattern} */
  const pattern = {
    id: str(p.id) || uid(),
    name: str(p.name) || 'Patron sans nom',
    description: str(p.description),
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    createdAt: str(p.createdAt) || new Date().toISOString(),
    updatedAt: str(p.updatedAt) || str(p.createdAt) || new Date().toISOString(),
    hook: str(p.hook),
    yarn: str(p.yarn),
    notation: ['us', 'uk'].includes(p.notation) ? p.notation : 'auto',
    size: Number.isInteger(p.size) && p.size > 0 ? p.size : 0,
    text: str(p.text),
    checklist: [],
    roundsDone: Array.isArray(p.roundsDone) ? p.roundsDone.filter((k) => typeof k === 'string') : [],
    stitchCounter: Number.isInteger(p.stitchCounter) && p.stitchCounter > 0 ? p.stitchCounter : 0,
    imageId: str(p.imageId) || null,
    thumb: str(p.thumb) || null,
    fileId: str(p.fileId) || null,
    fileName: str(p.fileName) || null,
    fileType: str(p.fileType) || null,
  }
  if (str(p.image).startsWith('data:')) pattern.image = p.image
  if (str(p.fileData).startsWith('data:')) pattern.fileData = p.fileData

  const items = Array.isArray(p.checklist) ? p.checklist : []
  let rounds = null
  const done = new Set(pattern.roundsDone)
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue
    const item = { id: str(raw.id) || uid(), text: String(raw.text ?? ''), done: !!raw.done }
    // les rangs cochés étaient auparavant mélangés aux étapes
    if (item.id.startsWith('round-')) {
      const legacy = item.id.match(/^round-(\d+)$/)
      if (legacy) {
        rounds ??= parsePattern(pattern.text, parseOptions(pattern))
        const r = rounds[parseInt(legacy[1], 10)]
        if (r && item.done) done.add(r.key)
      } else if (item.done) done.add(item.id)
      continue
    }
    pattern.checklist.push(item)
  }
  pattern.roundsDone = [...done]
  return pattern
}

export function loadPatterns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data)) return data.filter((p) => p && typeof p === 'object').map(normalizePattern)
    }
  } catch {
    // stockage corrompu ou inaccessible : on repart des exemples
  }
  const initial = samplePatterns()
  savePatterns(initial)
  return initial
}

/** @returns {boolean} false si le navigateur a refusé l'écriture (quota dépassé…) */
export function savePatterns(patterns) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns))
    return true
  } catch {
    return false
  }
}

/**
 * Déplace les fichiers encore stockés en data: (ancien format, import) vers IndexedDB.
 * @param {Pattern} p
 * @returns {Promise<Partial<Pattern> | null>} les champs à mettre à jour, ou null
 */
export async function migratePatternAssets(p) {
  if (!p.image && !p.fileData) return null
  /** @type {Partial<Pattern>} */
  const patch = { image: undefined, fileData: undefined }
  if (p.image) {
    patch.imageId = await putAsset(p.image)
    patch.thumb = await makeThumbnail(p.image)
  }
  if (p.fileData) {
    patch.fileId = await putAsset(p.fileData)
    patch.fileType = p.fileData.match(/^data:([^;,]+)/)?.[1] ?? null
  }
  return patch
}

/** Sauvegarde complète : les fichiers sont réintégrés en data: pour être portables. */
export async function exportPatterns(patterns) {
  const full = []
  for (const p of patterns) {
    const { imageId, fileId, thumb: _thumb, ...rest } = p
    full.push({
      ...rest,
      image: p.image || (await getAssetDataUrl(imageId)),
      fileData: p.fileData || (await getAssetDataUrl(fileId)),
    })
  }
  const blob = new Blob([JSON.stringify({ app: 'mon-crochet', version: 2, patterns: full }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mon-crochet-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Lit un fichier de sauvegarde (format d'export, ou simple tableau de patrons). @param {Blob} file */
export async function importPatterns(file) {
  const data = JSON.parse(await file.text())
  const list = Array.isArray(data) ? data : data?.patterns
  if (!Array.isArray(list)) throw new Error('Format de fichier non reconnu')
  return list.filter((p) => p && typeof p === 'object').map(normalizePattern)
}

/** @param {string} src @returns {Promise<HTMLImageElement>} */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = src
  })
}

/** @param {string} src @param {number} maxSize @param {string} type */
async function resize(src, maxSize, type) {
  const img = await loadImage(src)
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return src
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(type, 0.82)
}

/** Miniature JPEG légère (gardée dans localStorage pour afficher la grille instantanément). @param {string} dataUrl */
export async function makeThumbnail(dataUrl, maxSize = 360) {
  if (typeof document === 'undefined') return null
  try {
    return await resize(dataUrl, maxSize, 'image/jpeg')
  } catch {
    return null
  }
}

/** Réduit une image (max `maxSize` px) avant de la stocker. @param {File} file */
export async function compressImage(file, maxSize = 1600) {
  const dataUrl = await fileToDataUrl(file)
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') return dataUrl
  try {
    const out = await resize(dataUrl, maxSize, file.type === 'image/png' ? 'image/png' : 'image/jpeg')
    return out.length < dataUrl.length ? out : dataUrl
  } catch {
    return dataUrl
  }
}
