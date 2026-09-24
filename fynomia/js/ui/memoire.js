/**
 * Ce dont l'interface se souvient d'un dessin à l'autre.
 *
 * Chaque page est redessinée à chaque saisie : l'onglet ouvert, la carte
 * dépliée, l'exercice choisi doivent survivre au redessin, et à l'aller-retour
 * vers une autre page. Cette mémoire vivait accrochée aux fonctions de rendu
 * — `renderTeam.openId`, `renderDashboard.view` — invisible de l'extérieur et
 * dispersée dans neuf fichiers. Elle est ici, page par page.
 *
 * Rien n'est enregistré : elle dure le temps de la session, comme avant. Une
 * clé absente vaut « pas encore choisi » ; chaque page applique son défaut.
 */
export const memoire = {
  /** Les volets « affiner », sur toutes les pages : ceux qui sont ouverts (Set). */
  affiner: {},
  /** Offre : onglet, offres dépliées (Set), plan pour lequel elles l'ont été. */
  offre: {},
  /** Acquisition, dans l'offre : campagnes dépliées (Set), plan d'origine. */
  acquisition: {},
  /** Achats et coûts : onglet. */
  achats: {},
  /** Équipe : onglet, poste déplié, unité des salaires (an ou mois). */
  equipe: {},
  /** Équipe : détails de coût dépliés (Set). */
  coutPoste: {},
  /** Financement : onglet, source affichée. */
  financement: {},
  /** Tableau de bord : onglet, exercice lu. */
  tableau: {},
  /** Tableau de bord : indicateurs dépliés (Set). */
  indicateurs: {},
  /** Mon modèle : onglet. */
  modele: {},
  /** États financiers : onglet, exercice, trésorerie annuelle ou mensuelle. */
  resultats: {},
}
