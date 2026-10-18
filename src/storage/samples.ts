// Patrons d'exemple originaux, écrits pour l'application (libres de droits).
import type { Pattern } from '../domain/types'
import { parsePattern } from '../domain/parser'
import { normalizePattern } from './patterns'
import { uid } from './util'

export function samplePattern(): Pattern {
  const p: Partial<Pattern> & { text: string } = {
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

export function heartPattern(): Pattern {
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

export function samplePatterns(): Pattern[] {
  return [samplePattern(), heartPattern()]
}
