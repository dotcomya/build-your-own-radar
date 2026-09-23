/**
 * D'où viennent les repères du métier.
 *
 * « 75 % à 90 % dans ton métier » ne vaut que si l'on peut dire d'où sort la
 * fourchette. Chaque métier cite donc ses sources — l'éditeur, l'année des
 * données, le lien — et la page Méthode explique comment une fourchette est
 * construite à partir d'elles.
 *
 * Honnêteté d'abord : une fourchette de Fynomia n'est pas la recopie d'un
 * chiffre publié. C'est un ordre de grandeur, arrondi, établi à partir de ces
 * publications et revu à la date indiquée. La page Méthode le dit.
 */

/** Date de la dernière revue des fourchettes. */
export const REVISION = 'septembre 2026'

export const SOURCES = {
  inseeServices: {
    editeur: 'INSEE', titre: 'Ésane — ratios des services principalement marchands par activité',
    annee: 2023, url: 'https://www.insee.fr/fr/statistiques/2130268',
    apporte: 'Taux de valeur ajoutée, poids des frais de personnel, chiffre d’affaires par salarié, par code d’activité.',
  },
  inseeCommerce: {
    editeur: 'INSEE', titre: 'Ésane — ratios du commerce par activité',
    annee: 2023, url: 'https://www.insee.fr/fr/statistiques/2015453',
    apporte: 'Taux de marge commerciale — la marge brute des commerçants —, poids des frais de personnel, par code d’activité.',
  },
  inseeConstruction: {
    editeur: 'INSEE', titre: 'Ésane — ratios de la construction par activité',
    annee: 2023, url: 'https://www.insee.fr/fr/statistiques/2015613',
    apporte: 'Consommations intermédiaires, frais de personnel et valeur ajoutée des entreprises du bâtiment.',
  },
  inseeMarchand: {
    editeur: 'INSEE', titre: 'Ésane — ratios des secteurs marchands par activité',
    annee: 2023, url: 'https://www.insee.fr/fr/statistiques/2015421',
    apporte: 'Les mêmes ratios pour les activités de santé, d’enseignement et d’action sociale exercées à titre marchand.',
  },
  bdf: {
    editeur: 'Banque de France', titre: 'Fascicules d’indicateurs sectoriels (FIBEN)',
    annee: 2024, url: 'https://www.banque-france.fr/fr/publications-et-statistiques/statistiques/fascicules-dindicateurs-sectoriels',
    apporte: 'Trente ratios par secteur, en médiane et en quartiles, sur les entreprises de plus de 1,25 M€ de chiffre d’affaires : c’est ce que ton banquier a sous les yeux.',
  },
  keybanc: {
    editeur: 'KeyBanc Capital Markets & Sapphire Ventures', titre: 'SaaS Survey',
    annee: 2024, url: 'https://info.sapphireventures.com/2024-keybanc-capital-markets-and-sapphire-ventures-saas-survey',
    apporte: 'Marge brute des abonnements — autour de 79 % en médiane —, attrition et efficacité commerciale des éditeurs de logiciel non cotés.',
  },
}

/** Les sources de chaque métier, de la plus proche à la plus large. */
const PAR_METIER = {
  logiciel: ['keybanc', 'inseeServices'],
  developpeur: ['inseeServices'],
  conseil: ['inseeServices', 'bdf'],
  avocat: ['inseeServices', 'bdf'],
  medecin: ['inseeMarchand'],
  kine: ['inseeMarchand'],
  dentiste: ['inseeMarchand'],
  restaurant: ['inseeServices', 'bdf'],
  glacier: ['inseeCommerce', 'inseeServices'],
  boulangerie: ['inseeCommerce', 'bdf'],
  ecommerce: ['inseeCommerce', 'bdf'],
  fleuriste: ['inseeCommerce'],
  commerce: ['inseeCommerce', 'bdf'],
  coiffeur: ['inseeServices'],
  spa: ['inseeServices'],
  hebergement: ['inseeServices', 'bdf'],
  services: ['inseeServices'],
  coach: ['inseeServices'],
  batiment: ['inseeConstruction', 'bdf'],
  formation: ['inseeMarchand'],
  association: ['inseeMarchand'],
}

/** Les sources d'un métier, dans l'ordre. */
export function sourcesDe(sectorKey) {
  return (PAR_METIER[sectorKey] || ['inseeServices']).map((k) => ({ cle: k, ...SOURCES[k] }))
}

/** « INSEE 2023, Banque de France 2024 » — la mention courte, à côté d'un repère. */
export function mentionCourte(sectorKey) {
  const vus = new Set()
  return sourcesDe(sectorKey)
    .filter((s) => { const k = `${s.editeur}`; if (vus.has(k)) return false; vus.add(k); return true })
    .map((s) => `${s.editeur.split(' & ')[0].replace(' Capital Markets', '')} ${s.annee}`)
    .join(', ')
}

