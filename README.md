# 🧶 Mon Crochet

Site web simple pour gérer sa collection de patrons de crochet, suivre sa progression rang par rang
et visualiser ses patrons en graphiques 2D et en aperçu 3D. Aucune inscription, aucun serveur :
tout est enregistré dans le navigateur.

## Fonctionnalités

- **Collection** : grille avec miniature, tags et barre de progression ; recherche et filtres
  (tous / à commencer / en cours / terminés)
- **Patron** : nom, description, tags, texte, fichier joint (PDF, image ou texte — aperçu intégré) et photo
  (réduite automatiquement pour économiser le stockage)
- **Progression** : liste d'étapes cochables, synchronisée avec les rangs du visualiseur
- **📊 Visualiseur de rangs** : un graphique circulaire par rang avec les symboles internationaux
  (✕ ms, T db, Ŧ br, V aug, Λ dim…), regroupés par pièce, contrôle automatique des comptes,
  bouton « Terminé jusqu'ici »
- **🧶 Aperçu 3D** : chaque pièce du patron est reconstruite à partir des comptes de mailles
  (rotation à la souris / au doigt, zoom, pièces en plusieurs exemplaires « (x2) »)
- **Sauvegarde** : export / import JSON de toute la collection ; deux patrons d'exemple originaux
  (souris et cœur) restaurables à tout moment
- Lien direct vers un patron (`#/patron/<id>`), bouton retour du navigateur, thème sombre automatique

## Écrire un patron reconnu par le visualiseur

Un rang par ligne ; les titres de pièce en MAJUSCULES (ou terminés par « : ») :

```
TÊTE
R1 : 6 ms dans un anneau magique (6)
R2 : aug dans chaque maille (12)
R3 : *1 ms, aug* x6 (18)
R4-R6 : 18 ms
OREILLES (x2)
Rnd 1: 6 sc in magic ring (6)
Rnd 2: (sc, inc) x3 (9)
```

- Préfixes : `R`, `Rang`, `Tour`, `Rnd`, `Round`, `Row` ; plages `R4-R6`, `Rangs 4 à 6`, `Rnd 4-Rnd 6`
- Notations : française (`ms`, `db`, `br`, `mc`, `ml`, `aug`, `dim`), US (`sc`, `hdc`, `dc`, `sl st`,
  `inc`, `dec`, `sc2tog`…), UK (détectée si le texte mentionne « UK terms » ou `htr`) et XVA (`X`, `V`, `A`)
- Répétitions `*…* x6`, `(…) x6`, `[…] x6`, `… 6 fois`, « dans chaque maille », « around »
- Le compte attendu `(18)` ou `[18]` en fin de ligne est vérifié, ainsi que la cohérence avec le rang précédent

## Développement

```bash
npm install
npm run dev      # serveur de développement
npm test         # tests du parseur, du moteur 3D et du stockage (node:test)
npm run lint     # oxlint
npm run build    # build de production dans dist/
```

Le site est déployé automatiquement sur GitHub Pages (GitHub Actions) à chaque push sur `main` ;
les pull requests sont vérifiées (lint, tests, build) sans être déployées.

## Structure

- `src/App.jsx` — état global, vue collection / détail, routage par ancre, export / import
- `src/PatternCard.jsx`, `src/PatternDetail.jsx`, `src/PatternForm.jsx` — interface
- `src/patternParser.js` — parseur de patrons (rangs, sections, mailles, répétitions, validation)
- `src/Visualizer.jsx`, `src/RoundChart.jsx`, `src/StitchGlyph.jsx` — graphiques SVG des rangs
- `src/engine3d.js`, `src/Amigurumi3D.jsx` — moteur 3D maison sur canvas 2D (sans dépendance)
- `src/storage.js` — persistance localStorage, migration, patrons d'exemple, fichiers
- `tests/` — tests unitaires

## Limitations connues

- Stockage local au navigateur (~5 Mo) : pas de synchronisation entre appareils — utilisez l'export
- Le parseur ne gère pas les mailles travaillées dans des arceaux, ni les patrons multi-tailles `(80, 88, 96)`
- L'aperçu 3D empile des anneaux de révolution : c'est une silhouette, pas un rendu réaliste
