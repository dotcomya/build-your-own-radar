/**
 * Micro-entreprise et ACRE.
 *
 * Un micro-entrepreneur ne vit pas dans le même monde qu'une société. Il ne se
 * verse pas de salaire : ce qu'il retire chaque mois n'est pas une charge,
 * c'est un prélèvement sur ce qui reste. Il ne cotise ni sur une paie ni sur
 * un bénéfice, mais sur ce qu'il encaisse, à un taux fixé par la nature de son
 * activité. Il ne paie pas d'impôt sur les sociétés : son revenu est imposé à
 * son nom, au barème après un abattement forfaitaire, ou d'un pourcentage du
 * chiffre d'affaires s'il a choisi le versement libératoire. Et tant qu'il
 * reste sous les seuils, il ne facture pas la TVA.
 *
 * Calculer un micro-entrepreneur comme une petite SAS, c'était lui compter un
 * impôt sur les sociétés qu'il ne paiera jamais et lui cacher des cotisations
 * qu'il paiera sur chaque euro encaissé — y compris quand il vend à perte.
 *
 * L'ACRE, elle, concerne tout créateur éligible. Depuis 2026, elle se demande
 * et ne se présume pas : Fynomia ne l'applique que si le fondateur la déclare.
 */

import { MONTHS, zeros } from './revenue.js'

/** Les quatre natures d'activité qui fixent les taux du micro-entrepreneur. */
export const MICRO_CATEGORIES = {
  vente: {
    label: 'Vente de marchandises',
    court: 'Vente, restauration, hébergement',
    plafond: 'vente',
    note: 'Achat-revente, vente à emporter ou sur place, fourniture de logement.',
  },
  services: {
    label: 'Prestations de services',
    court: 'Services commerciaux et artisanaux',
    plafond: 'services',
    note: 'Artisans, services aux particuliers et aux entreprises relevant des BIC.',
  },
  liberal: {
    label: 'Profession libérale',
    court: 'Bénéfices non commerciaux, régime général',
    plafond: 'services',
    note: 'Conseil, développement, formation, création : les professions libérales non réglementées.',
  },
  cipav: {
    label: 'Profession libérale CIPAV',
    court: 'Architectes, psychologues, ostéopathes…',
    plafond: 'services',
    note: 'Les professions libérales réglementées qui cotisent à la CIPAV.',
  },
}

/**
 * La nature d'activité par défaut, d'après le métier.
 *
 * Le commerce et la restauration vendent des marchandises ; la santé, le
 * droit, le conseil et la tech relèvent des professions libérales ; le reste
 * — coiffure, bâtiment, services aux particuliers — des prestations de
 * services. Le fondateur la corrige d'un clic si son cas est différent.
 */
export function microCategory(scenario, sector) {
  const choisie = scenario?.meta?.microActivity
  if (choisie && MICRO_CATEGORIES[choisie]) return choisie
  const fam = sector?.family
  if (fam === 'retail') return 'vente'
  if (fam === 'tech' || fam === 'health') return 'liberal'
  if (fam === 'services') return 'liberal'
  return 'services'
}

/** La micro-entreprise est-elle le régime du scénario ? */
export const isMicro = (scenario) => scenario?.meta?.legalForm === 'MICRO'

/** Mois calendaire (0 à 11) et date ISO du début d'activité. */
function debut(scenario) {
  const iso = String(scenario?.meta?.startDate || '2026-01-01')
  const mois = Math.max(0, Math.min(11, (Number(iso.slice(5, 7)) || 1) - 1))
  return { iso, mois }
}

/**
 * Durée de l'ACRE d'un micro-entrepreneur : jusqu'à la fin du troisième
 * trimestre civil qui suit celui du début d'activité — de dix à douze mois.
 */
export function acreMicroMonths(scenario) {
  return 12 - (debut(scenario).mois % 3)
}

/** Part des cotisations effacée par l'ACRE pour un micro-entrepreneur. */
export function acreMicroReduction(scenario, ctx) {
  const cfg = ctx.get('acre')
  const apres = cfg.microReductionFrom
  return apres && debut(scenario).iso >= apres.date ? apres.value : cfg.microReduction
}

/**
 * Coefficient de l'ACRE hors micro, selon le revenu annuel du créateur :
 * entier jusqu'à 75 % du PASS, dégressif jusqu'au PASS, nul au-delà.
 */
