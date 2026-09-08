/**
 * Orchestrateur du modèle financier.
 *
 * Prend un scénario complet et produit, en une passe, l'ensemble des états :
 * compte de résultat, plan de trésorerie mensuel, besoin en fonds de roulement,
 * bilan, plan de financement et indicateurs de pilotage.
 *
 * Le calcul est déterministe et sans effet de bord : l'interface peut donc le
 * relancer à chaque frappe sans risque d'incohérence.
 */

import { MONTHS, YEARS, zeros, byYear, revenueModel, valueForYear } from './revenue.js'
import { payrollSeries } from './payroll.js'
import { vatModel, taxesAndDuties, jeiStatus, researchCredits, corporateTax } from './taxes.js'
import { fiscalContext } from './fiscal-fr-2026.js'

export { MONTHS, YEARS }

export function compute(scenario) {
  const fiscal = scenario.fiscal || {}
  const ctx = fiscalContext(fiscal)
  const activities = scenario.activities || []
  const team = scenario.team || []

  // ─── 1. Produits et charges variables ──────────────────────────────────
  const rev = revenueModel(activities, scenario.marketing)
  const revenueMonthly = rev.totals.total
  const revenueCash = rev.totals.cash

  // ─── 2. Personnel (première passe, sans JEI, pour évaluer l'éligibilité) ─
  const payroll0 = payrollSeries(team, { fiscal })

  // ─── 3. Charges externes ───────────────────────────────────────────────
  const opex = opexSeries(scenario.opex || [], { revenue: revenueMonthly, headcount: payroll0.headcount })

  // ─── 4. Investissements et amortissements ──────────────────────────────
  const capex = capexSeries(scenario.capex || [])

  // ─── 5. Statut JEI, à partir du poids des charges de R&D ───────────────
  const rdShareMonthly = rdPayrollSeries(team, payroll0, 'rdShare')
  const innovShareMonthly = rdPayrollSeries(team, payroll0, 'innovShare')
  const totalChargesY = byYear(
    revenueMonthly.map((_, m) => rev.totals.variableCost[m] + opex.total[m] + payroll0.cost[m] + capex.amortisationMonthly[m]),
  )
  const jei = jeiStatus({
    rdExpenses: byYear(rdShareMonthly),
    totalExpenses: totalChargesY,
    companyAgeYears: Number(scenario.meta?.companyAgeYears) || 0,
    enabled: !!scenario.meta?.jeiClaimed,
    fiscal,
  })
  const jeiByMonth = zeros().map((_, m) => (jei[Math.floor(m / 12)]?.eligible ? 1 : 0))

  // ─── 6. Personnel (seconde passe, exonération JEI appliquée) ───────────
  const payroll = payrollSeries(team, { fiscal, jeiByMonth })

  // ─── 7. TVA ────────────────────────────────────────────────────────────
  const vat = vatModel({
    salesCashByActivity: rev.perActivity.map((a) => a.cash),
    activities,
    purchaseCash: rev.perActivity.map((a) => a.variableCash),
    opexCash: opex.total,
    capexCash: capex.spendMonthly,
    fiscal,
  })

  // ─── 8. Soldes intermédiaires de gestion ───────────────────────────────
  const revenueY = byYear(revenueMonthly)
  const variableCostY = byYear(rev.totals.variableCost)
  const grossMarginY = revenueY.map((v, y) => v - variableCostY[y])
  const opexY = byYear(opex.total)
  const leaseY = byYear(capex.leaseMonthly)
  const externalY = opexY.map((v, y) => v + leaseY[y])
  const valueAddedY = grossMarginY.map((v, y) => v - externalY[y])
  const payrollY = byYear(payroll.cost)
  const grantsY = byYear(financingSeries(scenario).grants)

  const duties = taxesAndDuties({
    payrollGross: payroll.gross,
    revenue: revenueMonthly,
    valueAdded: valueAddedY,
    headcount: payroll.headcount,
    fiscal,
  })
  const dutiesY = duties.map((d, y) => (jei[y].eligible ? d.total - d.cfe - d.cvae : d.total))

  // EBE / EBITDA
  const ebitdaY = valueAddedY.map((v, y) => v + grantsY[y] - dutiesY[y] - payrollY[y])
  const amortisationY = byYear(capex.amortisationMonthly)
  const ebitY = ebitdaY.map((v, y) => v - amortisationY[y])

  const financing = financingSeries(scenario)
  const interestY = byYear(financing.interest)
  const preCreditY = ebitY.map((v, y) => v - interestY[y])

  // ─── 9. Crédits d'impôt ────────────────────────────────────────────────
  const credits = researchCredits({
    rdPayroll: byYear(rdShareMonthly),
    innovationPayroll: byYear(innovShareMonthly),
    rdAmortisation: byYear(capex.rdAmortisationMonthly),
    subcontractingApproved: byYear(opex.rdSubcontracting),
    grants: grantsY,
    fiscal,
  })

  // ─── 10. Impôt sur les sociétés ────────────────────────────────────────
  const jeiSavingY = byYear(payroll.jeiExemption)
  const tax = corporateTax({
    preTaxResult: preCreditY,
    revenue: revenueY,
    eligibleForReducedRate: scenario.meta?.reducedCorporateTax !== false,
    fiscal,
  })
  const netResultY = preCreditY.map((v, y) => v - tax[y].tax + credits[y].total)

  // ─── 11. BFR ───────────────────────────────────────────────────────────
  const bfr = workingCapital({ rev, vat, scenario })

  // ─── 12. Trésorerie mensuelle ──────────────────────────────────────────
  const cash = cashflow({
    scenario, rev, payroll, opex, capex, vat, financing, bfr,
    dutiesY, taxY: tax.map((t) => t.tax), creditsY: credits.map((c) => c.total),
  })

  // ─── 13. Bilan et plan de financement ──────────────────────────────────
  const balance = balanceSheet({ capex, amortisationY, bfr, cash, financing, netResultY, scenario, vat, tax, credits })
  const fundingPlan = financingPlan({ bfr, capex, financing, netResultY, amortisationY, grantsY, creditsY: credits.map((c) => c.total) })

  // ─── 14. Indicateurs ───────────────────────────────────────────────────
  const kpis = indicators({
    revenueY, grossMarginY, externalY, payrollY, dutiesY, amortisationY, interestY,
    ebitdaY, ebitY, netResultY, cash, bfr, rev, scenario, credits, grantsY, ctx,
  })

  return {
    months: MONTHS, years: YEARS,
    startDate: scenario.meta?.startDate || `${new Date().getFullYear()}-01-01`,
    revenue: { monthly: revenueMonthly, yearly: revenueY, cash: revenueCash, perActivity: rev.perActivity, campaigns: rev.campaigns, units: rev.totals.units },
    variableCost: { monthly: rev.totals.variableCost, yearly: variableCostY },
    payroll, opex, capex, vat, financing, bfr, cash, balance, fundingPlan,
    jei, credits, duties, tax,
    pnl: {
      revenue: revenueY, variableCost: variableCostY, grossMargin: grossMarginY,
      external: externalY, valueAdded: valueAddedY, duties: dutiesY, grants: grantsY,
      payroll: payrollY, ebitda: ebitdaY, amortisation: amortisationY, ebit: ebitY,
      interest: interestY, preTax: preCreditY, corporateTax: tax.map((t) => t.tax),
      credits: credits.map((c) => c.total), jeiSaving: jeiSavingY, netResult: netResultY,
    },
    kpis,
  }
}

