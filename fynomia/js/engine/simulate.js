/**
 * Simulation d'actions.
 *
 * Dire « votre marge est faible » n'aide personne. Chiffrer « passer le prix de
 * 24 à 26 € rapporte 38 000 € d'EBITDA et avance le point mort de quatre
 * mois » est une décision qu'on peut prendre.
 *
 * Le principe : appliquer une action candidate sur une copie du scénario,
 * relancer le moteur complet, mesurer l'écart. Aucune approximation, aucune
 * dérivée analytique — le vrai modèle, deux fois.
 */

import { compute } from './engine.js'
import { founderIncome } from './founder.js'

/** Catalogue des actions envisageables. Chacune sait si elle s'applique. */
export const ACTIONS = [
  {
    key: 'raisePrice', label: 'Augmenter le prix de 10 %',
    rationale: "Le levier le plus direct : il n'ajoute aucun coût.",
    applies: (s) => (Number(s.activities?.[0]?.unitPrice) || 0) > 0,
    apply: (s) => { s.activities[0].unitPrice = round2(s.activities[0].unitPrice * 1.1) },
    describe: (s) => `de ${money(s.activities[0].unitPrice)} à ${money(s.activities[0].unitPrice * 1.1)}`,
  },
  {
    key: 'raiseSubscription', label: "Augmenter l'abonnement de 10 %",
    rationale: 'Chaque euro se répète sur toute la durée du contrat.',
    applies: (s) => (Number(s.activities?.[0]?.recurringPrice) || 0) > 0,
    apply: (s) => { s.activities[0].recurringPrice = round2(s.activities[0].recurringPrice * 1.1) },
    describe: (s) => `de ${money(s.activities[0].recurringPrice)} à ${money(s.activities[0].recurringPrice * 1.1)} par mois`,
  },
  {
    key: 'cutUnitCost', label: 'Réduire le coût de revient de 10 %',
    rationale: 'Négociation fournisseur, portions, pertes : cela se joue à la marge.',
    applies: (s) => (Number(s.activities?.[0]?.unitCost) || 0) > 0,
    apply: (s) => { s.activities[0].unitCost = round2(s.activities[0].unitCost * 0.9) },
    describe: (s) => `de ${money(s.activities[0].unitCost)} à ${money(s.activities[0].unitCost * 0.9)}`,
  },
  {
    key: 'cutChurn', label: "Diviser l'attrition par deux",
    rationale: 'Retenir coûte moins cher que conquérir.',
    applies: (s) => (Number(s.activities?.[0]?.churnMonthly) || 0) > 0.005,
    apply: (s) => { s.activities[0].churnMonthly = s.activities[0].churnMonthly / 2 },
    describe: (s) => `de ${pctv(s.activities[0].churnMonthly)} à ${pctv(s.activities[0].churnMonthly / 2)} par mois`,
  },
  {
    key: 'askDeposit', label: "Demander 30 % d'acompte de plus",
    rationale: "Sans effet sur le résultat, décisif sur la trésorerie.",
    applies: (s) => (Number(s.activities?.[0]?.deposit) || 0) < 0.7,
    apply: (s) => { const a = s.activities[0]; a.deposit = Math.min(1, (Number(a.deposit) || 0) + 0.3); a.milestone = Math.min(a.milestone || 0, 1 - a.deposit) },
    describe: (s) => `de ${pctv(s.activities[0].deposit, 0)} à ${pctv(Math.min(1, (s.activities[0].deposit || 0) + 0.3), 0)} à la commande`,
  },
  {
    key: 'shortenPayment', label: 'Se faire payer un mois plus tôt',
    rationale: 'Relances, prélèvement automatique, escompte : le délai se négocie.',
    applies: (s) => (Number(s.activities?.[0]?.paymentLag) || 0) >= 1,
    apply: (s) => { s.activities[0].paymentLag = Math.max(0, (Number(s.activities[0].paymentLag) || 0) - 1) },
    describe: (s) => `de ${s.activities[0].paymentLag} à ${Math.max(0, s.activities[0].paymentLag - 1)} mois`,
  },
  {
    key: 'delayHire', label: 'Décaler la première embauche de 3 mois',
    rationale: 'Le moyen le plus rapide de réduire le besoin de financement.',
    applies: (s) => (s.team || []).some((m, i) => i > 0 && (Number(m.startMonth) || 0) < 50),
    apply: (s) => { const m = s.team.find((x, i) => i > 0 && (Number(x.startMonth) || 0) < 50); if (m) m.startMonth = (Number(m.startMonth) || 0) + 3 },
    describe: (s) => {
      const m = s.team.find((x, i) => i > 0 && (Number(x.startMonth) || 0) < 50)
      return m ? `${m.role} : mois ${(Number(m.startMonth) || 0) + 1} → ${(Number(m.startMonth) || 0) + 4}` : ''
    },
  },
  {
    key: 'cutFixed', label: 'Réduire les charges fixes de 15 %',
    rationale: 'Les charges fixes se paient que vous vendiez ou non.',
    applies: (s) => (s.opex || []).some((o) => (Number(o.monthlyAmount) || 0) > 0),
    apply: (s) => { for (const o of s.opex) o.monthlyAmount = round2((Number(o.monthlyAmount) || 0) * 0.85) },
    describe: (s) => {
      const total = (s.opex || []).reduce((a, o) => a + (Number(o.monthlyAmount) || 0), 0)
      return `de ${money(total)} à ${money(total * 0.85)} par mois`
    },
  },
  {
    key: 'raiseBudget', label: 'Doubler le budget marketing',
    rationale: "À tester : ne vaut que si un client rapporte plus qu'il ne coûte.",
    applies: (s) => (s.marketing || []).some((c) => c.enabled !== false && (Number(c.monthlyBudget) || 0) > 0),
    apply: (s) => { for (const c of s.marketing) if (c.enabled !== false) c.monthlyBudget = (Number(c.monthlyBudget) || 0) * 2 },
    describe: (s) => {
      const total = (s.marketing || []).filter((c) => c.enabled !== false).reduce((a, c) => a + (Number(c.monthlyBudget) || 0), 0)
      return `de ${money(total)} à ${money(total * 2)} par mois`
    },
  },
  {
    key: 'improveConversion', label: 'Gagner un tiers de conversion',
    rationale: 'Le même budget, plus de clients : moins cher que dépenser plus.',
    applies: (s) => (s.marketing || []).some((c) => c.enabled !== false && (Number(c.leadToClient) || 0) > 0),
    apply: (s) => { for (const c of s.marketing) if (c.enabled !== false) c.leadToClient = Math.min(1, (Number(c.leadToClient) || 0) * 1.33) },
    describe: (s) => {
      const c = s.marketing.find((x) => x.enabled !== false)
      return c ? `de ${pctv(c.leadToClient)} à ${pctv(Math.min(1, c.leadToClient * 1.33))}` : ''
    },
  },
]

