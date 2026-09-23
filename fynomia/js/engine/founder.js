/**
 * Ce qui arrive réellement sur le compte du dirigeant.
 *
 * Un prévisionnel s'arrête d'ordinaire au résultat net de l'entreprise. Or la
 * question que se pose un fondateur est ailleurs : combien puis-je dépenser,
 * une fois tout le monde payé — l'URSSAF, l'État, et le fisc sur mes propres
 * revenus ?
 *
 * Le chemin est long et chaque étape prélève :
 *   rémunération brute → cotisations → net imposable → impôt sur le revenu
 *   résultat de l'entreprise → IS → dividendes → flat tax (ou cotisations TNS)
 *
 * Ce module descend ce chemin jusqu'au bout.
 */

import { fiscalContext } from './fiscal-fr-2026.js'
import { YEARS, byYear } from './revenue.js'
import { monthlyCost } from './payroll.js'
import { isMicro } from './micro.js'

/**
 * Impôt sur le revenu par application du barème à une part de quotient.
 * @returns {number} impôt dû pour une part
 */
function taxOnOnePart(taxableIncome, brackets) {
  let tax = 0
  let floor = 0
  for (const b of brackets) {
    if (taxableIncome <= floor) break
    const slice = Math.min(taxableIncome, b.upTo) - floor
    tax += slice * b.rate
    floor = b.upTo
  }
  return tax
}

/**
 * Impôt sur le revenu du foyer, quotient familial et plafonnement compris.
 *
 * Le plafonnement limite l'avantage procuré par les demi-parts au-delà des
 * parts de base : on calcule l'impôt avec et sans, puis on retient le plus
 * défavorable des deux dans la limite du plafond.
 */
export function incomeTax(taxableIncome, parts, ctx) {
  const brackets = ctx.get('incomeTaxBrackets')
  const base = Math.max(0, taxableIncome)
  if (base === 0) return { tax: 0, effectiveRate: 0, marginalRate: 0, capped: 0 }

  const basePartsCount = parts >= 2 ? 2 : 1
  const extraHalfParts = Math.max(0, (parts - basePartsCount) * 2)

  const withQuotient = taxOnOnePart(base / parts, brackets) * parts
  const withoutExtra = taxOnOnePart(base / basePartsCount, brackets) * basePartsCount

  // L'avantage tiré des demi-parts supplémentaires est plafonné.
  const advantage = withoutExtra - withQuotient
  const cap = ctx.get('familyQuotientCap') * extraHalfParts
  const capped = Math.max(0, advantage - cap)
  const tax = withQuotient + capped

  // Taux marginal : la tranche atteinte par le revenu par part.
  const perPart = base / parts
  const marginal = brackets.find((b) => perPart <= b.upTo)?.rate ?? 0

  return { tax, effectiveRate: base > 0 ? tax / base : 0, marginalRate: marginal, capped }
}

/**
 * Revenu disponible du dirigeant, exercice par exercice.
 *
 * @param scenario  le scénario complet
 * @param result    la sortie du moteur (compte de résultat, trésorerie)
 * @returns {Array} une ligne par exercice, avec le détail de chaque prélèvement
 */