// ───────────────────────────── Charges externes ────────────────────────────

export const OPEX_TEMPLATES = [
  { key: 'travel', label: 'Déplacements', mode: 'pctRevenue', pctRevenue: 0.02, monthlyAmount: 167 },
  { key: 'fees', label: 'Honoraires (comptable, juridique)', mode: 'perEmployee', perEmployee: 17, monthlyAmount: 420 },
  { key: 'marketing', label: 'Marketing (hors campagnes)', mode: 'pctRevenue', pctRevenue: 0.02, monthlyAmount: 250 },
  { key: 'premises', label: 'Locaux', mode: 'perEmployee', perEmployee: 125, monthlyAmount: 125 },
  { key: 'telecom', label: 'Téléphonie et connexion', mode: 'perEmployee', perEmployee: 17, monthlyAmount: 125 },
  { key: 'insurance', label: 'Assurances', mode: 'pctRevenue', pctRevenue: 0.005, monthlyAmount: 100 },
  { key: 'supplies', label: 'Fournitures', mode: 'perEmployee', perEmployee: 17, monthlyAmount: 42 },
  { key: 'software', label: 'Logiciels et informatique', mode: 'perEmployee', perEmployee: 40, monthlyAmount: 83 },
  { key: 'banking', label: 'Frais bancaires', mode: 'pctRevenue', pctRevenue: 0.005, monthlyAmount: 42 },
]

