# 🧶 Mon Crochet

Site web simple pour gérer sa collection de patrons de crochet, suivre sa progression rang par rang
et visualiser ses patrons en graphiques 2D et en aperçu 3D. Aucune inscription, aucun serveur :
tout est enregistré dans le navigateur, et l'application fonctionne hors connexion.

## Fonctionnalités

- **Collection** : grille avec miniature, tags cliquables, barre de progression ; recherche (nom, tags,
  fil, crochet), filtres (tous / à commencer / en cours / terminés) et tri
- **Patron** : nom, description, crochet, fil, tags, texte, fichier joint (PDF, image ou texte — aperçu
  intégré) et photo ; notation (auto / FR-US / UK) et taille choisies par patron
- **🔢 Compteur** : un rang à la fois, gros compteur de mailles, « Rang terminé → suivant », annulation,
  écran maintenu allumé pendant le crochet (Screen Wake Lock), raccourcis clavier
- **Progression** : rangs terminés et étapes libres suivis séparément ; les étapes se modifient et se
  réordonnent ; les rangs cochés sont retrouvés quand le texte du patron change
- **📊 Rangs** : un graphique par rang avec les symboles internationaux (✕ ms, T db, Ŧ br, V aug, Λ dim…),
  lus dans le sens inverse des aiguilles d'une montre, rangs à plat dessinés en ligne, regroupés par pièce,
  contrôle des comptes ; export SVG et impression
- **🧶 Aperçu 3D** : chaque pièce est reconstruite à partir des comptes de mailles — rayon proportionnel au
  nombre de mailles, inclinaison selon les augmentations (6 aug./rang ≈ disque plat), pièces ouvertes
  vues de l'intérieur, panneaux pour le travail à plat, pièces « (x2) » dupliquées
- **Sauvegarde** : export / import JSON complet (fichiers inclus) ; suppression annulable ;
  deux patrons d'exemple originaux (souris et cœur) restaurables
- Application installable (PWA), lien direct vers un patron (`#/patron/<id>`), thème sombre automatique

## Écrire un patron reconnu par le visualiseur

Un rang par ligne ; les titres de pièce en MAJUSCULES (ou terminés par « : ») :

```
TÊTE
R1 : 6 ms dans un anneau magique (6)
R2 : aug dans chaque maille (12)
R3 : *1 ms, aug* x6 (18)
R4-R6 : 18 ms
CORPS (suite de la tête)
R7 : 18 ms dans le brin arrière
OREILLES (x2)
Rnd 1: 6 sc in magic ring (6)
Rnd 2: *sc, inc; rep from * 2 more times (9)
```

- Préfixes : `R`, `Rang`, `Tour`, `Rnd`, `Round`, `Row` ; plages `R4-R6`, `Rangs 4 à 6`, `Rnd 4-Rnd 6`
- Notations : française (`ms`, `db`, `br`, `dbr`, `mc`, `ml`, `aug`, `dim`), US (`sc`, `hdc`, `dc`, `tr`,
  `sl st`, `inc`, `dec`, `sc2tog`, `sc3tog`…), UK (détectée si le texte mentionne « UK terms » ou `htr`,
  ou choisie dans le formulaire) et XVA (`X`, `V`, `W`, `A`)
- Répétitions `*…* x6`, `(…) x6`, `[…] x6`, `… 6 fois`, `rep from * 5 more times`, « dans chaque maille »,
  « around » ; « 2 ms / 3 ms dans la même maille »
- Le compte attendu `(18)` ou `[18]` est vérifié, ainsi que la cohérence avec le rang précédent de la pièce
- Multi-tailles : `R1: 6 (8, 10) sc (6, 8, 10)` — la taille se choisit dans le formulaire
- Travail à plat : préfixe `Row` ou instruction contenant « turn » / « tourner »
- Une section dont le titre contient « suite du / de la… » prolonge la pièce précédente

## Développement

```bash
npm install
npm run dev        # serveur de développement
npm test           # tests unitaires : parseur, moteur 3D, stockage (node:test)
npm run test:e2e   # tests de bout en bout dans Chromium (Playwright, build + preview)
npm run lint       # oxlint
npm run typecheck  # vérification des types JSDoc (modules « // @ts-check »)
npm run build      # build de production dans dist/
```

Le site est déployé automatiquement sur GitHub Pages (GitHub Actions) à chaque push sur `main` ;
les pull requests sont vérifiées (lint, types, tests unitaires et e2e, build) sans être déployées.

## Structure

- `src/App.jsx` — vue collection / détail ; `src/hooks/` — persistance, routage, messages, focus, wake lock
- `src/PatternCard.jsx`, `src/PatternDetail.jsx`, `src/PatternForm.jsx`, `src/RoundCounter.jsx` — interface
- `src/patternParser.js` — parseur de patrons (rangs, sections, mailles, répétitions, tailles, validation)
- `src/Visualizer.jsx`, `src/RoundChart.jsx`, `src/StitchGlyph.jsx`, `src/glyphs.js`, `src/chartExport.js` —
  graphiques SVG des rangs et export
- `src/engine3d.js`, `src/Amigurumi3D.jsx` — moteur 3D maison sur canvas 2D (sans dépendance)
- `src/storage.js` — patrons dans localStorage, migration, exemples ; `src/assets.js` — fichiers dans IndexedDB
- `public/sw.js`, `public/manifest.webmanifest` — fonctionnement hors connexion
- `tests/` — tests unitaires ; `e2e/` — tests Playwright

## Limitations connues

- Données locales au navigateur : pas de synchronisation entre appareils — utilisez l'export / import
- Les mailles travaillées dans des arceaux sont comptées sans contrôle de cohérence
- L'aperçu 3D empile des anneaux de révolution : une silhouette, pas un rendu réaliste ni l'assemblage
