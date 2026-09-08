# Fizzy — construisez votre business plan

Application web et mobile de construction et de pilotage de business plan, avec
la fiscalité française appliquée automatiquement.

Fizzy est la transposition informatique du modèle financier **FISY Innovation**
(Rémi Berthier, [fisy.fr](http://www.fisy.fr/)) : les vingt-quatre feuilles du
classeur — configuration, personnel, charges, sous-traitance, investissements,
commandes, trésorerie, TVA, BFR, CIR/CII, JEI, impôts, comptes de résultat,
bilans, plan de financement — deviennent un moteur de calcul et une interface
utilisable sans connaissance comptable.

## Ce que ça fait

Vous saisissez ce que vous vendez, à qui, avec quelle équipe. Fizzy en déduit
tout le reste, et tout est lié : changer un budget publicitaire modifie le
nombre de clients, donc le chiffre d'affaires, donc la TVA, le besoin en fonds
de roulement, l'impôt et la trésorerie — immédiatement.

- **Quinze types d'activité.** Logiciel, développeur indépendant, conseil,
  avocat, cabinet médical, kinésithérapie, dentaire, restaurant, e-commerce,
  fleuriste, commerce de détail, coiffure, coach sportif, formation,
  association. Chacun apporte son vocabulaire — un kinésithérapeute compte des
  séances, pas des « unités » —, son régime de TVA et son statut social, ses
  repères de marge observés, et les pièges propres au métier. Un cabinet
  médical est exonéré de TVA : il ne la facture pas, mais ne la récupère pas
  non plus, ce que le modèle applique réellement.
- **Ce que touche le dirigeant.** Le seul chiffre que les prévisionnels
  n'affichent jamais : ce qui reste sur le compte personnel une fois payés
  l'URSSAF, l'impôt sur les sociétés, la flat tax et l'impôt sur le revenu.
  Barème progressif avec quotient familial et plafonnement, arbitrage entre
  rémunération et dividendes, cotisations TNS sur les dividendes du gérant
  majoritaire de SARL. La page montre le chemin complet de l'argent et combien
  l'entreprise doit produire pour laisser un euro dans la poche.
- **Un verdict, pas un tableau.** Le tableau de bord s'ouvre sur un mot —
  *fragile*, *tendu*, *solide* — la phrase qui l'explique, et le seul chiffre
  qui décide : le montant à réunir avant la date où la caisse touche le fond,
  ou, quand le modèle tient, ce qui tombe chaque mois sur votre compte. Les
  états financiers restent à un pli de là, repliés.
- **La frise des cinq ans.** Une courbe de trésorerie annotée remplace la
  grille de chiffres : l'embauche, la levée, le point bas, le mois où
  l'exploitation s'autofinance, le premier exercice bénéficiaire. Les repères
  se répartissent en couloirs et un repère qui ne trouve pas sa place est
  abandonné plutôt que superposé — sur un écran étroit, la frise est
  recomposée, pas rétrécie.
- **Ce qui changerait le plus.** Dix actions candidates — doubler le budget
  publicitaire, décaler une embauche, augmenter le prix de 10 %, allonger les
  délais fournisseurs — sont chacune appliquées à une copie du scénario, le
  modèle entier est rejoué, et l'écart obtenu est mesuré : EBITDA, besoin de
  financement, point mort. Le classement qui en sort n'est pas une règle
  générale mais le résultat de *votre* modèle. Un clic applique, la barre du
  bas mesure l'écart, l'annulation reste disponible.
- **Alertes de métier.** Vos chiffres sont confrontés aux ordres de grandeur du
  secteur : une marge de 42 % est excellente en commerce de détail, alarmante
  en logiciel. Les alertes disent ce qu'il faut en conclure et où agir.
- **Six vues métier.** Fondateur, direction financière, marketing, ressources
  humaines, produit, conseil. Chacune pose sa question, affiche ses indicateurs
  et — surtout — expose *ses leviers* : des curseurs branchés sur de vrais
  champs du modèle. Un CMO bouge son budget, un DRH décale une embauche, et
  l'EBITDA du groupe bouge sous leurs yeux. La monnaie commune est l'euro
  d'EBITDA, ce qui rend les arbitrages comparables entre fonctions.
- **Rétroaction immédiate.** Tirer un curseur recalcule le modèle entier
  pendant le geste. Un rail permanent compare l'état courant à un repère —
  écart de chiffre d'affaires, d'EBITDA, de point mort, de financement — que
  l'on peut réinitialiser à tout moment. Chaque levier affiche sa chaîne de
  causalité : *prix → CA → marge brute → EBITDA → trésorerie*.
- **L'outil prend position.** Chaque vue s'ouvre sur une phrase qui tranche —
  « Vous vendez à perte », « Il manque 30 237 € en décembre » — puis explique
  ce qui la fonde. Un prévisionnel qui ne dit rien ne sert à rien.
- **Trois profondeurs pour le fondateur.** *Facile* pour se projeter en dix
  minutes, *Intermédiaire* pour piloter plusieurs offres et le financement,
  *Expert* pour le bilan, le BFR, le CIR et le statut JEI. Le modèle calculé
  est toujours le même ; seul le nombre de leviers exposés change.
- **Salaires.** Vous saisissez un brut mensuel, Fizzy calcule le coût réel :
  cotisations patronales, réduction générale dégressive jusqu'à 3 SMIC,
  exonération JEI, régimes du stage, de l'alternance et du dirigeant TNS.
  Le détail est affiché ligne par ligne.
- **Marketing.** Chaque campagne convertit un budget en clients selon un
  entonnoir explicite (CPC, CPM, CPL ou CAC connu), et ces clients alimentent
  l'offre à laquelle la campagne est rattachée.
- **Indicateurs expliqués.** Point mort, EBITDA, BFR, CAF, autonomie, LTV/CAC :
  chaque notion s'ouvre sur une fiche qui dit ce que c'est, comment Fizzy la
  calcule, à quoi elle sert, et rappelle la valeur du scénario en cours.
- **Exports.** Une présentation PowerPoint de dix diapositives prête à
  présenter, le prévisionnel complet en CSV, et une sauvegarde JSON du scénario.
- **Mémoire.** Profil et scénarios enregistrés dans le navigateur, sauvegarde
  automatique, annulation, navigation sans perte. Rien ne quitte l'appareil.
- **Mobile.** Interface adaptative, barre d'onglets tactile, installable comme
  application (PWA) et utilisable hors connexion.

## Lancer

Aucune compilation, aucune dépendance. Servez le dossier en statique :

```bash
cd fizzy
python3 -m http.server 8000
# puis ouvrez http://localhost:8000
```

Les modules ES natifs imposent un serveur HTTP : ouvrir `index.html` par
`file://` ne fonctionnera pas.

### Version en fichier unique

Pour héberger l'application sans serveur de modules, ou l'ouvrir depuis une clé
USB, `build.mjs` produit un HTML autonome — CSS et JavaScript intégrés, aucune
requête réseau hormis la police :

```bash
node build.mjs          # dist/fizzy.html, document complet
node build.mjs --body    # sans <html>/<head>, si l'hôte fournit l'en-tête
```

Au premier lancement, l'application s'ouvre sur un scénario d'exemple complet
plutôt que sur un formulaire vide : le bandeau du tableau de bord permet soit de
le reprendre à son compte, soit de repartir d'une page blanche.

### Téléchargements

Servie depuis un serveur classique, la page déclenche les exports par un lien de
téléchargement. Publiée sur un hôte qui expose la capacité `downloads`, elle
passe par celui-ci, et le visiteur confirme l'enregistrement. `download()` dans
`js/export/zip.js` choisit selon le contexte et retombe sur le lien si l'hôte
n'offre rien.

## Organisation

```
fizzy/
  index.html              page unique, manifeste PWA et service worker
  css/app.css             système de design (jetons, composants, adaptatif)
  js/
    app.js                charpente, navigation, tiroir du glossaire
    engine/
      fiscal-fr-2026.js   paramètres fiscaux et sociaux, datés et annotés
      payroll.js          brut → coût employeur → net
      revenue.js          volumes, chiffre d'affaires, encaissements
      taxes.js            TVA, impôts de production, CIR/CII, JEI, IS
      founder.js          revenu du dirigeant : IR, quotient familial, flat tax
      simulate.js         actions candidates, rejouées et chiffrées sur le modèle
      engine.js           orchestrateur : SIG, trésorerie, BFR, bilan, ratios
    state/
      schema.js           valeurs par défaut, bornes de saisie, contrôles
      sectors.js          quinze profils de métier : régime, repères, pièges
      store.js            profils, scénarios, sauvegarde, historique
    ui/
      personas.js         vues métier : leviers, indicateurs, périmètre
      story.js            frise des cinq ans, repères annotés, jauges de métier
      nudges.js           repères sectoriels, alertes, pièges, cadre réglementaire
      levers.js           curseurs branchés sur le modèle, recalcul pendant le geste
      impact.js           repère, écarts, rail d'impact, valeurs animées
      charts.js           graphiques SVG, palette catégorielle validée
      glossary.js         définitions, formules, usage
      pages/              une fonction de rendu par page
    export/               écriture ZIP et génération PowerPoint (OOXML)
```

Le moteur est une fonction pure : `compute(scénario)` renvoie tous les états.
Il est donc rejouable à chaque frappe sans effet de bord, et testable seul.

## Fiscalité

Les règles pérennes sont appliquées telles quelles : impôt sur les sociétés à
15 % jusqu'à 42 500 € de bénéfice puis 25 %, report déficitaire plafonné à 1 M€
puis 50 %, taux de TVA, seuils de la CVAE et de la C3S, plafond européen des
aides de minimis.

Les valeurs revalorisées chaque année — SMIC, plafond de la Sécurité sociale,
coefficients de la réduction générale, barème de la base minimum de CFE, taux
moyens de cotisations — sont des valeurs de référence reconduites, signalées
« à confirmer » dans Réglages → Paramètres fiscaux, où elles sont toutes
modifiables. **Faites-les valider par un expert-comptable avant tout dépôt de
dossier bancaire ou toute levée de fonds.**

## Vérification du modèle

L'identité comptable sert de test : sur les six modèles sectoriels fournis,
`total actif − total passif` reste sous 10⁻⁸ € sur les cinq exercices — du
bruit de virgule flottante. Un écart réel signalerait un flux modélisé au
compte de résultat mais absent de la trésorerie, ou l'inverse.

La palette des graphiques est validée par script, pas à l'œil : bande de
clarté, plancher de chroma, séparation des paires adjacentes sous les trois
déficiences de vision des couleurs, et contraste sur le fond clair.

## Licence

Le modèle financier d'origine, FISY, est diffusé gratuitement par son auteur.
Cette implémentation en reprend la logique et l'actualise.