export function opexSeries(items, { revenue, headcount }) {
  const total = zeros()
  const rdSubcontracting = zeros()
  const perItem = []

  for (const item of items) {
    if (item.enabled === false) continue
    const series = zeros()
    const start = Math.max(0, Number(item.startMonth) || 0)
    const end = item.endMonth === null || item.endMonth === undefined || item.endMonth === '' ? MONTHS - 1 : Number(item.endMonth)
    for (let m = start; m <= Math.min(end, MONTHS - 1); m++) {
      let v = Number(item.monthlyAmount) || 0
      if (item.mode === 'perEmployee') v += (Number(item.perEmployee) || 0) * (headcount[m] || 0)
      if (item.mode === 'pctRevenue') v += (Number(item.pctRevenue) || 0) * (revenue[m] || 0)
      series[m] = v
      total[m] += v
      if (item.rdApproved) rdSubcontracting[m] += v
    }
    perItem.push({ id: item.id, label: item.label, series, yearly: byYear(series) })
  }
  return { total, perItem, rdSubcontracting, yearly: byYear(total) }
}

// ──────────────────────── Investissements et amortissements ────────────────

export function capexSeries(items) {
  const spendMonthly = zeros()
  const amortisationMonthly = zeros()
  const rdAmortisationMonthly = zeros()
  const leaseMonthly = zeros()
  const contributions = zeros()
  const perItem = []

  for (const item of items) {
    const amount = Number(item.amount) || 0
    const month = Math.max(0, Math.min(MONTHS - 1, Number(item.month) || 0))
    const years = Number(item.amortYears) || 0
    const amort = zeros()

    if (item.leasing) {
      // Crédit-bail : pas d'immobilisation, un loyer en charges externes.
      const lease = Number(item.leaseMonthly) || 0
      const duration = Math.max(1, Number(item.leaseMonths) || 36)
      for (let m = month; m < Math.min(MONTHS, month + duration); m++) leaseMonthly[m] += lease
    } else {
      if (item.contribution) contributions[month] += amount
      else spendMonthly[month] += amount
      if (years > 0 && amount > 0) {
        const perMonth = amount / (years * 12)
        for (let m = month; m < Math.min(MONTHS, month + years * 12); m++) {
          amort[m] = perMonth
          amortisationMonthly[m] += perMonth
          rdAmortisationMonthly[m] += perMonth * (Number(item.rdShare) || 0)
        }
      }
    }
    perItem.push({ id: item.id, label: item.label, amount, month, amortisation: amort, yearly: byYear(amort) })
  }
  return { spendMonthly, amortisationMonthly, rdAmortisationMonthly, leaseMonthly, contributions, perItem, yearly: byYear(amortisationMonthly) }
}

// ──────────────────────────────── Financement ───────────────────────────────

