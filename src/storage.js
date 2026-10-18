import { parsePattern } from './patternParser.js'

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
  return {
    id: uid(),
    name: 'Souris amigurumi (patron original)',
    description: 'Exemple original fourni avec l\'application : souris avec museau effilé, grandes oreilles et queue. Crochet 3 mm, coton, environ 12 cm. Modifie-le ou supprime-le librement !',
    tags: ['amigurumi', 'souris', 'exemple'],
    createdAt: new Date().toISOString(),
    image: null,
    fileName: null,
    fileData: null,
    text: 'Souris amigurumi — crochet 3 mm, fil coton, hauteur ≈ 12 cm.\nTravailler en spirale, sans joindre les rangs. Bourrer au fur et à mesure.\n\nMUSEAU (pointe du nez — début du corps)\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)\nR4 : *2 ms, aug* x6 (24)\nR5 : *3 ms, aug* x6 (30)\nR6 : *4 ms, aug* x6 (36)\nR7-R10 : 36 ms\n\nCORPS (suite du museau, s\'évase vers l\'arrière)\nR11-R13 : 36 ms\nR14 : *4 ms, dim* x6 (30)\nR15 : 30 ms\nR16 : *3 ms, dim* x6 (24)\nR17 : 24 ms\nR18 : *2 ms, dim* x6 (18)\nR19 : 18 ms\nR20 : *1 ms, dim* x6 (12)\nR21 : dim dans chaque maille (6)\nFermer, bourrer fermement, rentrer le fil.\n\nOREILLES (x2, grandes oreilles rondes)\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)\nR4 : *2 ms, aug* x6 (24)\nR5-R6 : 24 ms\nFermer à plat, aplatir en demi-disque, coudre de chaque côté de la tête.\n\nQUEUE (fine et longue)\nChaîner 40 ml, 1 mc dans la 2e maille depuis le crochet puis dans chaque maille suivante. Coudre à l\'arrière du corps.\n\nASSEMBLAGE\nCoudre les oreilles bien à plat sur les côtés de la tête (elles doivent dépasser largement).\nBroder le nez rose à la pointe du museau, deux yeux noirs au-dessus.\nCoudre la queue à l\'arrière. Terminé ! 🐭',
    checklist: [
      { id: uid() + 'a', text: 'Museau : rangs 1 à 7', done: true },
      { id: uid() + 'b', text: 'Museau : rangs 8 à 10', done: true },
      { id: uid() + 'c', text: 'Corps : rangs 11 à 16', done: false },
      { id: uid() + 'd', text: 'Corps : rangs 17 à 21 et fermeture', done: false },
      { id: uid() + 'e', text: 'Oreilles (x2)', done: false },
      { id: uid() + 'f', text: 'Queue', done: false },
      { id: uid() + 'g', text: 'Assemblage : oreilles, yeux, nez, queue', done: false },
    ],
  }
}

