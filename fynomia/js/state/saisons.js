/**
 * La saisonnalité : comment les ventes se répartissent dans l'année.
 *
 * Douze coefficients, un par mois du calendrier, de janvier à décembre. Ils
 * répartissent les ventes sans en changer le total : 200 % en juillet veut
 * dire deux fois un mois moyen, et ce que juillet prend, janvier le perd. Le
 * moteur les ramène toujours à une moyenne de 100 %.
 *
 * Une moyenne annuelle lisse précisément les mois creux — ceux où la
 * trésorerie casse. Chaque profil ci-dessous décrit un rythme courant ; il se
 * corrige mois par mois.
 */

export const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

const P = (...pourcents) => pourcents.map((x) => x / 100)

export const SAISONS = {
  ete: { nom: 'Été fort', dit: 'Glacier, tourisme, plein air : juillet et août font le double d’un mois moyen, l’hiver le tiers.', coefs: P(40, 45, 70, 100, 130, 160, 200, 200, 120, 70, 35, 30) },
  restaurant: { nom: 'Restauration', dit: 'Terrasses au printemps, fêtes en décembre ; janvier et août plus calmes.', coefs: P(85, 90, 95, 100, 105, 110, 105, 90, 105, 105, 100, 110) },
  fleurs: { nom: 'Fêtes des fleurs', dit: 'La Saint-Valentin, la fête des mères et la Toussaint portent l’année ; l’été est creux.', coefs: P(80, 150, 95, 95, 150, 95, 70, 60, 85, 90, 120, 110) },
  finAnnee: { nom: 'Fin d’année', dit: 'Commerce et cadeaux : novembre et décembre font l’année, août est le mois le plus bas.', coefs: P(85, 85, 90, 90, 95, 90, 85, 75, 90, 100, 125, 190) },
  creuxAout: { nom: 'Creux d’août', dit: 'Services aux entreprises, bâtiment : août tombe à moitié, juillet ralentit, la rentrée repart.', coefs: P(105, 105, 110, 105, 100, 105, 80, 50, 110, 115, 110, 105) },
  rentree: { nom: 'Rentrée', dit: 'Formation, cours, accompagnement : septembre et octobre au plus haut, juillet et août au plus bas.', coefs: P(120, 105, 110, 95, 90, 80, 50, 40, 150, 140, 115, 105) },
}

/** Le profil courant de chaque métier, quand il en a un. */
export const SAISON_METIER = {
  glacier: 'ete', hebergement: 'ete',
  restaurant: 'restaurant', fleuriste: 'fleurs',
  commerce: 'finAnnee', ecommerce: 'finAnnee',
  conseil: 'creuxAout', avocat: 'creuxAout', services: 'creuxAout', batiment: 'creuxAout', developpeur: 'creuxAout',
  formation: 'rentree', coach: 'rentree',
}

/** Le profil qui correspond à des coefficients, s'il y en a un. */
export function profilDe(coefs) {
  if (!Array.isArray(coefs) || coefs.length !== 12) return null
  return Object.keys(SAISONS).find((k) => SAISONS[k].coefs.every((c, i) => Math.abs(c - (Number(coefs[i]) || 0)) < 1e-6)) || 'perso'
}
