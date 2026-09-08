/**
 * Moteur de paie : du brut mensuel saisi par l'utilisateur au coût réel
 * pour l'entreprise (« super brut ») et au net perçu par le salarié.
 *
 * L'utilisateur ne saisit qu'un brut mensuel et un type de contrat. Tout le
 * reste — cotisations patronales, réduction générale dégressive, exonération
 * JEI, régime des stagiaires et des alternants, cotisations TNS — est calculé
 * ici, avec le détail conservé pour pouvoir être expliqué dans l'interface.
 */

import { fiscalContext } from './fiscal-fr-2026.js'

export const CONTRACT_TYPES = {
  cdi: { label: 'CDI', help: "Contrat à durée indéterminée. Cotisations patronales de droit commun, réduction générale applicable sous 3 SMIC." },
  cdd: { label: 'CDD', help: "Contrat à durée déterminée. Même assiette qu'un CDI, majorée de la contribution CPF-CDD de 1 %." },
  alternance: { label: 'Alternance', help: "Apprentissage ou professionnalisation. Cotisations patronales fortement réduites et salarié exclu de l'effectif pour les seuils sociaux." },
  stage: { label: 'Stage', help: "Gratification obligatoire au-delà de deux mois. Exonérée de cotisations tant qu'elle n'excède pas le minimum légal." },
  tns: { label: 'Dirigeant TNS', help: "Gérant majoritaire de SARL ou entrepreneur individuel. Cotisations du régime des indépendants, sensiblement inférieures au régime général." },
  freelance: { label: 'Freelance / prestataire', help: "Facturation externe. Aucune cotisation sociale : le montant saisi est le coût complet, soumis à TVA." },
}

export const STATUSES = {
  cadre: { label: 'Cadre', help: "Prévoyance obligatoire (1,50 % sur la tranche A) et contribution APEC en supplément." },
  'non-cadre': { label: 'Non-cadre', help: 'Régime général sans prévoyance cadre obligatoire.' },
}

/**
 * Coefficient de la réduction générale de cotisations patronales.
 * Formule dégressive : maximale au SMIC, nulle au plafond (3 SMIC).
 */
export function reductionCoefficient(monthlyGross, headcount, ctx) {
  const { maxCoefUnder50, maxCoefFrom50, ceilingSmicMultiple: K } = ctx.get('reductionGenerale')
  const T = headcount >= 50 ? maxCoefFrom50 : maxCoefUnder50
  if (monthlyGross <= 0) return 0
  const ratio = ctx.smicMonthly / monthlyGross
  const coef = (T / (K - 1)) * (K * ratio - 1)
  return Math.min(Math.max(coef, 0), T)
}

/**
 * Coût complet d'un poste pour un mois donné.
 * @returns {{gross,employerBase,reduction,jeiExemption,employerCharges,superGross,employeeCharges,net,detail}}
 */