export function financingSeries(scenario) {
  const f = scenario.financing || {}
  const equity = zeros()
  const investors = zeros()
  const grants = zeros()
  const shareholderLoans = zeros()
  const advances = zeros()
  const loanDrawdown = zeros()
  const repayment = zeros()
  const interest = zeros()
  const advanceRepayment = zeros()

  for (const e of f.equityFounders || []) push(equity, e.month, Number(e.amount) || 0)
  for (const e of f.equityInvestors || []) push(investors, e.month, Number(e.amount) || 0)
  for (const g of f.grants || []) {
    const spread = Math.max(1, Number(g.months) || 1)
    const per = (Number(g.amount) || 0) / spread
    for (let k = 0; k < spread; k++) push(grants, (Number(g.month) || 0) + k, per)
  }
  for (const s of f.shareholderLoans || []) {
    push(shareholderLoans, s.month, Number(s.amount) || 0)
    if (s.repayMonth !== undefined && s.repayMonth !== null && s.repayMonth !== '') {
      push(advanceRepayment, Number(s.repayMonth), Number(s.amount) || 0)
    }
  }
  for (const a of f.advances || []) {
    push(advances, a.month, Number(a.amount) || 0)
    const start = Number(a.repayStartMonth) || 24
    const n = Math.max(1, Number(a.repayMonths) || 24)
    const per = (Number(a.amount) || 0) / n
    for (let k = 0; k < n; k++) push(advanceRepayment, start + k, per)
  }

  // Prêts bancaires : annuités constantes, ventilation capital / intérêts.
  for (const loan of f.loans || []) {
    const principal = Number(loan.amount) || 0
    const n = Math.max(1, Number(loan.months) || 60)
    const rate = (Number(loan.rate) || 0) / 12
    const start = Math.max(0, Number(loan.month) || 0)
    const grace = Math.max(0, Number(loan.graceMonths) || 0)
    push(loanDrawdown, start, principal)
    const payment = rate > 0 ? (principal * rate) / (1 - Math.pow(1 + rate, -n)) : principal / n
    let outstanding = principal
    for (let k = 0; k < n; k++) {
      const m = start + grace + k
      if (m >= MONTHS) break
      const i = outstanding * rate
      const capital = Math.max(0, payment - i)
      outstanding = Math.max(0, outstanding - capital)
      interest[m] += i
      repayment[m] += capital
    }
  }

  return { equity, investors, grants, shareholderLoans, advances, loanDrawdown, repayment, interest, advanceRepayment, openingCash: Number(f.openingCash) || 0 }
}

// ──────────────────────── Besoin en fonds de roulement ──────────────────────

export function workingCapital({ rev, vat, scenario }) {
  const receivables = zeros()
  const payables = zeros()
  const stock = zeros()
  const vatBalance = zeros()
  const stockDays = Number(scenario.assumptions?.stockDays) || 0

  let cumRevenue = 0, cumCash = 0, cumCost = 0, cumPaid = 0
  for (let m = 0; m < MONTHS; m++) {
    cumRevenue += rev.totals.total[m]
    cumCash += rev.totals.cash[m]
    cumCost += rev.totals.variableCost[m]
    cumPaid += rev.totals.variableCash[m]
    receivables[m] = Math.max(0, cumRevenue - cumCash)
    payables[m] = Math.max(0, cumCost - cumPaid)
    stock[m] = stockDays > 0 ? (rev.totals.variableCost[m] * 12 * stockDays) / 365 : 0
    vatBalance[m] = vat.creditCarried[m] - vat.net[m]
  }
  const total = receivables.map((v, m) => v + stock[m] + vatBalance[m] - payables[m])
  return { receivables, payables, stock, vatBalance, total, yearlyPeak: Array.from({ length: YEARS }, (_, y) => Math.max(...total.slice(y * 12, y * 12 + 12))) }
}

// ───────────────────────────── Plan de trésorerie ───────────────────────────