export function heartPattern() {
  return {
    id: uid(),
    name: 'Coussin cœur amigurumi (patron original)',
    description: 'Exemple original fourni avec l\'application : cœur à deux lobes avec pointe en dessous, en pièces séparées ou en un seul morceau selon la méthode choisie. Crochet 4 mm, fil laine rouge, environ 15 cm de large. Modifie-le ou supprime-le librement !',
    tags: ['amigurumi', 'cœur', 'exemple', 'débutant'],
    createdAt: new Date().toISOString(),
    image: null,
    fileName: null,
    fileData: null,
    text: 'Coussin cœur amigurumi — crochet 4 mm, fil laine rouge, largeur ≈ 15 cm.\nTravailler en spirale, sans joindre les rangs. Bourrer au fur et à mesure.\n\nLOBE GAUCHE\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)\nR4 : *2 ms, aug* x6 (24)\nR5-R7 : 24 ms\nR8 : *5 ms, aug* x4 (28)\nR9-R10 : 28 ms\nNe pas fermer, mettre en attente. Bourrer légèrement.\n\nLOBE DROIT (identique au lobe gauche)\nR1 : 6 ms dans un anneau magique (6)\nR2 : aug dans chaque maille (12)\nR3 : *1 ms, aug* x6 (18)\nR4 : *2 ms, aug* x6 (24)\nR5-R7 : 24 ms\nR8 : *5 ms, aug* x4 (28)\nR9-R10 : 28 ms\nNe pas fermer, mettre en attente. Bourrer légèrement.\n\nASSEMBLAGE DES LOBES\nAligner les deux lobes côte à côte, coudre les côtés intérieurs sur 8 mailles pour former le haut du cœur (le creux central).\n\nCORPS DU CŒUR (suite sur les 2 lobes assemblés)\nR11 : 48 ms autour de l\'ensemble des deux lobes (48)\nR12-R13 : 48 ms\nR14 : *6 ms, dim* x6 (42)\nR15 : 42 ms\nR16 : *5 ms, dim* x6 (36)\nR17 : 36 ms\nR18 : *4 ms, dim* x6 (30)\nR19 : 30 ms\nR20 : *3 ms, dim* x6 (24)\nR21 : 24 ms\nR22 : *2 ms, dim* x6 (18)\nR23 : 18 ms\nR24 : *1 ms, dim* x6 (12)\nR25 : dim dans chaque maille (6)\nBourrer fermement, fermer, rentrer le fil. Terminé ! ❤️',
    checklist: [
      { id: uid() + 'h1', text: 'Lobe gauche : rangs 1 à 10', done: false },
      { id: uid() + 'h2', text: 'Lobe droit : rangs 1 à 10', done: false },
      { id: uid() + 'h3', text: 'Assemblage des deux lobes', done: false },
      { id: uid() + 'h4', text: 'Corps : rangs 11 à 17', done: false },
      { id: uid() + 'h5', text: 'Corps : rangs 18 à 25 et fermeture', done: false },
    ],
  }
}

export function samplePatterns() {
  return [samplePattern(), heartPattern()]
}

// Complète les champs manquants (données anciennes ou importées) et migre
// les anciens identifiants de rangs « round-{index} » vers des clés stables.
export function normalizePattern(p) {
  const pattern = {
    id: p.id || uid(),
    name: String(p.name || 'Patron sans nom'),
    description: p.description || '',
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    createdAt: p.createdAt || new Date().toISOString(),
    image: p.image || null,
    fileName: p.fileName || null,
    fileData: p.fileData || null,
    text: p.text || '',
    checklist: Array.isArray(p.checklist)
      ? p.checklist.map((i) => ({ id: i.id || uid(), text: String(i.text ?? ''), done: !!i.done }))
      : [],
  }
  if (pattern.checklist.some((i) => /^round-\d+$/.test(i.id))) {
    const rounds = parsePattern(pattern.text)
    pattern.checklist = pattern.checklist.map((i) => {
      const m = i.id.match(/^round-(\d+)$/)
      const r = m && rounds[parseInt(m[1], 10)]
      return r ? { ...i, id: r.key, text: roundItemText(r) } : i
    })
  }
  return pattern
}

export function roundItemText(round) {
  return round.section ? `${round.label} — ${round.section}` : round.label
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

export function exportPatterns(patterns) {
  const blob = new Blob([JSON.stringify({ app: 'mon-crochet', version: 1, patterns }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mon-crochet-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Lit un fichier de sauvegarde (format d'export, ou simple tableau de patrons). */
export async function importPatterns(file) {
  const data = JSON.parse(await file.text())
  const list = Array.isArray(data) ? data : data?.patterns
  if (!Array.isArray(list)) throw new Error('Format de fichier non reconnu')
  return list.filter((p) => p && typeof p === 'object').map(normalizePattern)
}

/** Ouvre un fichier stocké en dataURL (les navigateurs bloquent la navigation directe vers data:). */
export function dataUrlToBlobUrl(dataUrl) {
  const [head, body = ''] = dataUrl.split(',')
  const mime = head.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream'
  const bytes = head.includes(';base64') ? atob(body) : decodeURIComponent(body)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return URL.createObjectURL(new Blob([arr], { type: mime }))
}

/** Réduit une image (max `maxSize` px, JPEG/PNG) pour économiser le stockage local. */
export async function compressImage(file, maxSize = 1000) {
  const dataUrl = await fileToDataUrl(file)
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') return dataUrl
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = dataUrl
    })
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const out = file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85)
    return out.length < dataUrl.length ? out : dataUrl
  } catch {
    return dataUrl
  }
}