/**
 * Ce que mesure chaque repère, et comment on le calcule — pour la page
 * Méthode, et pour qu'un fondateur sache exactement ce qu'on compare.
 */
export const RATIOS = {
  grossMargin: {
    nom: 'Marge brute',
    calcul: '(Chiffre d’affaires − achats consommés) ÷ chiffre d’affaires',
    lecture: 'Ce qui reste de chaque euro vendu une fois payé ce que la vente a directement coûté. Dans le commerce, c’est le taux de marge commerciale de l’INSEE.',
    format: 'pct',
  },
  payrollRatio: {
    nom: 'Masse salariale',
    calcul: 'Salaires et cotisations patronales ÷ chiffre d’affaires',
    lecture: 'La part des ventes qui paie l’équipe, dirigeant compris quand il est salarié.',
    format: 'pct',
  },
  rentRatio: {
    nom: 'Loyer',
    calcul: 'Loyer et charges locatives ÷ chiffre d’affaires',
    lecture: 'Au-delà du haut de la fourchette, l’emplacement coûte plus qu’il ne rapporte.',
    format: 'pct',
  },
  overheadRatio: {
    nom: 'Frais de structure',
    calcul: 'Charges fixes hors salaires ÷ chiffre d’affaires',
    lecture: 'Loyer, assurances, logiciels, comptabilité : ce qui tombe chaque mois, qu’on vende ou non.',
    format: 'pct',
  },
  churn: {
    nom: 'Attrition mensuelle',
    calcul: 'Clients perdus dans le mois ÷ clients en début de mois',
    lecture: 'À 3 % par mois, un tiers de la base part chaque année.',
    format: 'pct',
  },
  ltvCac: {
    nom: 'Valeur client ÷ coût d’acquisition',
    calcul: 'Marge dégagée sur la durée de vie d’un client ÷ ce qu’il a coûté à acquérir',
    lecture: 'En dessous de 3, dépenser plus en acquisition accélère les pertes.',
    format: 'fois',
  },
  ticket: {
    nom: 'Panier moyen',
    calcul: 'Chiffre d’affaires ÷ nombre de ventes',
    lecture: 'Le prix moyen d’un passage en caisse, d’un couvert, d’une séance.',
    format: 'eur',
  },
  dailyRate: { nom: 'Taux journalier', calcul: 'Prix facturé pour une journée de travail', lecture: 'Le prix de marché d’un jour facturé, hors taxe.', format: 'eur' },
  billableDays: { nom: 'Jours facturables', calcul: 'Jours ouvrés − congés, prospection, administratif, formation', lecture: 'Rarement plus de deux cents par an.', format: 'jours' },
  occupancy: { nom: 'Taux d’occupation', calcul: 'Capacité vendue ÷ capacité disponible', lecture: 'Les chambres, les cabines, les créneaux effectivement vendus.', format: 'pct' },
  dso: { nom: 'Délai de paiement client', calcul: 'Créances clients ÷ chiffre d’affaires × 365', lecture: 'Le nombre de jours qu’attend ta facture avant d’être payée.', format: 'jours' },
  actsPerDay: { nom: 'Actes par jour', calcul: 'Actes facturés ÷ jours travaillés', lecture: 'La capacité d’un praticien, au rythme d’une journée soutenable.', format: 'nb' },
  sessionsPerDay: { nom: 'Séances par jour', calcul: 'Séances facturées ÷ jours travaillés', lecture: 'La capacité d’un praticien, au rythme d’une journée soutenable.', format: 'nb' },
  prostheticCost: { nom: 'Coût des prothèses', calcul: 'Achats de prothèses ÷ chiffre d’affaires', lecture: 'La part des honoraires reversée au laboratoire.', format: 'pct' },
  returnRate: { nom: 'Taux de retour', calcul: 'Commandes retournées ÷ commandes expédiées', lecture: 'Chaque retour coûte deux fois le transport et une remise en stock.', format: 'pct' },
  stockDays: { nom: 'Rotation du stock', calcul: 'Stock moyen ÷ achats consommés × 365', lecture: 'Le nombre de jours qu’une marchandise attend avant d’être vendue.', format: 'jours' },
  shrinkage: { nom: 'Pertes et invendus', calcul: 'Marchandise jetée ou abîmée ÷ achats', lecture: 'Le périssable se perd : il faut l’acheter en le sachant.', format: 'pct' },
  fillRate: { nom: 'Taux de remplissage', calcul: 'Places vendues ÷ places ouvertes', lecture: 'Une session à moitié pleine coûte presque autant qu’une session pleine.', format: 'pct' },
  grantShare: { nom: 'Part des subventions', calcul: 'Subventions ÷ ressources totales', lecture: 'Au-delà de 60 %, une décision politique peut arrêter l’activité.', format: 'pct' },
  reserveMonths: { nom: 'Réserves', calcul: 'Trésorerie ÷ charges mensuelles', lecture: 'Le nombre de mois que l’association tiendrait sans ressource nouvelle.', format: 'mois' },
}