export function cashflow({ scenario, rev, payroll, opex, capex, vat, financing, bfr, dutiesY, taxY, creditsY }) {
  const inflow = zeros(), outflow = zeros(), balance = zeros()
  // Les flux fournisseurs et clients transitent en TTC : la TVA collectée entre
  // en trésorerie, la TVA déductible en sort, et seul le solde est reversé à
  // l'État le mois suivant. Sur la durée, l'effet net est nul — seul demeure le
  // décalage d'un mois, qui apparaît au bilan en dette ou créance de TVA.
  const rows = { sales: rev.totals.cash, vatCollected: vat.collected, vatRefunded: vat.refunded, grants: financing.grants, equity: financing.equity.map((v, m) => v + financing.investors[m]), loans: financing.loanDrawdown, shareholder: financing.shareholderLoans.map((v, m) => v + financing.advances[m]), credits: zeros(), purchases: rev.totals.variableCash, opex: opex.total, payroll: payroll.cost, vatDeductible: vat.deductible, vatPaid: vat.paid, duties: zeros(), capex: capex.spendMonthly, lease: capex.leaseMonthly, loanRepayment: financing.repayment.map((v, m) => v + financing.interest[m]), advanceRepayment: financing.advanceRepayment, corporateTax: zeros(), stockChange: zeros() }

  // Constitution du stock : une charge de trésorerie qui n'est pas une charge
  // du compte de résultat tant que la marchandise n'est pas vendue.
  for (let m = 0; m < MONTHS; m++) {
    rows.stockChange[m] = (bfr.stock[m] || 0) - (m > 0 ? bfr.stock[m - 1] || 0 : 0)
  }

  // Les crédits d'impôt sont encaissés l'année suivante ; l'IS est réglé de même.
  for (let y = 0; y < YEARS; y++) {
    const m = (y + 1) * 12 + 5
    if (m < MONTHS) rows.credits[m] += creditsY[y] || 0
    const t = (y + 1) * 12 + 3
    if (t < MONTHS) rows.corporateTax[t] += taxY[y] || 0
    for (let k = 0; k < 12; k++) {
      const mm = y * 12 + k
      if (mm < MONTHS) rows.duties[mm] += (dutiesY[y] || 0) / 12
    }
  }

  let running = financing.openingCash
  for (let m = 0; m < MONTHS; m++) {
    const inc = rows.sales[m] + rows.vatCollected[m] + rows.vatRefunded[m] + rows.grants[m] + rows.equity[m] + rows.loans[m] + rows.shareholder[m] + rows.credits[m]
    const out = rows.purchases[m] + rows.opex[m] + rows.payroll[m] + rows.vatDeductible[m] + rows.vatPaid[m] + rows.duties[m] + rows.capex[m] + rows.lease[m] + rows.loanRepayment[m] + rows.advanceRepayment[m] + rows.corporateTax[m] + rows.stockChange[m]
    inflow[m] = inc
    outflow[m] = out
    running += inc - out
    balance[m] = running
  }
  return { inflow, outflow, balance, rows, yearEnd: Array.from({ length: YEARS }, (_, y) => balance[y * 12 + 11]) }
}

// ───────────────────────────────── Bilan ────────────────────────────────────

