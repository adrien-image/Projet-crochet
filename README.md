# 🧶 Mon Crochet

Site web simple pour gérer sa collection de patrons de crochet et suivre sa progression.

## Fonctionnalités (v1)

- **Ajouter un patron** : nom, description, tags, texte du patron, fichier joint (PDF, image, texte) et image d'aperçu
- **Visualiser sa collection** sous forme de grille avec miniature et barre de progression
- **Rechercher et filtrer** (tous / en cours / terminés)
- **Ouvrir un patron** : le texte (ou fichier) et l'image s'affichent côte à côte
- **Suivre sa progression** : liste d'étapes cochables, sauvegardées automatiquement dans le navigateur (localStorage)
- Un **patron d'exemple** est créé au premier lancement pour découvrir l'interface

> Les données sont stockées localement dans votre navigateur : aucun compte requis, mais changez de navigateur/ordinateur = données différentes.

## Développement

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Le site est déployé automatiquement sur GitHub Pages via GitHub Actions à chaque push sur `main`.

## Structure

- `src/App.jsx` — vue collection + vue détail, état global
- `src/PatternCard.jsx` — carte de la grille
- `src/PatternDetail.jsx` — vue détaillée d'un patron (texte, image, checklist)
- `src/PatternForm.jsx` — formulaire de création/modification
- `src/storage.js` — persistance localStorage + patron d'exemple
