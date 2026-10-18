# 🧶 Mon Crochet

Application web pour gérer sa collection de patrons de crochet, suivre sa progression rang par rang
et voir l'ouvrage fini avant même de commencer : rendu réaliste du tissu en 2D et aperçu 3D de la
pièce assemblée. Aucune inscription, aucun serveur : tout reste dans le navigateur, et l'application
fonctionne hors connexion.

## Fonctionnalités

- **Bibliothèque** : couvertures (photo, ou morceau de tissu généré à la couleur du fil), recherche,
  filtres par progression et par tag, tri
- **Patron** : instructions interactives (on coche un rang directement dans le texte, le rang en cours
  est mis en évidence), photo, matériel, fichier joint (PDF, image ou texte avec aperçu), étapes libres
  modifiables et réordonnables
- **Compteur** : un rang à la fois, gros anneau de comptage tactile, « Rang terminé — suivant »,
  annulation, écran maintenu allumé, raccourcis clavier
- **Rangs** : vue **tissu** réaliste (chaque maille dessinée brin par brin, rangs non faits estompés)
  ou **diagramme** à symboles internationaux ; contrôle des comptes ; export SVG et impression
- **3D** : chaque pièce reconstruite à partir des comptes et de la hauteur des mailles, texture de
  vraies mailles, assemblage déduit des noms (tête, oreilles, bras, jambes, queue, yeux, nez…),
  curseur « construction » pour voir la pièce après n'importe quel rang, couleurs du fil
  modifiables, image PNG
- **Sauvegarde** : export / import JSON complet, suppression annulable, patrons d'exemple originaux
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
oxlint. Données dans localStorage (patrons) et IndexedDB (photos, fichiers).

## Structure

```
src/
  domain/      parseur de patrons, pièces, couleurs de fil, progression, types
  storage/     localStorage, IndexedDB, images, exemples, migration des anciennes données
  render2d/    rendu tissu (canvas), symboles et export SVG du diagramme
  render3d/    modèle 3D pur (profils, assemblage) + rendu three.js (textures, géométries, scène)
  ui/          composants génériques (dialogue, menu, contrôle segmenté, progression…)
  features/    bibliothèque et écran patron (onglets Patron, Compteur, Rangs, 3D, formulaire)
  hooks/       persistance, routage, messages, wake lock, fichiers
  styles/      jetons de design, base, composants, vues
tests/         tests unitaires      e2e/   tests Playwright      docs/REVIEW.md   revue de code
```

## Limitations connues

- Données locales au navigateur : pas de synchronisation entre appareils (utilisez l'export)
- L'assemblage 3D est une estimation à partir des noms de pièces ; les pièces non reconnues
  sont posées à côté
- Mailles dans les arceaux comptées sans contrôle ; motifs de couleurs non représentés