export function founderIncome(scenario, result) {
  if (isMicro(scenario) && result.micro) return microFounderIncome(scenario, result)
  const ctx = fiscalContext(scenario.fiscal || {})
  const cfg = scenario.founder || {}
  const honourY = honourRepaymentY(result)
  const share = clamp01(cfg.equityShare ?? 1)
  const parts = Math.max(1, Number(cfg.taxParts) || 1)
  const payout = clamp01(cfg.dividendPayout ?? 0)
  const otherIncome = Math.max(0, Number(cfg.otherIncome) || 0)
  const useFlatTax = cfg.dividendRegime !== 'bareme'
  const majorityManager = cfg.majorityManager === true

  // Le poste du dirigeant : celui explicitement désigné, sinon le premier.
  const member = (scenario.team || []).find((m) => m.id === cfg.memberId)
    || (scenario.team || []).find((m) => /fondateur|dirigeant|g\u00E9rant|president|pr\u00E9sident/i.test(m.role || ''))
    || (scenario.team || [])[0]
    || null

  const flat = ctx.get('flatTax')
  const allowance = ctx.get('salaryAllowance')
  const capitalBase = capitalPaidIn(scenario)

  // L'abattement forfaitaire de 10 % couvre les traitements, salaires et les
  // rémunérations de gérant relevant de l'article 62. Un professionnel libéral
  // imposé en bénéfices non commerciaux en est exclu : il déduit ses frais
  // réels, déjà pris en compte dans les charges de l'entreprise.
  const liberalBnc = ['BNC', 'EI'].includes(scenario.meta?.legalForm)
  const allowanceApplies = !liberalBnc

  const rows = []
  let retained = 0   // réserves accumulées, distribuables les exercices suivants

  for (let y = 0; y < YEARS; y++) {
    // ─── 1. Rémunération ───────────────────────────────────────────────
    const months = activeMonths(member, y)
    // Mois par mois : l'ACRE ne vaut que la première année, et un poste peut
    // arriver en cours d'exercice.
    let gross = 0, employerCost = 0, netBeforeTax = 0, acreSaving = 0
    if (member) {
      for (let m = y * 12; m < y * 12 + 12; m++) {
        if (!isPaidMonth(member, m)) continue
        const cost = monthlyCost(member, {
          headcount: result.payroll.headcount[m] || 1, acreActive: !!acreOn(scenario, m),
          fiscal: scenario.fiscal || {}, benefits: scenario.hr?.benefits,
        })
        gross += cost.gross
        employerCost += cost.cost
        // Un TNS n'a pas de cotisations salariales : sa rémunération est déjà
        // nette de charges sociales, l'assiette imposable est le montant versé.
        netBeforeTax += member.contractType === 'tns' ? cost.gross : cost.net
        acreSaving += cost.acreExemption || 0
      }
    }

    // ─── 2. Dividendes ─────────────────────────────────────────────────
    // On ne distribue que ce que l'exercice a laissé, augmenté des réserves.
    const profit = result.pnl.netResult[y]
    const distributable = Math.max(0, retained + profit)
    const distributed = distributable * payout
    retained = distributable - distributed
    const grossDividends = distributed * share

    // ─── 3. Prélèvements sur les dividendes ────────────────────────────
    let dividendSocial = 0
    let dividendIncomeTax = 0
    let tnsPortion = 0

    if (grossDividends > 0) {
      // Gérant majoritaire : au-delà de 10 % du capital, ce sont les
      // cotisations d'indépendant qui s'appliquent, bien plus lourdes.
      const threshold = majorityManager ? capitalBase * ctx.get('tnsDividendThreshold') * share : Infinity
      tnsPortion = Math.max(0, grossDividends - threshold)
      const classicPortion = grossDividends - tnsPortion

      dividendSocial = classicPortion * flat.socialCharges + tnsPortion * ctx.get('tnsRate')
      dividendIncomeTax = useFlatTax ? classicPortion * flat.incomeTax : 0
    }

    // ─── 4. Impôt sur le revenu du foyer ───────────────────────────────
    const deduction = allowanceApplies
      ? Math.min(allowance.max, Math.max(Math.min(netBeforeTax, allowance.min), netBeforeTax * allowance.rate))
      : 0
    const salaryTaxable = Math.max(0, netBeforeTax - deduction)

    // Au barème, les dividendes rejoignent le revenu imposable après abattement.
    const dividendTaxable = useFlatTax ? 0 : grossDividends * (1 - ctx.get('dividendAllowance'))
    const householdTaxable = salaryTaxable + dividendTaxable + otherIncome
    const ir = incomeTax(householdTaxable, parts, ctx)

    // La part d'impôt imputable au dirigeant seul, hors autres revenus.
    const irOnOther = otherIncome > 0 ? incomeTax(otherIncome, parts, ctx).tax : 0
    const attributableTax = Math.max(0, ir.tax - irOnOther)

    const netSalary = netBeforeTax
    const netDividends = grossDividends - dividendSocial - dividendIncomeTax
    // Le prêt d'honneur est une dette personnelle : il se rembourse sur ce
    // qui arrive sur le compte du fondateur.
    const honourRepayment = honourY[y] || 0
    const disposable = netSalary + netDividends - attributableTax - honourRepayment

    rows.push({
      year: y,
      months,
      gross, employerCost, netBeforeTax, acreSaving, honourRepayment,
      grossDividends, dividendSocial, dividendIncomeTax, tnsPortion,
      netDividends,
      taxableIncome: householdTaxable,
      incomeTax: attributableTax,
      marginalRate: ir.marginalRate,
      effectiveRate: ir.effectiveRate,
      quotientCapped: ir.capped,
      disposable,
      monthly: disposable / 12,
      retained,
      distributed,
      // Ce que l'entreprise a dû produire pour un euro dans la poche.
      costPerEuro: disposable > 0 ? (employerCost + distributed) / disposable : null,
    })
  }

  return {
    rows,
    member,
    hasSalary: rows.some((r) => r.gross > 0),
    hasDividends: rows.some((r) => r.grossDividends > 0),
    capitalBase,
    settings: { share, parts, payout, useFlatTax, majorityManager, otherIncome, liberalBnc },
  }
}

