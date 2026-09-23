/**
 * Ce que ton banquier va vérifier.
 *
 * Un banquier ne lit pas un prévisionnel comme un investisseur. Il ne cherche
 * pas la pente : il cherche la preuve qu'il sera remboursé. Cinq chiffres lui
 * suffisent, toujours les mêmes, et il les calcule lui-même :
 *
 *   — l'apport : la part du projet que le fondateur finance, prêt d'honneur
 *     compris — c'est lui qui déclenche le prêt ;
 *   — la couverture : la capacité d'autofinancement de chaque année face au
 *     capital à rembourser cette année-là, échéancier réel à l'appui ;
 *   — l'endettement : combien d'années de CAF il faudrait pour solder les
 *     prêts bancaires ;
 *   — la trésorerie : jamais sous zéro, prêt compris ;
 *   — le point mort : une année bénéficiaire, et pas trop tard.
 *
 * Diviser la dette par sept pour estimer une annuité donnait un chiffre qui ne
 * ressemblait à aucun tableau d'amortissement. Ici, tout vient de l'échéancier
 * que le moteur a déjà calculé, mois par mois : capital, intérêts, différé.
 */

import { YEARS, byYear } from './revenue.js'

/** Les seuils d'usage. Ce sont des repères de place, pas des règles écrites. */
export const SEUILS_BANQUE = {
  apport: 0.3, apportMin: 0.2,
  couverture: 1.3, couvertureMin: 1,
  endettement: 4, endettementMax: 6,
}

const somme = (xs) => (xs || []).reduce((a, x) => a + (Number(x?.amount) || 0), 0)

/**
 * @returns {{cafY:number[], capitalY:number[], interestY:number[], annuityY:number[],
 *   coverageY:(number|null)[], debtEndY:number[], debtToCafY:(number|null)[],
 *   apport:number, loansTotal:number, apportShare:(number|null), checks:Array}}
 */
export function bankRatios({ scenario, financing, netResultY, amortisationY, balance, kpis }) {
  const f = scenario?.financing || {}
  const cafY = netResultY.map((v, y) => v + (amortisationY[y] || 0))
  const capitalY = byYear(financing.repayment)
  const interestY = byYear(financing.interest)
  const annuityY = capitalY.map((v, y) => v + interestY[y])
  const coverageY = capitalY.map((c, y) => (c > 0.5 ? cafY[y] / c : null))
  const debtEndY = (balance || []).map((b) => Math.max(0, Number(b.debt) || 0))
  const debtToCafY = debtEndY.map((d, y) => (d > 0.5 ? (cafY[y] > 0 ? d / cafY[y] : Infinity) : null))

  // L'apport : ce que le fondateur met lui-même, en capital, en compte
  // courant ou par un prêt d'honneur qu'il rembourse à titre personnel.
  const apport = Math.max(0, Number(f.openingCash) || 0) + somme(f.equityFounders) + somme(f.honourLoans) + somme(f.shareholderLoans)
  const loansTotal = somme(f.loans)
  const apportShare = apport + loansTotal > 0 ? apport / (apport + loansTotal) : null

  const S = SEUILS_BANQUE
  const checks = []

  checks.push({
    cle: 'apport',
    etat: loansTotal <= 0 ? 'na' : apportShare >= S.apport ? 'ok' : apportShare >= S.apportMin ? 'juste' : 'revoir',
    part: apportShare, apport, emprunt: loansTotal,
  })

  // La couverture se lit sur la pire année, et sur l'année de croisière. Une
  // première année qui ne couvre pas ses échéances n'est pas rédhibitoire si
  // la trésorerie tient et que la croisière couvre largement : c'est à ça que
  // servent un différé et un apport. Elle l'est si la croisière ne couvre pas.
  const annees = coverageY.map((c, y) => ({ c, y })).filter((x) => x.c !== null)
  const pire = annees.reduce((m, x) => (m === null || x.c < m.c ? x : m), null)
  const croisiere = annees.find((x) => x.y === 2) || annees[annees.length - 1] || null
  const tresoOk = !((kpis?.fundingNeed || 0) > 0)
  checks.push({
    cle: 'couverture',
    etat: !pire ? 'na'
      : pire.c >= S.couverture ? 'ok'
        : (croisiere && croisiere.c >= S.couverture && tresoOk) || pire.c >= S.couvertureMin ? 'juste' : 'revoir',
    ratio: pire ? pire.c : null, annee: pire ? pire.y : null,
    caf: pire ? cafY[pire.y] : null, capital: pire ? capitalY[pire.y] : null,
    croisiere: croisiere ? croisiere.c : null, anneeCroisiere: croisiere ? croisiere.y : null,
  })

  // L'endettement se lit à partir de la deuxième clôture : la première, avec
  // une CAF de démarrage, gonflerait le ratio sans rien dire de la dette.
  const dettes = debtToCafY.map((d, y) => ({ d, y })).filter((x) => x.d !== null)
  const utiles = dettes.filter((x) => x.y >= 1).length ? dettes.filter((x) => x.y >= 1) : dettes
  const lourde = utiles.reduce((m, x) => (m === null || x.d > m.d ? x : m), null)
  checks.push({
    cle: 'endettement',
    etat: !lourde ? 'na' : lourde.d <= S.endettement ? 'ok' : lourde.d <= S.endettementMax ? 'juste' : 'revoir',
    annees: lourde ? lourde.d : null, annee: lourde ? lourde.y : null, dette: lourde ? debtEndY[lourde.y] : null,
  })

  checks.push({
    cle: 'tresorerie',
    etat: (kpis?.fundingNeed || 0) > 0 ? 'revoir' : 'ok',
    manque: kpis?.fundingNeed || 0, mois: kpis?.cashLow?.month ?? null,
  })

  const premier = kpis?.firstProfitableYear
  checks.push({
    cle: 'pointmort',
    etat: premier === null || premier === undefined ? 'revoir' : premier <= 1 ? 'ok' : premier === 2 ? 'juste' : 'revoir',
    annee: premier ?? null,
  })

  return { cafY, capitalY, interestY, annuityY, coverageY, debtEndY, debtToCafY, apport, loansTotal, apportShare, checks, years: YEARS }
}
