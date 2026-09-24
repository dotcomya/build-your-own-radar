# Tous les contrôles, une commande

```bash
cd fynomia/tests
npm install        # une fois : installe playwright-core
npm test           # tout : paquet, comptes, interface (≈ 5 min sur 4 cœurs)
npm run test:rapide  # la matrice de rendus sur 3 métiers au lieu de 14 (≈ 3 min 30)
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
| `06-paie` | le coût d'un salaire se recalcule dès que la main se pose, sans quitter le champ |
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
| `18-banquier` | le dossier parle d'EBE et de CAF ; les états financiers donnent l'EBE puis l'EBITDA, l'un calculé par le haut (valeur ajoutée), l'autre par le bas (résultat d'exploitation + amortissements), chacun avec sa définition ; « ce que ton banquier va vérifier » tient en cinq lignes validées, justes ou à revoir ; la couverture vient de l'échéancier réel, pas d'une dette divisée par sept ; le tableau du banquier ; un prêt d'honneur améliore l'apport |
| `19-effet` | la saisie dit ce qu'elle déplace, sous le champ : « +… € de résultat en année N » en vert, en rouge à la baisse, sans quitter le champ pour un salaire ; un autre champ ou une autre page l'efface |
| `20-methode` | chaque repère du métier cite sa source et son année ; la page Méthode donne les fourchettes, leur calcul, leur construction, leurs limites et toutes les sources avec lien |
| `21-retouches` | une charge par vente se chiffre en % du prix ou en € par produit vendu, sans montant mensuel ni forfait caché ; un avertissement ouvert passe devant le guide flottant et tout le reste |
| `22-unites` | chaque offre compte ce qu'elle vend : le mot du métier pour l'offre principale, « ventes » par défaut pour les autres, un choix (produits, abonnements…) ou un mot écrit à la main ; ce qui additionne les offres dit « ventes » dès qu'elles ne comptent pas la même chose |
| `23-saisie` | abonnement, salaire, montant d'une charge : rien ne s'écrit pendant la frappe, le plan s'écrit une seconde après la dernière, Tab écrit tout de suite ; le focus, la valeur et le curseur restent en place à travers le recalcul, la suite du nombre s'écrit derrière ; l'effet sur le résultat s'affiche après le recalcul, sous le champ tapé |
| `24-coherence` | un prix qui change : le chiffre d'affaires de l'offre suit exactement le rapport des prix, le résultat affiché est celui d'un calcul neuf, aucun écran (synthèse, pitch, états financiers, dossier) ne garde un ancien montant ; une rafale prix → croissance → autre page sans pause ; la simulation suit le plan sans changement fantôme ; un redessin pendant la frappe écrit d'abord ce qui est tapé ; l'infobulle s'éteint quand son graphique est redessiné |
| `25-survol` | dans le récit du pitch, chaque donnée se consulte au survol : les cinq barres et les soixante mois de tête, la trajectoire, la courbe en J, chaque barre des chapitres ; l'infobulle dit la période (« Année 2 · janv. 27 – déc. 27 », « nov. 26 · mois 11 »), l'intitulé et la valeur exacte du moteur |

## Options

- `--rapide` : trois métiers dans la matrice de rendus.
- `--seul=nom` : ne jouer que les suites dont le fichier contient `nom`
  (`--seul=08`, `--seul=synth`). Saute le paquet et les comptes.
- `--sans-paquet` : ne pas reconstruire.
- `--parallele=N` : suites d'interface jouées N à la fois (3 par défaut,
  `--parallele=1` pour les jouer l'une après l'autre). Chaque suite ouvre ses
  propres contextes de navigateur — stockage vide, aucun plan — et n'écrit
  rien sur le disque : elles ne peuvent pas se gêner. Les résultats
  s'affichent dans l'ordre des fichiers.

## Attendre une condition, jamais une durée

Aucune suite n'attend un nombre de millisecondes : une pause fixe est trop
courte sur une machine chargée et trop longue partout ailleurs. On attend ce
qu'on veut constater.

- `t.aller(p, route)` rend la main quand la racine de l'application a été
  remplacée par la page demandée et que le DOM s'est tu. Le fondu de la
  transition de vue et le tracé des courbes SVG peuvent encore jouer.
- `t.pose(p)` attend que l'écran soit posé : plus de transition de page,
  plus d'animation d'état en cours (une seconde et demie au plus — les effets
  d'attention plus longs et les boucles ne comptent pas), ni DOM ni
  défilement qui bougent depuis 120 ms.
- Pour le reste, on attend l'état lui-même : un élément qui apparaît
  (`locator.waitFor()`), qui disparaît (`{ state: 'detached' }`), une
  classe, un compteur, une adresse (`p.waitForFunction(…)`). Borner ces
  attentes (`{ timeout }`) et laisser l'assertion qui suit dire ce qui manque.
- Pour constater qu'une chose ne s'est **pas** produite — une image qui ne se
  joue pas quand seul son bord dépasse —, `t.pose(p)` d'abord : l'écran
  immobile, l'observateur a eu le temps de répondre s'il devait le faire.

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
  await p.locator('.item-head').first().click()
  await p.locator('.item.open').first().waitFor()   // l'état attendu, pas une durée
  t.verifie(condition, 'libellé du contrôle', détail)
  await p.fermer()
}
```
