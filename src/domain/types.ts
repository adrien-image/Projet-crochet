export type StitchType = 'sc' | 'hdc' | 'dc' | 'tr' | 'sl' | 'ch' | 'inc' | 'dec' | 'inc3' | 'dec3'
export type Notation = 'auto' | 'us' | 'uk'

export interface Round {
  /** identifiant stable (section + numéro) */
  key: string
  /** « R12 » */
  label: string
  number: number
  /** ligne d'origine du patron */
  text: string
  section: string | null
  /** index de la pièce (une section qui « suit » la précédente garde son index) */
  piece: number
  /** travail à plat (rangs aller-retour) */
  flat: boolean
  /** brin arrière / avant uniquement */
  loop: 'blo' | 'flo' | null
  stitches: StitchType[]
  /** mailles produites */
  count: number
  /** mailles du rang précédent utilisées */
  consumed: number
  prevCount: number | null
  /** compte annoncé « (N) » */
  expected: number | null
  /** couleur de fil du rang (#rrggbb) si le patron en change, sinon null (couleur de la pièce) */
  color: string | null
  /** compte calculé = compte annoncé (ou rien d'annoncé) */
  valid: boolean
  /** mailles consommées = rang précédent de la pièce (null si inconnu) */
  fits: boolean | null
}

/** Chaînette isolée (queue, ficelle…) décrite hors des rangs : « Chaîner 40 ml ». */
export interface Cord {
  section: string | null
  length: number
}

export interface RoundNote {
  text: string
  /** photo (IndexedDB) */
  photoId: string | null
  /** miniature (data:) */
  photoThumb: string | null
  /** sauvegarde importée (data:), migrée vers IndexedDB */
  photoData?: string
}

/** Photo supplémentaire de l'ouvrage (la couverture reste `imageId`). */
export interface PatternPhoto {
  /** image (IndexedDB) ; vide tant qu'une photo importée n'est pas migrée */
  id: string
  /** miniature (data:) */
  thumb: string | null
  /** sauvegarde importée (data:), migrée vers IndexedDB */
  data?: string
}

/** Pièce placée à la main sur l'aperçu 3D (coordonnées du modèle assemblé). */
export interface Placement {
  point: [number, number, number]
  normal: [number, number, number]
}

export interface WorkSession {
  start: string
  seconds: number
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Pattern {
  id: string
  name: string
  description: string
  tags: string[]
  createdAt: string
  updatedAt: string
  /** taille de crochet */
  hook: string
  /** fil */
  yarn: string
  notation: Notation
  /** index de la taille choisie (patrons multi-tailles) */
  size: number
  text: string
  /** étapes libres */
  checklist: ChecklistItem[]
  /** clés des rangs terminés */
  roundsDone: string[]
  /** compteur de mailles du rang en cours */
  stitchCounter: number
  /** couleurs choisies par pièce (libellé de pièce → #rrggbb) */
  pieceColors: Record<string, string>
  /** notes et photos par rang (clé de rang → note) */
  roundNotes: Record<string, RoundNote>
  /** placements manuels en 3D (« libellé#exemplaire » → point d'attache) */
  placements: Record<string, Placement>
  /** temps passé (secondes), hors séance en cours */
  timeSpent: number
  /** début de la séance en cours (chronomètre lancé), ou null */
  timerStartedAt: string | null
  /** dernières séances de travail */
  sessions: WorkSession[]
  /** image (IndexedDB) */
  imageId: string | null
  /** miniature JPEG (data:) pour la grille */
  thumb: string | null
  /** autres photos de l'ouvrage */
  gallery: PatternPhoto[]
  /** fichier joint (IndexedDB) */
  fileId: string | null
  fileName: string | null
  fileType: string | null
  /** ancien format (data:), migré vers IndexedDB */
  image?: string | null
  /** ancien format (data:), migré vers IndexedDB */
  fileData?: string | null
}

export interface ParseOptions {
  notation?: Notation
  size?: number
}