/**
 * Évalue toutes les actions applicables et renvoie les meilleures.
 *
 * Le classement dépend de la situation : quand il manque de l'argent, ce qui
 * compte est le besoin de financement ; sinon, c'est l'EBITDA.
 */
export function suggestActions(scenario, baseResult, { limit = 3 } = {}) {
  const y = referenceYear(baseResult)
  const base = measure(scenario, baseResult, y)
  const shortOfCash = baseResult.kpis.fundingNeed > 0

  const evaluated = []
  for (const action of ACTIONS) {
    if (!action.applies(scenario)) continue
    const draft = structuredClone(scenario)
    try {
      action.apply(draft)
    } catch { continue }

    let result
    try { result = compute(draft) } catch { continue }
    const after = measure(draft, result, y)

    const delta = {
      ebitda: after.ebitda - base.ebitda,
      breakEven: after.breakEven !== null && base.breakEven !== null ? after.breakEven - base.breakEven : null,
      fundingNeed: after.fundingNeed - base.fundingNeed,
      founderMonthly: after.founderMonthly - base.founderMonthly,
      revenue: after.revenue - base.revenue,
    }

    // Score : ce qui manque le plus pèse le plus lourd.
    const score = shortOfCash
      ? -delta.fundingNeed * 2 + delta.ebitda * 0.5
      : delta.ebitda + Math.max(0, -delta.fundingNeed) * 0.5

    evaluated.push({
      key: action.key, label: action.label, rationale: action.rationale,
      detail: safeDescribe(action, scenario),
      delta, score, apply: action.apply,
      // Une action peut se retourner contre vous : on le dit.
      harmful: delta.ebitda < 0 && delta.fundingNeed > 0,
    })
  }

  evaluated.sort((a, b) => b.score - a.score)
  const useful = evaluated.filter((a) => a.score > 0)
  return { best: useful.slice(0, limit), all: evaluated, base, shortOfCash, year: y }
}

/** Applique définitivement une action au scénario courant. */
export function applyAction(scenario, key) {
  const action = ACTIONS.find((a) => a.key === key)
  if (action && action.applies(scenario)) action.apply(scenario)
}

function measure(scenario, result, y) {
  let founderMonthly = 0
  try {
    const income = founderIncome(scenario, result)
    founderMonthly = income.rows[y]?.monthly || 0
  } catch { /* le revenu du dirigeant n'est pas indispensable au classement */ }
  return {
    ebitda: result.pnl.ebitda[y],
    revenue: result.pnl.revenue[y],
    breakEven: result.kpis.breakEven[y],
    fundingNeed: result.kpis.fundingNeed,
    founderMonthly,
  }
}

function safeDescribe(action, scenario) {
  try { return action.describe(scenario) } catch { return '' }
}

export function referenceYear(result) {
  const i = result.pnl.netResult.findIndex((v) => v > 0)
  return i >= 0 ? i : 2
}

const round2 = (v) => Math.round(v * 100) / 100
const money = (v) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v))} €`
const pctv = (v, d = 1) => `${(v * 100).toFixed(d).replace('.', ',')} %`