export function acreFactor(annualIncome, ctx) {
  const pass = ctx.pass
  const plein = ctx.get('acre').fullUpToPass * pass
  const r = Math.max(0, Number(annualIncome) || 0)
  if (r <= plein) return 1
  if (r >= pass) return 0
  return (pass - r) / (pass - plein)
}

/**
 * Mois où l'ACRE s'applique, hors micro : les douze premiers mois.
 * Vide si le fondateur ne l'a pas déclarée, ou s'il est en micro-entreprise
 * (son ACRE passe par le taux de cotisation, pas par la paie).
 */
export function acreMonths(scenario, ctx) {
  const out = zeros()
  if (!scenario?.meta?.acre || isMicro(scenario)) return out
  const n = ctx.get('acre').months
  for (let m = 0; m < Math.min(n, MONTHS); m++) out[m] = 1
  return out
}

/**
 * Cotisations, formation professionnelle et versement libératoire, mois par
 * mois, sur le chiffre d'affaires encaissé.
 *
 * @returns {{category, rate, training, flatRate, social:number[], trainingSeries:number[],
 *            flatTax:number[], acreSaving:number[], acreMonths:number, acreReduction:number,
 *            ceiling:number, franchise:{seuil:number, majore:number}, vl:boolean}}
 */
export function microSeries({ scenario, sector, revenueCash, ctx }) {
  const category = microCategory(scenario, sector)
  const rate = ctx.get('microSocialRates')[category]
  const training = ctx.get('microTrainingRates')[category]
  const vl = scenario?.meta?.microVL === true
  const flatRate = vl ? ctx.get('microFlatIncomeTax')[category] : 0
  const acre = scenario?.meta?.acre === true
  const acreN = acre ? acreMicroMonths(scenario) : 0
  const acreReduction = acre ? acreMicroReduction(scenario, ctx) : 0

  const social = zeros(), trainingSeries = zeros(), flatTax = zeros(), acreSaving = zeros()
  for (let m = 0; m < MONTHS; m++) {
    const ca = Math.max(0, revenueCash[m] || 0)
    const plein = ca * rate
    const remise = m < acreN ? plein * acreReduction : 0
    social[m] = plein - remise
    acreSaving[m] = remise
    trainingSeries[m] = ca * training
    flatTax[m] = ca * flatRate
  }
  const plafond = MICRO_CATEGORIES[category].plafond
  const ceilings = ctx.get('microRevenueCeilings')
  const seuils = ctx.get('vatFranchiseThresholds')
  return {
    category, rate, training, flatRate, vl,
    social, trainingSeries, flatTax, acreSaving,
    acreMonths: acreN, acreReduction,
    ceiling: ceilings[plafond],
    franchise: plafond === 'vente'
      ? { seuil: seuils.vente, majore: seuils.venteMajore }
      : { seuil: seuils.services, majore: seuils.servicesMajore },
  }
}

/**
 * Le chiffre d'affaires par année civile, face au plafond de chaque année.
 *
 * Les plafonds se comptent du 1er janvier au 31 décembre, pas par année de
 * plan : un projet lancé en septembre a une première année civile de quatre
 * mois. Son plafond est alors ramené au prorata du temps d'activité — il n'a
 * pas droit à 83 600 € de services sur quatre mois.
 *
 * @returns {Array<{annee:number, ca:number, plafond:number, complete:boolean}>}
 */
export function anneesCiviles(scenario, monthly, ceiling) {
  const { iso, mois } = debut(scenario)
  const premiere = Number(iso.slice(0, 4)) || 2026
  const out = []
  for (let m = 0; m < MONTHS; m++) {
    const k = Math.floor((mois + m) / 12)
    if (!out[k]) out[k] = { annee: premiere + k, ca: 0, mois: 0 }
    out[k].ca += monthly[m] || 0
    out[k].mois += 1
  }
  const jour = Math.max(1, Number(iso.slice(8, 10)) || 1)
  const bissextile = (a) => (a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0))
  return out.map((x, k) => {
    let part = 1
    if (k === 0) {
      const total = bissextile(x.annee) ? 366 : 365
      const avant = Math.round((Date.UTC(x.annee, mois, jour) - Date.UTC(x.annee, 0, 1)) / 86400000)
      part = (total - avant) / total
    }
    return { annee: x.annee, ca: x.ca, plafond: ceiling * part, complete: k === 0 || x.mois === 12 }
  })
}
