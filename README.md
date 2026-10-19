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
- **PDF** : le texte d'un PDF joint est extrait automatiquement dans le patron (pdf.js, chargé à la demande),
  dans l'ordre de lecture même en plusieurs colonnes, sans les en-têtes / pieds de page répétés ; nom
  (métadonnées, grand titre ou nom du fichier), crochet et fil pré-remplis ; **les photos de l'ouvrage
  sont importées** (couverture + galerie, sans les fonds de page ni les logos) ; **PDF scannés lus par
  OCR** (Tesseract.js, français et anglais, servi par l'application et chargé seulement pour un scan),
  avec correction des erreurs de lecture courantes (« | aug » pour « 1 aug », « R3% » pour « R34 »,
  numéros de rang illisibles déduits de la suite) ; bouton « Lire par OCR » pour un PDF dont le texte
  extrait est illisible ;
  **écran de vérification** : les pages du PDF à côté des lignes reconnues, rangs dont le compte ne
  tombe pas juste signalés, chaque ligne corrigeable sur place
- **Fils à prévoir** : pour chaque couleur, son nom dans le patron, les pièces concernées, la longueur
  (marge comprise) et le poids ; épaisseur de fil conseillée d'après le crochet (catégories 1 à 6) et
  matière (coton, laine, chenille…) ; une couleur que le patron ne précise pas est marquée
  « supposée », avec un sélecteur de couleur par pièce
- **Taille et crochet** : taille finale (annoncée par le patron, ou estimée d'après les mailles) et ce
  qu'elle devient, avec le fil et son épaisseur, si l'on change de crochet
- **Fiche imprimable** (ou PDF via le navigateur) : photos, matériel, fils à prévoir, étapes, rangs à
  cocher avec leurs notes, diagrammes de chaque pièce
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

- Langues : abréviations et mots courants en français, anglais, espagnol (`pb`, `aum`, `dism`, `vuelta`),
  portugais (`pbx`), allemand (`fM`, `zun`, `abn`, `Runde`), italien (`mb`, `aum`, `dim`, `giro`) et
  néerlandais (`v`, `meerd`, `mind`, `toer`) ; **tableaux** `Rang | Instructions | Mailles` (cellules
  séparées par des tabulations, des `|` ou, dans un PDF, par leur position)
- Préfixes : `R`, `Rang`, `Tour`, `Rnd`, `Round`, `Row` ; plages `R4-R6`, `Rangs 4 à 6` ; ou rangs
  numérotés sans préfixe, courants dans les PDF : `1 – 6 sc into a magic ring (6)`, `4 to 7 – 18 sc`,
  `18 and 19 – 18 sc (2 rows) – stuff the head`
- Titres de pièce en casse mixte juste avant un rang 1 (`Front legs – make 2`, `Body: start at the snout`) ;
  `make 2`, `(x2)` donnent le nombre d'exemplaires
- Répétition implicite : `3 – 1 sc, 1 inc (18)` fait le tour quand le compte annoncé le confirme
- Comptes `= 16 sc`, `R8 - 14 (7 rnds) = 48 sc in each rnd`, plages `R14 & 15` ; couleurs par code
  (`Use color #8008 rock corey`, `Switch to color #8001 white`, `Blanc :`) ; pièces en deux couleurs
  (`Corps x2 (bleu, blanc)`) ; rangs repris plus loin (« Make 2 more rnds joining this part into body »)
- Pour la 3D : tête cousue par son ouverture, museau sous les yeux et truffe au bout, plastron cousu sur
  le ventre, pièces plates rembourrées en deux couches (raie, coussin), traits brodés
- Notations : française (`ms`, `db`, `br`, `dbr`, `mc`, `ml`, `aug`, `dim`), US, UK et XVA
- Répétitions `*…* x6`, `(…) x6`, `[…] x6`, `rep from * 5 more times`, « dans chaque maille », « around »
- Comptes `(18)` vérifiés ; multi-tailles `6 (8, 10) sc` ; rangs aller-retour (`Row`, « tourner »)
- Pour la 3D : « (x2) » duplique une pièce, « suite du … » prolonge la précédente, « à plat » aplatit,
  la couleur du fil est lue dans le texte, les noms de pièces guident l'assemblage, et les rangs cités
  dans les consignes (« Pin the front legs between rows 21 and 22 », « eyes between rows 9 and 10 »)
  placent les pièces et les yeux ; piquants et écailles se posent le long du dos
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
oxlint, pdf.js et Tesseract.js (chargés à la demande ; le moteur OCR et ses langues sont copiés dans
`dist/ocr/` au build et ne sont pas mis en cache à l'installation). Données dans localStorage (patrons, préférences) et IndexedDB
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
  rang) non représentés ; l'OCR d'un scan est à relire (écran de vérification), surtout pour les
  pages manuscrites ou de mauvaise qualité
- L'estimation du fil est un ordre de grandeur (± 20 %), qui dépend de la tension de chacun
