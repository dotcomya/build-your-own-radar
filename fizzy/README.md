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

- **Trois niveaux de lecture.** *Facile* pour se projeter en dix minutes,
  *Intermédiaire* pour piloter plusieurs offres et le financement, *Expert*
  pour le bilan, le BFR, le CIR et le statut JEI. Le modèle calculé est toujours
  le même ; seul le nombre de leviers exposés change.
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
      engine.js           orchestrateur : SIG, trésorerie, BFR, bilan, ratios
    state/
      schema.js           valeurs par défaut, bornes de saisie, modèles, contrôles
      store.js            profils, scénarios, sauvegarde, historique
    ui/                   composants, graphiques SVG, glossaire, pages
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
`total actif − total passif = 0 €` sur les cinq exercices. Un écart signalerait
un flux modélisé au compte de résultat mais absent de la trésorerie, ou
l'inverse.

## Licence

Le modèle financier d'origine, FISY, est diffusé gratuitement par son auteur.
Cette implémentation en reprend la logique et l'actualise.
