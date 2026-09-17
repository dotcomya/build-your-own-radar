/**
 * TVA, impôts et taxes, crédits d'impôt et statut JEI.
 * Toutes les règles s'appuient sur les paramètres de fiscal-fr-2026.js.
 */

import { fiscalContext } from './fiscal-fr-2026.js'
import { MONTHS, YEARS, zeros, byYear } from './revenue.js'

/**
 * TVA mensuelle : collectée sur les encaissements, déductible sur les achats,
 * reversée (ou remboursée) le mois suivant. Le crédit de TVA est reporté.
 */
export function vatModel({ salesCashByActivity, activities, purchaseCash, opexCash, capexCash, exempt = false, fiscal = {} }) {
  const ctx = fiscalContext(fiscal)
  const generic = ctx.get('vatRates').normal
  const lag = ctx.get('vatPaymentLagMonths')

  const collected = zeros()
  const deductible = zeros()

  activities.forEach((a, i) => {
    const rate = num(a.vatRateSales, generic)
    const cash = salesCashByActivity[i] || zeros()
    for (let m = 0; m < MONTHS; m++) collected[m] += cash[m] * rate
  })
  activities.forEach((a, i) => {
    const rate = num(a.vatRatePurchase, generic)
    const cash = purchaseCash[i] || zeros()
    for (let m = 0; m < MONTHS; m++) deductible[m] += cash[m] * rate
  })
  // Une activité exonérée ne facture pas de TVA, mais ne la récupère pas non
  // plus : la taxe payée sur les achats, le matériel et le loyer reste à sa
  // charge. C'est le cas des professions médicales, de la formation déclarée
  // et des associations non assujetties.
  if (!exempt) {
    for (let m = 0; m < MONTHS; m++) {
      deductible[m] += (opexCash[m] || 0) * generic + (capexCash[m] || 0) * generic
    }
  }

  // Solde mensuel : TVA due reversée le mois suivant, crédit remboursé dès
  // qu'il dépasse le seuil de demande de remboursement mensuel.
  const REFUND_THRESHOLD = 760
  const net = zeros()
  const paid = zeros()
  const refunded = zeros()
  const creditCarried = zeros()
  // Crédit dont le remboursement est demandé mais pas encore encaissé : c'est
  // une créance sur le Trésor, symétrique de la dette de TVA à reverser.
  const refundReceivable = zeros()
  let carry = 0

  for (let m = 0; m < MONTHS; m++) {
    const balance = collected[m] - deductible[m] - carry
    if (balance >= 0) {
      net[m] = balance
      carry = 0
      if (m + lag < MONTHS) paid[m + lag] += balance
    } else {
      net[m] = 0
      const credit = -balance
      if (credit >= REFUND_THRESHOLD) {
        carry = 0
        refundReceivable[m] = credit
        if (m + lag < MONTHS) refunded[m + lag] += credit
      } else {
        carry = credit
      }
    }
    creditCarried[m] = carry
  }
  return { collected, deductible, net, paid, refunded, creditCarried, refundReceivable }
}

/**
 * Impôts et taxes assis sur la masse salariale, le chiffre d'affaires et la
 * valeur ajoutée. Calculés par exercice.
 */
export function taxesAndDuties({ payrollGross, revenue, valueAdded, headcount, fiscal = {} }) {
  const ctx = fiscalContext(fiscal)
  const grossY = byYear(payrollGross)
  const revenueY = byYear(revenue)
  const rows = []

  for (let y = 0; y < YEARS; y++) {
    const staff = headcount[Math.min(MONTHS - 1, y * 12 + 11)] || 0
    const mass = grossY[y]
    const ca = revenueY[y]
    const va = valueAdded[y] || 0

    const apprenticeship = mass * ctx.get('apprenticeshipTax')
    const trainingRates = ctx.get('vocationalTraining')
    const training = mass * (staff >= 11 ? trainingRates.from11 : trainingRates.under11)
    const peec = ctx.get('constructionEffort')
    const construction = staff >= peec.threshold ? mass * peec.rate : 0
    const c3sCfg = ctx.get('c3s')
    const c3s = ca > c3sCfg.threshold ? (ca - c3sCfg.threshold) * c3sCfg.rate : 0
    const cfe = computeCfe(ca, y, ctx)
    const cvae = computeCvae(ca, va, ctx)

    rows.push({
      year: y,
      apprenticeship,
      training,
      construction,
      c3s,
      cfe,
      cvae,
      total: apprenticeship + training + construction + c3s + cfe + cvae,
    })
  }
  return rows
}

function computeCfe(revenue, year, ctx) {
  const cfg = ctx.get('cfe')
  if (cfg.exemptFirstYear && year === 0) return 0
  const bracket = cfg.brackets.find((b) => revenue <= b.upTo) || cfg.brackets[cfg.brackets.length - 1]
  const base = bracket.amount
  return year === 1 ? base * (1 - cfg.reliefSecondYear) : base
}