export function monthlyCost(member, { headcount = 1, jeiActive = false, fiscal = {} } = {}) {
  const ctx = fiscalContext(fiscal)
  const gross = Math.max(0, Number(member.monthlyGross) || 0)
  const detail = []

  // Prestataire externe : pas de paie, le montant saisi est le coût final.
  if (member.contractType === 'freelance') {
    detail.push({ label: 'Prestation facturée', amount: gross, note: 'Aucune cotisation sociale ; TVA récupérable en sus.' })
    return { gross: 0, employerBase: 0, reduction: 0, jeiExemption: 0, employerCharges: 0, superGross: gross, employeeCharges: 0, net: 0, cost: gross, detail }
  }

  // Dirigeant TNS : cotisations du régime des indépendants sur la rémunération.
  if (member.contractType === 'tns') {
    const rate = ctx.get('tnsRate')
    const charges = gross * rate
    detail.push({ label: 'Rémunération du dirigeant', amount: gross })
    detail.push({ label: `Cotisations TNS (${pct(rate)})`, amount: charges, note: 'Régime des travailleurs non salariés : assiette et taux distincts du régime général.' })
    return { gross, employerBase: charges, reduction: 0, jeiExemption: 0, employerCharges: charges, superGross: gross + charges, employeeCharges: 0, net: gross, cost: gross + charges, detail }
  }

  // Stagiaire : gratification exonérée jusqu'au minimum légal.
  if (member.contractType === 'stage') {
    const legalMinimum = ctx.get('internGratification') * ctx.get('monthlyHours')
    const excess = Math.max(0, gross - legalMinimum)
    const rate = ctx.get('employerRateNonCadre')
    const charges = excess * rate
    detail.push({ label: 'Gratification', amount: gross })
    detail.push({ label: 'Minimum légal exonéré', amount: -Math.min(gross, legalMinimum), note: `${fmt(legalMinimum)} € par mois pour un temps plein. Aucune cotisation en dessous de ce seuil.` })
    if (charges > 0) detail.push({ label: `Cotisations sur la fraction excédentaire (${pct(rate)})`, amount: charges })
    return { gross, employerBase: charges, reduction: 0, jeiExemption: 0, employerCharges: charges, superGross: gross + charges, employeeCharges: 0, net: gross, cost: gross + charges, detail }
  }

  // Alternant : taux patronal réduit, pas de réduction générale supplémentaire.
  if (member.contractType === 'alternance') {
    const rate = ctx.get('apprenticeEmployerRate')
    const charges = gross * rate
    detail.push({ label: 'Salaire brut', amount: gross })
    detail.push({ label: `Cotisations patronales réduites (${pct(rate)})`, amount: charges, note: 'Exonérations propres aux contrats en alternance.' })
    return { gross, employerBase: charges, reduction: 0, jeiExemption: 0, employerCharges: charges, superGross: gross + charges, employeeCharges: 0, net: gross, cost: gross + charges, detail }
  }

  // CDI / CDD : régime général.
  const baseRate = member.status === 'cadre' ? ctx.get('employerRateCadre') : ctx.get('employerRateNonCadre')
  const employerBase = gross * baseRate
  detail.push({ label: 'Salaire brut', amount: gross })
  detail.push({ label: `Cotisations patronales (${pct(baseRate)})`, amount: employerBase, note: 'Maladie, vieillesse, famille, chômage, AT/MP, retraite complémentaire.' })

  const coef = reductionCoefficient(gross, headcount, ctx)
  const generalRelief = gross * coef

  // L'exonération JEI ne porte que sur les cotisations d'assurances sociales et
  // d'allocations familiales — environ 28 points sur les 42 à 45 dus — et n'est
  // pas cumulable avec la réduction générale. On retient donc le dispositif le
  // plus favorable, jamais les deux.
  const jeiCfg = ctx.get('jei')
  const jeiCap = jeiCfg.employeeCapSmicMultiple * ctx.smicMonthly
  const jeiCandidate = jeiActive && (Number(member.rdShare) || 0) > 0
    ? Math.min(gross, jeiCap) * jeiCfg.exemptibleRate
    : 0

  const jeiWins = jeiCandidate > generalRelief
  const reduction = jeiWins ? 0 : generalRelief
  const jeiExemption = jeiWins ? jeiCandidate : 0

  if (reduction > 0) {
    detail.push({
      label: `Réduction générale (coefficient ${coef.toFixed(4)})`,
      amount: -reduction,
      note: `Dégressive entre 1 et 3 SMIC. Ce poste est rémunéré ${(gross / ctx.smicMonthly).toFixed(2)} SMIC.`,
    })
  }
  if (jeiExemption > 0) {
    detail.push({
      label: 'Exonération JEI',
      amount: -jeiExemption,
      note: `Assurances sociales et allocations familiales (${pct(jeiCfg.exemptibleRate)} du brut) sur la fraction inférieure à 4,5 SMIC, soit ${fmt(jeiCap)} €. Chômage, retraite complémentaire et accidents du travail restent dus. Non cumulable avec la réduction générale : Fizzy retient le dispositif le plus favorable.`,
    })
  }

  const cdSurcharge = member.contractType === 'cdd' ? gross * 0.01 : 0
  if (cdSurcharge > 0) detail.push({ label: 'Contribution CPF-CDD (1 %)', amount: cdSurcharge })

  const employerCharges = Math.max(0, employerBase - reduction - jeiExemption + cdSurcharge)
  const superGross = gross + employerCharges
  const employeeCharges = gross * ctx.get('employeeRate')
  const net = gross - employeeCharges

  detail.push({ label: 'Coût total employeur', amount: superGross, emphasis: true })
  detail.push({ label: 'Net avant impôt versé au salarié', amount: net, note: `Après ${pct(ctx.get('employeeRate'))} de cotisations salariales. Le prélèvement à la source s'applique ensuite sur ce net.` })

  return { gross, employerBase, reduction, jeiExemption, employerCharges, superGross, employeeCharges, net, cost: superGross, detail }
}

/** Le poste est-il actif au mois `m` (index 0-59) ? */
export function isActive(member, m) {
  const start = Number(member.startMonth) || 0
  const end = member.endMonth === null || member.endMonth === undefined || member.endMonth === '' ? Infinity : Number(member.endMonth)
  return m >= start && m <= end
}

/**
 * Masse salariale mensuelle sur l'horizon complet.
 * @returns {{cost:number[],gross:number[],employerCharges:number[],headcount:number[],fte:number[],jeiExemption:number[],byMember:Array}}
 */
export function payrollSeries(team, { months = 60, jeiByMonth = [], fiscal = {} } = {}) {
  const cost = new Array(months).fill(0)
  const gross = new Array(months).fill(0)
  const employerCharges = new Array(months).fill(0)
  const jeiExemption = new Array(months).fill(0)
  const headcount = new Array(months).fill(0)
  const fte = new Array(months).fill(0)
  const byMember = []

  // Effectif brut, nécessaire au seuil de 50 salariés de la réduction générale.
  for (let m = 0; m < months; m++) {
    for (const member of team) {
      if (!isActive(member, m)) continue
      const n = Number(member.count) || 1
      if (member.contractType !== 'freelance') headcount[m] += n
      if (!['alternance', 'stage', 'freelance'].includes(member.contractType)) fte[m] += n
    }
  }

  for (const member of team) {
    const series = new Array(months).fill(0)
    for (let m = 0; m < months; m++) {
      if (!isActive(member, m)) continue
      const n = Number(member.count) || 1
      const r = monthlyCost(member, { headcount: headcount[m], jeiActive: !!jeiByMonth[m], fiscal })
      series[m] = r.cost * n
      cost[m] += r.cost * n
      gross[m] += r.gross * n
      employerCharges[m] += r.employerCharges * n
      jeiExemption[m] += r.jeiExemption * n
    }
    byMember.push({ id: member.id, role: member.role, series })
  }

  return { cost, gross, employerCharges, jeiExemption, headcount, fte, byMember }
}

const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
const pct = (n) => `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 2).replace('.', ',')} %`