/**
 * Ce qui reste à un micro-entrepreneur.
 *
 * Le chemin est plus court qu'en société, mais il n'est pas celui qu'on
 * croit : le chiffre d'affaires encaissé paie d'abord les cotisations — sur
 * chaque euro, même quand la marge est mince —, puis les charges réelles, qui
 * ne se déduisent de rien. Ce qui reste est le revenu, imposé au barème après
 * un abattement forfaitaire, ou déjà réglé par le versement libératoire.
 */
function microFounderIncome(scenario, result) {
  const ctx = fiscalContext(scenario.fiscal || {})
  const cfg = scenario.founder || {}
  const parts = Math.max(1, Number(cfg.taxParts) || 1)
  const otherIncome = Math.max(0, Number(cfg.otherIncome) || 0)
  const ms = result.micro
  const abattements = ctx.get('microIncomeTaxAllowance')
  const abattement = abattements[ms.category] ?? 0.5
  const honourY = honourRepaymentY(result)
  const rows = []
  for (let y = 0; y < YEARS; y++) {
    const encaisse = ms.revenueCashY[y] || 0
    const cotisations = (ms.socialY[y] || 0) + (ms.trainingY[y] || 0)
    const revenu = result.pnl.netResult[y]
    let impot = 0, imposable = 0, marginal = 0, effectif = 0
    if (ms.vl) {
      impot = ms.flatTaxY[y] || 0
      effectif = encaisse > 0 ? impot / encaisse : 0
    } else {
      imposable = encaisse > 0 ? Math.max(abattements.min, encaisse * (1 - abattement)) : 0
      const foyer = incomeTax(imposable + otherIncome, parts, ctx)
      const autre = otherIncome > 0 ? incomeTax(otherIncome, parts, ctx).tax : 0
      impot = Math.max(0, foyer.tax - autre)
      marginal = foyer.marginalRate
      effectif = foyer.effectiveRate
    }
    const honourRepayment = honourY[y] || 0
    const disposable = revenu - impot - honourRepayment
    const draws = result.draws?.yearly?.[y] || 0
    rows.push({
      year: y, months: 12,
      gross: 0, employerCost: 0, netBeforeTax: revenu,
      grossDividends: 0, dividendSocial: 0, dividendIncomeTax: 0, tnsPortion: 0, netDividends: 0,
      taxableIncome: imposable + otherIncome, incomeTax: impot,
      marginalRate: marginal, effectiveRate: effectif, quotientCapped: 0,
      disposable, monthly: disposable / 12, retained: 0, distributed: 0, costPerEuro: null,
      microRevenue: encaisse, microSocial: cotisations, microIncome: revenu,
      acreSaving: ms.acreSavingY?.[y] || 0, honourRepayment,
      draws: draws - (ms.vl ? impot : 0),
    })
  }
  return {
    rows, member: null, micro: true, microCategory: ms.category, vl: ms.vl,
    hasSalary: false, hasDividends: false, capitalBase: 0,
    settings: { share: 1, parts, payout: 0, useFlatTax: false, majorityManager: false, otherIncome, liberalBnc: false },
  }
}

/** Remboursements personnels de prêts d'honneur, exercice par exercice. */
function honourRepaymentY(result) {
  const serie = result.financing?.honourRepayment
  return serie ? byYear(serie) : Array(YEARS).fill(0)
}

/** L'ACRE s'applique-t-elle au mois m (hors micro-entreprise) ? */
function acreOn(scenario, m) {
  return scenario.meta?.acre === true && m < fiscalContext(scenario.fiscal || {}).get('acre').months
}

/** Le poste est-il rémunéré au mois m ? */
function isPaidMonth(member, m) {
  if (!member || member.enabled === false) return false
  const start = Number(member.startMonth) || 0
  const end = member.endMonth === '' || member.endMonth === null || member.endMonth === undefined ? Infinity : Number(member.endMonth)
  return m >= start && m <= end
}

/** Capital libéré et comptes courants : assiette du seuil TNS. */
function capitalPaidIn(scenario) {
  const f = scenario.financing || {}
  const sum = (arr) => (arr || []).reduce((a, x) => a + (Number(x.amount) || 0), 0)
  return sum(f.equityFounders) + sum(f.equityInvestors) + sum(f.shareholderLoans)
}

/** Nombre de mois où le poste est rémunéré sur l'exercice. */
function activeMonths(member, year) {
  if (!member) return 0
  const start = Number(member.startMonth) || 0
  const end = member.endMonth === '' || member.endMonth === null || member.endMonth === undefined
    ? Infinity : Number(member.endMonth)
  let months = 0
  for (let m = year * 12; m < year * 12 + 12; m++) if (m >= start && m <= end) months++
  return months
}

const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0))

/** Valeurs par défaut du volet dirigeant. */
export function defaultFounder() {
  return {
    memberId: null,
    equityShare: 1,
    taxParts: 1,
    dividendPayout: 0,
    dividendRegime: 'pfu',
    majorityManager: false,
    otherIncome: 0,
  }
}
