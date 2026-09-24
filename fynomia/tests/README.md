# Tous les contrôles, une commande

```bash
cd fynomia/tests
npm install        # une fois : installe playwright-core
npm test           # tout : paquet, comptes, interface (≈ 12 min)
npm run test:rapide  # la matrice de rendus sur 3 métiers au lieu de 14 (≈ 5 min)
```

Le code de sortie vaut 1 à la première croix. Une seule suffit à arrêter une
mise en ligne.

## Ce qui est vérifié

1. **Le paquet** — `build.mjs` construit `dist/fynomia.html`, et le JavaScript
   livré ne contient aucun octet non ASCII (un caractère accentué dans une
   expression régulière corromprait le fichier sans bruit).
2. **Les comptes** — les scripts de `verification/` : identités comptables,
   fiscalité, paie, bilan, charges indexées, paramètres 2026.
3. **L'interface**, dans un vrai navigateur (`ui/`) :

| Suite | Ce qu'elle prouve |
|---|---|
| `01-rendus` | 14 métiers × 9 pages × 3 formats : un titre, aucun défilement horizontal, aucune valeur coupée, aucune erreur JavaScript |
| `02-exemple` | le plan d'exemple complet, sur les 9 pages et 3 formats |
| `03-onglets` | chaque onglet de chaque module s'ouvre et devient actif |
| `04-defilement` | la page ne se raccourcit pas sous le doigt, le défilement va au bout, rien ne déborde |
| `05-propagation` | un prix, un salaire, une charge qui changent font bouger les états financiers qui en dépendent |
| `06-paie` | le coût d'un salaire suit la frappe, sans quitter le champ |
| `07-syntheses` | la synthèse suit le plan ; l'essai dit mot pour mot la même chose ; tout se trace au défilement |
| `08-interactions` | voyage vers une page, carte ouverte, suggestion acceptée, cases d'avancement, financement, Mon projet, bilan équilibré |
| `09-livre` | le fichier livré fonctionne seul |
| `10-pilotage` | une saisie (la description) fait avancer le compteur et coche le pilotage sans changer de page ; un palier fermé ne montre aucune ligne, ouvert il les montre toutes, titres en grand ; l'avancement du dossier est dans le pilotage ; Tab garde le curseur |
| `11-etapes` | dans le pilotage, chacune des trente lignes du dossier, cliquée, mène à sa page, trouve son champ et l'entoure (métier neuf et exemple) |
| `12-garde-fous` | un chiffre hors de proportion se dit sous le champ, en tête de page et des synthèses ; le verdict passe à « À vérifier » ; aucun garde-fou sur un plan neuf ; une charge démesurée se dit sur sa ligne et « Je valide » la fait oublier tant que le montant ne change pas |
| `13-ajouts` | charge, investissement, poste, offre : l'ajout fait jaillir ses icônes, la ligne créée arrive éclairée ; la carte ouverte est soulevée, sans halo coloré ni animation en boucle |
| `14-graphiques` | tout ce qui se révèle se révèle, et seulement à l'arrivée (ni au chargement, ni quand seul le bord dépasse) ; parties propres à chaque onglet des états financiers ; exercice partagé ; chiffres des pages de saisie en bandeau d'une ligne, titre à gauche, « i » sans texte ; zoom mois par mois ; survol ; rien ne déborde au téléphone |
| `15-pitch` | l'onglet pitch : le récit en analyse stratégique (cinq chapitres, un objectif chacun, le diagnostic à gauche et la courbe à droite, la courbe en J, le banquier, le stress test, quoi dire à qui) ; le tableau en tuiles claires ; les diapos blanches avec quatre intercalaires sombres ; « En détail » avec son sommaire et ses explications repliées ; le besoin affiché est celui du moteur ; au téléphone sans débordement |
| `16-parcours` | le parcours d'accueil : aucune question pré-remplie ni cochée, « ton business prend forme » vu une seule fois puis le pitch, un seul ordre de recommandations (relire d'abord, jamais les délais ni la hausse des prix en tête), partagé par le guide et le pilotage |
| `17-createurs` | la micro-entreprise se choisit sous le statut et règle sa nature d'activité, son versement libératoire et sa franchise ; pas d'IS ni de TVA ; le fondateur devient un prélèvement ; l'ACRE allège la première année ; le prêt d'honneur, avec son réseau, entre en trésorerie ; « Ce que je touche » descend de ce qu'il encaisse à ce qui lui reste |
| `18-banquier` | le dossier parle d'EBE et de CAF ; « ce que ton banquier va vérifier » tient en cinq lignes validées, justes ou à revoir ; la couverture vient de l'échéancier réel, pas d'une dette divisée par sept ; le tableau du banquier ; un prêt d'honneur améliore l'apport |
| `19-effet` | la saisie dit ce qu'elle déplace, sous le champ : « +… € de résultat en année N » en vert, en rouge à la baisse, à la frappe pour un salaire ; un autre champ ou une autre page l'efface |
| `20-methode` | chaque repère du métier cite sa source et son année ; la page Méthode donne les fourchettes, leur calcul, leur construction, leurs limites et toutes les sources avec lien |

## Options

- `--rapide` : trois métiers dans la matrice de rendus.
- `--seul=nom` : ne jouer que les suites dont le fichier contient `nom`
  (`--seul=08`, `--seul=synth`). Saute le paquet et les comptes.
- `--sans-paquet` : ne pas reconstruire.

## Le navigateur

Le harnais prend `CHROMIUM_PATH` s'il est défini, sinon un Chromium installé
par Playwright (`/opt/pw-browsers` ou `~/.cache/ms-playwright`). Sur une
machine neuve : `npx playwright-core install chromium`.

Aucune requête ne sort du serveur de test : polices et réseau sont coupés, un
test ne passe ni n'échoue selon la connexion du jour.

## Écrire une suite

Un fichier `ui/NN-nom.mjs` qui exporte `nom` et une fonction par défaut :

```js
export const nom = 'Ce que la suite prouve'
export default async function (t, { rapide }) {
  const p = await t.page('bureau')      // contexte neuf, stockage vide
  await t.exemple(p)                    // ou t.metier(p, 'Restaurant')
  await t.aller(p, 'offre')
  t.verifie(condition, 'libellé du contrôle', détail)
  await p.fermer()
}
```
