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
  /** image (IndexedDB) */
  imageId: string | null
  /** miniature JPEG (data:) pour la grille */
  thumb: string | null
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
