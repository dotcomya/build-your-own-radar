/**
 * Volumes, chiffre d'affaires et encaissements.
 *
 * Chaîne de calcul, par activité :
 *   volumes (croissance ou saisie manuelle, + clients acquis par le marketing)
 *     → CA ponctuel (prix unitaire × volumes)
 *     → CA récurrent (abonnements actifs, avec attrition)
 *     → encaissements (acompte, solde intermédiaire, solde, délais de paiement)
 */

export const MONTHS = 60
export const YEARS = 5

export const zeros = (n = MONTHS) => new Array(n).fill(0)
export const yearOf = (m) => Math.floor(m / 12)
export const sumYear = (series, y) => series.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0)
export const byYear = (series) => Array.from({ length: YEARS }, (_, y) => sumYear(series, y))

/** Valeur d'un prix pour l'année `y`, avec reconduction de l'année précédente. */
export function valueForYear(base, perYear, y) {
  let v = Number(base) || 0
  for (let i = 1; i <= y; i++) {
    const override = perYear && perYear[i - 1]
    if (override !== undefined && override !== null && override !== '') v = Number(override)
  }
  return v
}

/**
 * Volumes commandés par mois, hors marketing.
 * Deux modes : courbe de croissance paramétrique, ou saisie manuelle.
 */
export function baseVolumes(activity) {
  const v = zeros()
  const cfg = activity.volumes || {}
  if (cfg.mode === 'manual' && Array.isArray(cfg.manual)) {
    for (let m = 0; m < MONTHS; m++) v[m] = Math.max(0, Number(cfg.manual[m]) || 0)
    return v
  }
  const start = Math.max(0, Number(cfg.startUnits) || 0)
  const growth = Number(cfg.monthlyGrowth) || 0
  const launch = Math.max(0, Number(cfg.launchMonth) || 0)
  const cap = cfg.cap === null || cfg.cap === undefined || cfg.cap === '' ? Infinity : Number(cfg.cap)
  const seasonality = Array.isArray(cfg.seasonality) && cfg.seasonality.length === 12 ? cfg.seasonality : null
  // Décélération : une croissance mensuelle ne se maintient jamais cinq ans au
  // même rythme. Le taux s'érode géométriquement, ce qui produit une courbe en S
  // au lieu d'une exponentielle intenable.
  const decay = cfg.growthDecay === null || cfg.growthDecay === undefined || cfg.growthDecay === '' ? 0.96 : clamp01(cfg.growthDecay)

  let level = start
  for (let m = launch; m < MONTHS; m++) {
    if (m > launch) level *= 1 + growth * Math.pow(decay, m - launch - 1)
    const season = seasonality ? Number(seasonality[m % 12]) || 1 : 1
    v[m] = Math.min(cap, level) * season
  }
  return v
}

/**
 * Clients apportés par les campagnes marketing, par activité et par mois.
 * C'est le lien entre l'onglet Marketing et le chiffre d'affaires.
 */
export function marketingVolumes(campaigns, activities) {
  const out = {}
  for (const a of activities) out[a.id] = zeros()
  const detail = []

  for (const c of campaigns || []) {
    if (!c.enabled) continue
    const target = out[c.activityId] ? c.activityId : activities[0] && activities[0].id
    if (!target) continue
    const start = Math.max(0, Number(c.startMonth) || 0)
    const duration = Math.max(1, Number(c.durationMonths) || 1)
    const budget = Math.max(0, Number(c.monthlyBudget) || 0)
    const series = zeros()
    let totalClients = 0
    let totalSpend = 0

    for (let m = start; m < Math.min(MONTHS, start + duration); m++) {
      const clients = clientsFromBudget(c, budget)
      series[m] = clients
      out[target][m] += clients
      totalClients += clients
      totalSpend += budget
    }
    detail.push({
      id: c.id,
      name: c.name,
      activityId: target,
      series,
      totalClients,
      totalSpend,
      cac: totalClients > 0 ? totalSpend / totalClients : null,
    })
  }
  return { volumes: out, detail }
}

/** Nombre de clients générés par un budget mensuel, selon le modèle d'achat média. */
export function clientsFromBudget(campaign, budget) {
  const leadToClient = clamp01(Number(campaign.leadToClient) || 0)
  switch (campaign.model) {
    case 'cpc': {
      const cpc = Number(campaign.cpc) || 0
      if (cpc <= 0) return 0
      const clicks = budget / cpc
      const leads = clicks * clamp01(Number(campaign.visitToLead) || 0)
      return leads * leadToClient
    }
    case 'cpm': {
      const cpm = Number(campaign.cpm) || 0
      if (cpm <= 0) return 0
      const impressions = (budget / cpm) * 1000
      const clicks = impressions * clamp01(Number(campaign.ctr) || 0)
      const leads = clicks * clamp01(Number(campaign.visitToLead) || 0)
      return leads * leadToClient
    }
    case 'cpl': {
      const cpl = Number(campaign.cpl) || 0
      if (cpl <= 0) return 0
      return (budget / cpl) * leadToClient
    }
    case 'cac': {
      const cac = Number(campaign.cac) || 0
      return cac > 0 ? budget / cac : 0
    }
    default: // 'fixed' : nombre de clients saisi directement
      return Number(campaign.clientsPerMonth) || 0
  }
}

/**
 * Contrats récurrents actifs au mois m : cumul des commandes livrées, dans la
 * limite de la durée de contrat, diminué de l'attrition mensuelle.
 */
