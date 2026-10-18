# Revue de code — octobre 2026

Revue complète de la base de code avant la refonte visuelle (état de `main` après la PR #6),
avec les décisions prises et ce qui a été corrigé dans cette PR.

## 1. Pile technique : faut-il en changer ?

| Élément | Avant | Décision | Pourquoi |
|---|---|---|---|
| Langage | JavaScript, JSDoc `@ts-check` sur 5 modules | **TypeScript strict partout** | Le parseur et le modèle de données ont grossi ; la moitié du code avait déjà des types en commentaires. Le compilateur attrape maintenant les champs mal nommés, les `null` oubliés, etc. |
| Moteur 3D | Moteur maison sur canvas 2D (algorithme du peintre) | **three.js (WebGL)**, chargé à la demande | Pas de tampon de profondeur (pièces qui se chevauchent mal), tri de toutes les faces à chaque image, ni texture, ni ombrage lissé, ni ombres : impossible d'obtenir un rendu « réaliste ». three.js est isolé dans son propre fichier (~143 ko gzip) téléchargé seulement à l'ouverture de l'onglet 3D. |
| Tests unitaires | `node:test` | **Vitest** | Exécute le TypeScript directement et partage la configuration de Vite. |
| Icônes | Émojis | **lucide-react** | Rendu homogène sur tous les systèmes ; seules les icônes utilisées sont incluses. |
| UI | React 19 + CSS à la main | **Conservé**, CSS réorganisé en jetons / composants / vues | Tailwind, un routeur ou une bibliothèque d'état n'apporteraient rien à cette taille. |
| Stockage | localStorage + IndexedDB | **Conservé** | Adapté à une application sans serveur. |

## 2. Constats

Gravité : 🔴 bug ou faille, 🟠 défaut visible, 🟡 dette / qualité.

### Sécurité
- 🔴 **Exécution de script via un fichier joint.** Un fichier HTML ou SVG joint (ou contenu dans
  une sauvegarde importée) était ouvert depuis une URL `blob:` avec son type d'origine : il
  s'exécutait avec l'origine de l'application et pouvait lire toutes les données.
  → Les fichiers ne sont servis que comme PDF, image matricielle ou texte (`safeMimeType`) ;
  le reste est téléchargé. Les images SVG sont converties en PNG à l'import. Test e2e dédié.
- 🟠 Les données importées n'étaient pas toutes validées : une « miniature » pouvait contenir
  n'importe quelle URL, les couleurs n'étaient pas vérifiées. → `normalizePattern` n'accepte
  qu'une image `data:image/(jpeg|png|webp)` et des couleurs `#rrggbb`.

### Rendus
- 🔴 3D : pas de tampon de profondeur → pièces qui se traversent quand on tourne ; recalcul et
  tri de toutes les faces à chaque image (≈ 60 × 4 000 faces/s).
- 🟠 3D : pièces simplement posées côte à côte, couleur arbitraire, pas de texture : rien ne
  ressemblait à l'objet fini.
- 🟠 2D : seul le diagramme à symboles existait ; aucune vue du tissu lui-même.

### Performance
- 🟠 Le compteur de mailles réécrivait toute la bibliothèque (miniatures comprises) dans
  localStorage à **chaque** tap. → Écriture regroupée (400 ms) et forcée à la fermeture /
  mise en arrière-plan de la page.
- 🟡 Le parseur est appelé à chaque rendu : déjà mis en cache par texte et options (`roundsOf`).

### Accessibilité et ergonomie
- 🟠 Carte de patron : `div role=button` contenant d'autres boutons (interactifs imbriqués,
  mal lus par les lecteurs d'écran). → Article avec un lien « étendu » et un menu séparé.
- 🟠 Onglets sans `aria-controls` / `tabpanel` ni navigation aux flèches. → Motif WAI-ARIA complet.
- 🟠 `window.confirm()` natif pour les suppressions. → Boîte de dialogue de l'application,
  suppression annulable.
- 🟠 Formulaire en fenêtre maison avec piège à focus manuel. → `<dialog>` natif (`showModal`) :
  focus, fond inerte et Échap gérés par le navigateur ; plein écran sur téléphone.
- 🟡 Sur téléphone, l'en-tête du patron occupait la moitié de l'écran sur chaque onglet ;
  les onglets étaient en haut, loin du pouce. → Barre d'onglets en bas, en-tête réduit.

### Structure du code
- 🟡 Un seul fichier CSS de 1 300 lignes, couleurs en dur. → Jetons de design + 3 feuilles.
- 🟡 Composants à plat dans `src/`. → `domain/` (parseur, pièces, couleurs, progression),
  `storage/`, `render2d/`, `render3d/`, `ui/` (composants génériques), `features/`.
- 🟡 Modèle 3D et rendu mélangés. → `render3d/model.ts` est pur (testé sans navigateur),
  `Viewer3D.tsx` ne fait que l'afficher.
- 🟡 Le service worker gardait indéfiniment l'ancien cache. → Version de cache incrémentée.

### Parseur (toujours solide)
Rien de bloquant. Ajouts : `splitSections` (texte de chaque pièce, utilisé pour les couleurs),
`parseCords` (chaînettes hors rangs : queues, cordons). Limites connues inchangées : mailles
dans les arceaux comptées sans contrôle, patrons à motifs de couleurs non gérés.

## 3. Rendus réalistes : comment ça marche

### 3D (`render3d/`)
1. **Profil** : chaque rang devient un anneau de rayon *mailles / 2π* ; l'écart vertical
   entre deux rangs suit la hauteur réelle des mailles (ms, db, br…) le long du tissu, ce qui
   reproduit le fait qu'un rond à 6 augmentations par rang reste presque plat. Les pièces
   rembourrées sont légèrement tendues puis lissées comme sous la pression du rembourrage ;
   leurs extrémités fermées reçoivent un petit dôme.
2. **Assemblage** déduit des noms de pièces : la tête sur le corps, les oreilles en haut
   (aplaties si le patron dit « à plat »), les bras sur les côtés, les jambes dessous, la queue
   (chaînette) qui s'enroule au sol, les lobes du cœur sous le corps crocheté autour d'eux,
   un bonnet calotte en haut. Les yeux et le nez sont ajoutés si le texte les mentionne.
3. **Matière** : une texture procédurale de vraies mailles en V (brins torsadés, creux sombres)
   donne le relief (normal map) et l'ombrage ; reflet « velours » des fibres (`sheen`),
   éclairage studio, ombre portée douce. La texture se répète exactement une fois par maille
   du patron.
4. **Couleur du fil** lue dans le texte (« coton gris », « nez rose »), modifiable par pièce.

### 2D (`render2d/fabric.ts`)
Vue dépliée de chaque pièce : chaque rang est une rangée de vraies mailles dessinées brin par
brin (ombre, corps, reflet, torsades), du premier rang en bas au dernier en haut ; les
augmentations s'ouvrent en éventail, les diminutions se referment. Les rangs non terminés sont
estompés. Le diagramme à symboles reste disponible.

## 4. Suite : fonctionnalités et qualité

- **Assemblage piloté par une table** (`ASSEMBLY` dans `render3d/model.ts`) : sorte de pièce →
  position sur le corps, au lieu d'une cascade de conditions ; les placements manuels
  (`pattern.placements`) passent avant l'estimation.
- **Résilience** : chaque onglet est isolé par un `ErrorBoundary` ; la perte du contexte WebGL
  (fréquente sur téléphone) affiche « Relancer l'aperçu » au lieu d'un canvas noir.
- **Performance** : profils de pièces mémorisés par rang, géométries three.js réutilisées
  d'une position du curseur « construction » à l'autre (et libérées quand elles ne servent plus).
- **Accessibilité** : l'aperçu 3D se pilote au clavier (flèches, +/−, 0).
- **Tests** : modules purs (fil, chronomètre, partage, fusion de synchronisation, rappel, nettoyage
  PDF, placement, couleurs de sommets), parcours e2e de chaque fonctionnalité, comparaison d'images
  des rendus tissu et 3D, complétude des traductions (`scripts/i18n-keys.ts`).
