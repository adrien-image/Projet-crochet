# 🧶 Mon Crochet

Application web pour gérer sa collection de patrons de crochet, suivre sa progression rang par rang
et voir l'ouvrage fini avant même de commencer : rendu réaliste du tissu en 2D et aperçu 3D de la
pièce assemblée. Aucune inscription, aucun serveur : tout reste dans le navigateur, et l'application
fonctionne hors connexion.

## Fonctionnalités

- **Bibliothèque** : couvertures (photo, ou morceau de tissu généré à la couleur du fil), recherche,
  filtres par progression et par tag, tri
- **Patron** : instructions interactives (on coche un rang directement dans le texte, le rang en cours
  est mis en évidence), **plusieurs photos de l'ouvrage** (galerie, visionneuse, choix de la couverture), matériel, fichier joint (PDF, image ou texte avec aperçu), étapes libres
  modifiables et réordonnables, **estimation du fil** nécessaire (au total et par couleur, d'après les
  mailles et la taille du crochet), **chronomètre** de travail (temps total et sur 7 jours)
- **Compteur** : un rang à la fois, gros anneau de comptage tactile, « Rang terminé — suivant »,
  annulation, écran maintenu allumé, raccourcis clavier, **note et photo par rang**
- **Rangs** : vue **tissu** réaliste (chaque maille dessinée brin par brin, rangs non faits estompés)
  ou **diagramme** à symboles internationaux ; contrôle des comptes ; export SVG et impression
- **3D** : chaque pièce reconstruite à partir des comptes et de la hauteur des mailles, texture de
  vraies mailles, assemblage déduit des noms (tête, oreilles, bras, jambes, queue, yeux, nez…),
  curseur « construction » pour voir la pièce après n'importe quel rang, couleurs du fil
  modifiables, **changements de couleur par rang**, **placement manuel** des pièces (on touche le
  modèle à l'endroit où coudre), contrôle au clavier, image PNG
- **PDF** : le texte d'un PDF joint est extrait automatiquement dans le patron (pdf.js, chargé à la demande)
- **Partage** : lien autonome (le patron compressé dans l'adresse, sans la progression ni les notes)
  ou fichier `.crochet.json`
- **Dupliquer** un patron pour le refaire (de zéro) ou garder une version en cours (avec la progression)
- **Sauvegarde** : export / import JSON complet (photos comprises), suppression annulable, patrons
  d'exemple originaux (souris, cœur, abeille rayée multicolore),
  stockage persistant demandé au navigateur, rappel d'export, **synchronisation facultative avec un
  fichier** (Chrome / Edge : un fichier dans un dossier Drive, Dropbox ou iCloud suffit à retrouver ses
  patrons sur un autre ordinateur)
- **Français / anglais** (langue du navigateur par défaut, modifiable dans le menu)
- Application installable (PWA), liens directs `#/patron/<id>/<onglet>`, thème sombre, barre
  d'onglets en bas sur téléphone

## Écrire un patron reconnu

Un rang par ligne ; les titres de pièce en MAJUSCULES (ou terminés par « : ») :

```
TÊTE (fil beige)
R1 : 6 ms dans un anneau magique (6)
R2 : aug dans chaque maille (12)
R3 : *1 ms, aug* x6 (18)
R4-R6 : 18 ms
OREILLES (x2)
Rnd 1: 6 sc in magic ring (6)
Rnd 2: *sc, inc; rep from * 2 more times (9)
QUEUE
Chaîner 30 ml.
Broder le nez rose, coudre deux yeux noirs.
```

- Préfixes : `R`, `Rang`, `Tour`, `Rnd`, `Round`, `Row` ; plages `R4-R6`, `Rangs 4 à 6`
- Notations : française (`ms`, `db`, `br`, `dbr`, `mc`, `ml`, `aug`, `dim`), US, UK et XVA
- Répétitions `*…* x6`, `(…) x6`, `[…] x6`, `rep from * 5 more times`, « dans chaque maille », « around »
- Comptes `(18)` vérifiés ; multi-tailles `6 (8, 10) sc` ; rangs aller-retour (`Row`, « tourner »)
- Pour la 3D : « (x2) » duplique une pièce, « suite du … » prolonge la précédente, « à plat » aplatit,
  la couleur du fil est lue dans le texte, les noms de pièces guident l'assemblage
- Changements de couleur : légende (`Couleur A : rose`, `MC: grey`), mention dans le rang
  (`R5 : 18 ms en rose`, `Rnd 3: sc around with color A`, `(rouge)`) ou ligne « Changer pour le fil blanc. »

## Développement

```bash
npm install
npm run dev        # serveur de développement
npm test           # tests unitaires (Vitest)
npm run test:e2e   # tests de bout en bout dans Chromium (Playwright)
npm run lint       # oxlint
npm run typecheck  # TypeScript
npm run build      # build de production dans dist/
```

Déploiement automatique sur GitHub Pages à chaque push sur `main` ; les pull requests sont vérifiées
(lint, types, tests unitaires et e2e, build).

## Pile technique

React 19, TypeScript strict, Vite 8, three.js (chargé à la demande), lucide-react, Vitest, Playwright,
oxlint, pdf.js (chargé à la demande). Données dans localStorage (patrons, préférences) et IndexedDB
(photos, fichiers, lien vers le fichier de synchronisation).

Les tests e2e comparent aussi les rendus tissu et 3D à des images de référence
(`e2e/screenshots.spec.ts-snapshots/`) ; après un changement voulu des rendus :
`npx playwright test screenshots --update-snapshots`.

## Structure

```
src/
  domain/      parseur de patrons, pièces, couleurs de fil, progression, fil, chronomètre, types
  storage/     localStorage, IndexedDB, images, exemples, migration, préférences, partage,
               synchronisation, extraction PDF
  i18n/        traductions (le texte français sert de clé ; en.ts pour l'anglais)
  render2d/    rendu tissu (canvas), symboles et export SVG du diagramme
  render3d/    modèle 3D pur (profils, assemblage) + rendu three.js (textures, géométries, scène)
  ui/          composants génériques (dialogue, menu, contrôle segmenté, progression…)
  features/    bibliothèque et écran patron (onglets Patron, Compteur, Rangs, 3D, formulaire)
  hooks/       persistance, routage, messages, wake lock, fichiers, préférences, synchronisation
  styles/      jetons de design, base, composants, vues
tests/         tests unitaires      e2e/   tests Playwright      docs/REVIEW.md   revue de code
```

## Limitations connues

- Données locales au navigateur ; la synchronisation par fichier n'existe que sur Chrome / Edge
  (ailleurs : export / import ou lien de partage)
- La synchronisation transporte la couverture et le fichier joint ; les autres photos (galerie,
  notes de rang) n'y passent qu'en miniature : l'export / import les transporte en entier
- L'assemblage 3D est une estimation à partir des noms de pièces (corrigeable à la main) ; les pièces
  non reconnues sont posées à côté
- Mailles dans les arceaux comptées sans contrôle ; motifs jacquard (plusieurs couleurs dans un même
  rang) non représentés ; un PDF scanné (image) ne contient pas de texte à extraire
- L'estimation du fil est un ordre de grandeur (± 20 %), qui dépend de la tension de chacun