export function balanceSheet({ capex, amortisationY, bfr, cash, financing, netResultY, scenario, vat, tax, credits }) {
  const rows = []
  let grossFixed = 0, cumAmort = 0, cumEquity = financing.openingCash, cumResult = 0, cumDebt = 0, cumShareholder = 0

  const equityY = byYear(financing.equity), investorsY = byYear(financing.investors)
  const drawY = byYear(financing.loanDrawdown), repayY = byYear(financing.repayment)
  const shareholderY = byYear(financing.shareholderLoans.map((v, m) => v + financing.advances[m]))
  const advanceRepayY = byYear(financing.advanceRepayment)
  const capexY = byYear(capex.spendMonthly.map((v, m) => v + capex.contributions[m]))

  for (let y = 0; y < YEARS; y++) {
    grossFixed += capexY[y]
    cumAmort += amortisationY[y]
    cumEquity += equityY[y] + investorsY[y] + byYear(capex.contributions)[y]
    cumResult += netResultY[y]
    cumDebt += drawY[y] - repayY[y]
    cumShareholder += shareholderY[y] - advanceRepayY[y]

    const m = y * 12 + 11
    const netFixed = grossFixed - cumAmort
    const receivables = bfr.receivables[m]
    const stock = bfr.stock[m]
    const vatCredit = vat.creditCarried[m]
    const treasury = cash.balance[m]
    const taxCredit = credits[y].total
    const assets = netFixed + receivables + stock + vatCredit + Math.max(0, treasury) + taxCredit
    const payables = bfr.payables[m]
    const vatDebt = vat.net[m]
    const taxDebt = tax[y].tax
    const liabilities = cumDebt + cumShareholder + payables + vatDebt + taxDebt + Math.max(0, -treasury)
    const equity = cumEquity + cumResult

    rows.push({
      year: y, grossFixed, amortisation: cumAmort, netFixed, receivables, stock, vatCredit,
      treasury, taxCredit, totalAssets: assets, equity, capital: cumEquity, retained: cumResult,
      debt: cumDebt, shareholder: cumShareholder, payables, vatDebt, taxDebt,
      totalLiabilities: liabilities + equity, gap: assets - (liabilities + equity),
    })
  }
  return rows
}

export function financingPlan({ bfr, capex, financing, netResultY, amortisationY, grantsY, creditsY }) {
  const rows = []
  const capexY = byYear(capex.spendMonthly)
  const repayY = byYear(financing.repayment)
  const advanceRepayY = byYear(financing.advanceRepayment)
  const equityY = byYear(financing.equity), investorsY = byYear(financing.investors)
  const drawY = byYear(financing.loanDrawdown)
  const shareholderY = byYear(financing.shareholderLoans.map((v, m) => v + financing.advances[m]))
  let cumulative = 0

  for (let y = 0; y < YEARS; y++) {
    const prev = y === 0 ? 0 : bfr.total[(y - 1) * 12 + 11]
    const bfrChange = bfr.total[y * 12 + 11] - prev
    const caf = netResultY[y] + amortisationY[y] - creditsY[y] - grantsY[y]
    const uses = Math.max(0, bfrChange) + capexY[y] + repayY[y] + advanceRepayY[y] + Math.max(0, -caf)
    const resources = equityY[y] + investorsY[y] + drawY[y] + shareholderY[y] + grantsY[y] + creditsY[y] + Math.max(0, caf) + Math.max(0, -bfrChange)
    cumulative += resources - uses
    rows.push({ year: y, bfrChange, capex: capexY[y], repayment: repayY[y] + advanceRepayY[y], caf, uses, equity: equityY[y] + investorsY[y], loans: drawY[y], shareholder: shareholderY[y], grants: grantsY[y], credits: creditsY[y], resources, surplus: resources - uses, cumulative })
  }
  return rows
}

// ──────────────────────────────── Indicateurs ───────────────────────────────