function computeCvae(revenue, valueAdded, ctx) {
  const cfg = ctx.get('cvae')
  if (revenue < cfg.exemptionThreshold || valueAdded <= 0) return 0
  // Taux progressif : nul à 500 k€, maximal à 50 M€.
  const progress = Math.min(1, (revenue - cfg.exemptionThreshold) / (50000000 - cfg.exemptionThreshold))
  const rate = cfg.maxRate * progress
  const duty = Math.max(valueAdded * rate, cfg.minimumContribution)
  return duty * (1 + cfg.additionalTaxRate)
}

/**
 * Éligibilité JEI, exercice par exercice.
 * Depuis 2024, l'avantage se limite à l'exonération de cotisations patronales.
 */
export function jeiStatus({ rdExpenses, totalExpenses, companyAgeYears = 0, enabled, fiscal = {} }) {
  const ctx = fiscalContext(fiscal)
  const cfg = ctx.get('jei')
  return Array.from({ length: YEARS }, (_, y) => {
    const ratio = totalExpenses[y] > 0 ? rdExpenses[y] / totalExpenses[y] : 0
    const ageOk = companyAgeYears + y < cfg.maxAgeYears
    const eligible = enabled && ageOk && ratio >= cfg.rdRatioThreshold
    return { year: y, ratio, ageOk, eligible, threshold: cfg.rdRatioThreshold }
  })
}

/**
 * Crédit d'impôt recherche et crédit d'impôt innovation.
 * L'assiette combine les salaires affectés à la R&D, un forfait de frais de
 * fonctionnement, les amortissements du matériel de recherche et la
 * sous-traitance agréée.
 */
export function researchCredits({ rdPayroll, innovationPayroll, rdAmortisation, subcontractingApproved, grants, fiscal = {} }) {
  const ctx = fiscalContext(fiscal)
  const cirCfg = ctx.get('cir')
  const ciiCfg = ctx.get('cii')
  const deMinimis = ctx.get('deMinimis')

  const rows = []
  let cumulativeAid = 0

  for (let y = 0; y < YEARS; y++) {
    const salaries = rdPayroll[y] || 0
    const operating = salaries * cirCfg.operatingAllowance
    const equipment = (rdAmortisation[y] || 0) * (1 + cirCfg.equipmentAllowance)
    const otherBase = salaries + operating + equipment
    const sub = Math.min(subcontractingApproved[y] || 0, otherBase * cirCfg.subcontractingMultiple)
    const grossBase = otherBase + sub
    const base = Math.max(0, grossBase - (grants[y] || 0))
    const cir = base <= cirCfg.cap ? base * cirCfg.rate : cirCfg.cap * cirCfg.rate + (base - cirCfg.cap) * cirCfg.rateAboveCap

    const innovBase = Math.min((innovationPayroll[y] || 0) * (1 + cirCfg.operatingAllowance), ciiCfg.expenseCap)
    const cii = innovBase * ciiCfg.rate

    // Plafond européen des aides de minimis, sur trois exercices glissants.
    const aidThisYear = cii
    const windowStart = Math.max(0, y - deMinimis.windowYears + 1)
    const windowAid = rows.slice(windowStart).reduce((a, r) => a + r.aidCounted, 0) + aidThisYear
    const excess = Math.max(0, windowAid - deMinimis.ceiling)
    const aidCounted = Math.max(0, aidThisYear - excess)

    cumulativeAid += aidCounted
    rows.push({
      year: y, salaries, operating, equipment, subcontracting: sub, base,
      cir, cii: aidCounted, ciiBeforeCap: cii, deMinimisExcess: excess, aidCounted,
      total: cir + aidCounted,
    })
  }
  return rows
}

/**
 * Impôt sur les sociétés avec report déficitaire plafonné.
 * Le taux réduit de 15 % ne s'applique qu'aux PME sous le plafond de CA.
 */
export function corporateTax({ preTaxResult, revenue, eligibleForReducedRate = true, fiscal = {} }) {
  const ctx = fiscalContext(fiscal)
  const cfg = ctx.get('corporateTax')
  const carryCfg = ctx.get('lossCarryForward')
  const rows = []
  let carriedLosses = 0

  for (let y = 0; y < YEARS; y++) {
    const result = preTaxResult[y] || 0
    if (result <= 0) {
      carriedLosses += -result
      rows.push({ year: y, taxable: 0, used: 0, carried: carriedLosses, tax: 0, reducedPart: 0, normalPart: 0 })
      continue
    }
    // Imputation : sans limite jusqu'à 1 M€, puis 50 % de la fraction au-delà.
    const cap = Math.min(carriedLosses, carryCfg.flatCap + Math.max(0, result - carryCfg.flatCap) * carryCfg.rateAboveCap)
    const used = Math.min(carriedLosses, cap, result)
    carriedLosses -= used
    const taxable = result - used

    const reducedAllowed = eligibleForReducedRate && (revenue[y] || 0) < cfg.revenueCapForReduced
    const reducedPart = reducedAllowed ? Math.min(taxable, cfg.reducedBracket) : 0
    const normalPart = taxable - reducedPart
    const tax = reducedPart * cfg.reducedRate + normalPart * cfg.normalRate

    rows.push({ year: y, taxable, used, carried: carriedLosses, tax, reducedPart, normalPart })
  }
  return rows
}

const num = (v, fallback) => (v === null || v === undefined || v === '' ? fallback : Number(v))
