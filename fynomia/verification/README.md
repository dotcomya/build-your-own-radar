# Vérification comptable et fiscale

Six scripts qui rejouent le moteur et vérifient ses identités. Ils ne testent
pas l'interface : ils testent les chiffres. Un directeur financier qui veut
s'assurer que l'outil ne raconte pas d'histoires commence ici.

```bash
cd fynomia/verification
node 01-identites-comptables.mjs
node 02-fiscalite-et-paie.mjs
node 03-bilan-et-dirigeant.mjs
node 04-charges-indexees.mjs
node 05-parametres-2026.mjs
node 06-vraisemblance.mjs
```

Chaque ligne affiche `✓` ou `✗`. Une seule croix doit suffire à arrêter une
mise en ligne.

## 01 — Identités comptables

Rejouées sur cinq métiers (logiciel, conseil, e-commerce, restaurant, coiffeur) :

- le compte de résultat s'enchaîne (CA − charges variables = marge brute, puis
  EBITDA, résultat d'exploitation, résultat net) ;
- la trésorerie de fin de période est le cumul des flux nets ;
- le bilan est équilibré chaque exercice ;
- l'impôt sur les sociétés est nul en perte et jamais négatif ;
- la TVA reversée n'est jamais négative ;
- le point mort est positif ou n'existe pas ;
- la masse salariale du plan de trésorerie égale les charges de personnel du
  compte de résultat.

## 02 — Fiscalité et paie

- barème de l'impôt sur les sociétés : 15 % jusqu'à 42 500 € de bénéfice, 25 %
  au-delà ;
- TVA reversée sur cinq ans égale à la TVA due, au décalage d'un mois près ;
- un délai de paiement client dégrade le point bas de trésorerie ;
- un acompte l'améliore ;
- réduction générale de cotisations : maximale au SMIC, nulle au-delà de 3 SMIC ;
- un dirigeant assimilé salarié coûte moins qu'un cadre à brut égal (pas de
  cotisation chômage) et ne bénéficie pas de la réduction générale ;
- un travailleur non salarié cotise à environ 45 %, sans part salariale ;
- l'amortissement cumulé égale le montant investi ;
- la franchise en base ne collecte aucune TVA.

## 03 — Bilan, financement et revenu du dirigeant

- report déficitaire imputé sur le bénéfice suivant, plafonné selon la règle du
  million d'euros puis 50 % ;
- amortissement linéaire, valeur nette comptable décroissante, bilan équilibré ;
- capacité d'autofinancement = résultat net + dotations ;
- plan de financement équilibré (ressources − emplois = excédent) ;
- emprunt : intérêts en charges financières, capital restant dû décroissant,
  dette éteinte à l'échéance ;
- créances clients = ce qui est facturé et pas encore encaissé ;
- TVA collectée sur les encaissements, acompte compris ;
- dividendes : flat tax de 30 % pour un président de SAS, cotisations
  d'indépendant sur la fraction au-delà de 10 % du capital pour un gérant
  majoritaire de SARL ;
- impôt sur le revenu progressif, abattement de 10 % sur les salaires mais pas
  en bénéfices non commerciaux ;
- trésorerie finale = cumul des flux ; capitaux propres = capital + résultats
  cumulés.

## 04 — Charges indexées sur les ventes

Une commission de 1 % sur une glace à 8 € n'est ni une charge fixe, ni un coût
de revient : c'est un pourcentage de cette vente-là. Ce volet vérifie que le
lien tient :

- un pourcentage appliqué à une seule offre ne porte que sur son chiffre
  d'affaires, pas sur celui des autres ;
- le même pourcentage sans offre désignée porte sur l'ensemble ;
- un montant par unité vendue suit les volumes d'une offre, ou de toutes ;
- doubler les volumes double la charge indexée ;
- un montant fixe, lui, ne bouge pas avec les ventes.

## 06 — Vraisemblance

Les garde-fous qui comparent une saisie aux fourchettes du métier :

- les vingt et un plans types et toutes les offres suggérées ne déclenchent
  rien — un garde-fou qui s'allume sur un plan sensé n'est plus lu ;
- un prix avec deux zéros de trop, une croissance saisie en entier, un salaire
  en milliers, un financement sans ses zéros sont attrapés, avec l'écart dit
  en nombre de fois et la correction probable ;
- une alerte fait passer le verdict à « À vérifier » : un plan qui gagne
  280 millions la première année n'est plus présenté comme un succès.