export function indicators({ revenueY, grossMarginY, externalY, payrollY, dutiesY, amortisationY, interestY, ebitdaY, ebitY, netResultY, cash, bfr, rev, scenario, credits, grantsY }) {
  const fixedCostsY = externalY.map((v, y) => v + payrollY[y] + dutiesY[y] + amortisationY[y] + interestY[y])
  const marginRateY = revenueY.map((v, y) => (v > 0 ? grossMarginY[y] / v : 0))

  const breakEven = revenueY.map((_, y) => {
    if (marginRateY[y] <= 0) return null
    return fixedCostsY[y] / marginRateY[y]
  })
  const breakEvenWithAid = revenueY.map((_, y) => {
    if (marginRateY[y] <= 0) return null
    return Math.max(0, fixedCostsY[y] - grantsY[y] - credits[y].total) / marginRateY[y]
  })
  // Mois où le chiffre d'affaires cumulé dépasse le point mort de l'année.
  const breakEvenMonth = breakEven.map((target, y) => {
    if (target === null) return null
    let cum = 0
    for (let k = 0; k < 12; k++) {
      cum += rev.totals.total[y * 12 + k] || 0
      if (cum >= target) return k + 1
    }
    return null
  })

  // Premier mois de trésorerie négative et premier mois de résultat positif.
  const cashLow = cash.balance.reduce((acc, v, m) => (v < acc.value ? { value: v, month: m } : acc), { value: Infinity, month: 0 })
  const firstNegative = cash.balance.findIndex((v) => v < 0)
  const firstProfitableYear = netResultY.findIndex((v) => v > 0)
  const firstEbitdaPositiveYear = ebitdaY.findIndex((v) => v > 0)

  // Burn rate et autonomie, calculés sur les 6 derniers mois consommateurs.
  const recentBurn = averageBurn(cash)
  const currentCash = cash.balance[0]
  const runwayMonths = recentBurn > 0 ? Math.max(0, currentCash / recentBurn) : null

  // Coût d'acquisition et valeur client, à partir des campagnes marketing.
  const campaignSpend = (rev.campaigns || []).reduce((a, c) => a + c.totalSpend, 0)
  const campaignClients = (rev.campaigns || []).reduce((a, c) => a + c.totalClients, 0)
  const cac = campaignClients > 0 ? campaignSpend / campaignClients : null
  const totalUnits = rev.totals.units.reduce((a, b) => a + b, 0)
  const totalRevenue = revenueY.reduce((a, b) => a + b, 0)
  const arpu = totalUnits > 0 ? totalRevenue / totalUnits : null
  const blendedMargin = totalRevenue > 0 ? (grossMarginY.reduce((a, b) => a + b, 0)) / totalRevenue : 0
  const ltv = arpu !== null ? arpu * blendedMargin : null

  const fundingNeed = Math.max(0, -Math.min(...cash.balance))

  return {
    fixedCosts: fixedCostsY, marginRate: marginRateY, breakEven, breakEvenWithAid, breakEvenMonth,
    ebitdaMargin: revenueY.map((v, y) => (v > 0 ? ebitdaY[y] / v : 0)),
    netMargin: revenueY.map((v, y) => (v > 0 ? netResultY[y] / v : 0)),
    cashLow, firstNegativeMonth: firstNegative === -1 ? null : firstNegative,
    firstProfitableYear: firstProfitableYear === -1 ? null : firstProfitableYear,
    firstEbitdaPositiveYear: firstEbitdaPositiveYear === -1 ? null : firstEbitdaPositiveYear,
    burnRate: recentBurn, runwayMonths, fundingNeed,
    cac, ltv, ltvCacRatio: cac && ltv ? ltv / cac : null,
    peakBfr: Math.max(...bfr.total), arpu,
    payrollRatio: revenueY.map((v, y) => (v > 0 ? payrollY[y] / v : 0)),
  }
}

function averageBurn(cash) {
  let sum = 0, n = 0
  for (let m = 0; m < 12; m++) {
    const delta = cash.outflow[m] - cash.inflow[m]
    if (delta > 0) { sum += delta; n++ }
  }
  return n > 0 ? sum / n : 0
}

function rdPayrollSeries(team, payroll, field) {
  const out = zeros()
  const index = new Map(payroll.byMember.map((b) => [b.id, b.series]))
  for (const member of team) {
    const share = Number(member[field]) || 0
    if (share <= 0) continue
    const series = index.get(member.id)
    if (!series) continue
    for (let m = 0; m < MONTHS; m++) out[m] += series[m] * share
  }
  return out
}

function push(arr, index, value) {
  const i = Math.max(0, Math.min(MONTHS - 1, Number(index) || 0))
  arr[i] += value
}