export function activeContracts(volumes, activity) {
  const active = zeros()
  const contractMonths = Math.max(0, Number(activity.contractMonths) || 0)
  const delivery = Math.max(0, Math.round(Number(activity.deliveryLag) || 0))
  const churn = clamp01(Number(activity.churnMonthly) || 0)
  if (contractMonths <= 0) return active

  for (let cohort = 0; cohort < MONTHS; cohort++) {
    const size = volumes[cohort]
    if (!size) continue
    const from = cohort + delivery
    for (let k = 0; k < contractMonths; k++) {
      const m = from + k
      if (m >= MONTHS) break
      active[m] += size * Math.pow(1 - churn, k)
    }
  }
  return active
}

/**
 * Chiffre d'affaires et encaissements d'une activité.
 * Le CA est constaté à la commande (ponctuel) ou mois par mois (récurrent) ;
 * l'encaissement suit les conditions de paiement négociées.
 */
export function activityRevenue(activity, volumes) {
  const oneOff = zeros()
  const recurring = zeros()
  const cashOneOff = zeros()
  const cashRecurring = zeros()

  const delivery = Math.max(0, Math.round(Number(activity.deliveryLag) || 0))
  const payLag = Math.max(0, Math.round(Number(activity.paymentLag) || 0))
  const deposit = clamp01(Number(activity.deposit) || 0)
  const milestone = clamp01(Number(activity.milestone) || 0)
  const balance = Math.max(0, 1 - deposit - milestone)
  const contracts = activeContracts(volumes, activity)

  for (let m = 0; m < MONTHS; m++) {
    const y = yearOf(m)
    const unitPrice = valueForYear(activity.unitPrice, activity.priceByYear, y)
    const recurringPrice = valueForYear(activity.recurringPrice, activity.recurringPriceByYear, y)

    oneOff[m] = volumes[m] * unitPrice
    recurring[m] = contracts[m] * recurringPrice

    // Encaissement du ponctuel : acompte à la commande, solde intermédiaire à
    // mi-livraison, solde à la livraison — chacun décalé du délai de paiement.
    const amount = volumes[m] * unitPrice
    if (amount) {
      push(cashOneOff, m + payLag, amount * deposit)
      push(cashOneOff, m + Math.round(delivery / 2) + payLag, amount * milestone)
      push(cashOneOff, m + delivery + payLag, amount * balance)
    }
    // Encaissement du récurrent : facturé au mois, encaissé au délai de paiement.
    if (recurring[m]) push(cashRecurring, m + payLag, recurring[m])
  }

  const total = oneOff.map((v, i) => v + recurring[i])
  const cash = cashOneOff.map((v, i) => v + cashRecurring[i])
  return { oneOff, recurring, total, cash, cashOneOff, cashRecurring, contracts }
}

/** Charges variables d'une activité : achats et sous-traitance directement liés aux ventes. */
export function activityVariableCosts(activity, volumes) {
  const charge = zeros()
  const cash = zeros()
  const delivery = Math.max(0, Math.round(Number(activity.costDeliveryLag ?? activity.deliveryLag) || 0))
  const payLag = Math.max(0, Math.round(Number(activity.costPaymentLag) || 0))
  const deposit = clamp01(Number(activity.costDeposit) || 0)
  const balance = Math.max(0, 1 - deposit)
  const contracts = activeContracts(volumes, activity)

  for (let m = 0; m < MONTHS; m++) {
    const y = yearOf(m)
    const unitCost = valueForYear(activity.unitCost, activity.unitCostByYear, y)
    const recurringCost = valueForYear(activity.recurringCost, activity.recurringCostByYear, y)
    const amount = volumes[m] * unitCost
    const rec = contracts[m] * recurringCost
    charge[m] = amount + rec
    if (amount) {
      push(cash, m + payLag, amount * deposit)
      push(cash, m + delivery + payLag, amount * balance)
    }
    if (rec) push(cash, m + payLag, rec)
  }
  return { charge, cash }
}

/** Agrège toutes les activités. */
export function revenueModel(activities, campaigns) {
  const mk = marketingVolumes(campaigns, activities)
  const perActivity = []
  const totals = { oneOff: zeros(), recurring: zeros(), total: zeros(), cash: zeros(), variableCost: zeros(), variableCash: zeros(), units: zeros() }

  for (const a of activities) {
    const base = baseVolumes(a)
    const fromMarketing = mk.volumes[a.id] || zeros()
    const volumes = base.map((v, i) => v + fromMarketing[i])
    const rev = activityRevenue(a, volumes)
    const cost = activityVariableCosts(a, volumes)
    perActivity.push({ id: a.id, name: a.name, volumes, base, fromMarketing, ...rev, variableCost: cost.charge, variableCash: cost.cash })
    for (let m = 0; m < MONTHS; m++) {
      totals.oneOff[m] += rev.oneOff[m]
      totals.recurring[m] += rev.recurring[m]
      totals.total[m] += rev.total[m]
      totals.cash[m] += rev.cash[m]
      totals.variableCost[m] += cost.charge[m]
      totals.variableCash[m] += cost.cash[m]
      totals.units[m] += volumes[m]
    }
  }
  return { perActivity, totals, campaigns: mk.detail }
}

function push(arr, index, value) {
  if (index >= 0 && index < arr.length) arr[index] += value
}
export const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0))
