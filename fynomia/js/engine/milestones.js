/**
 * Les moments qui comptent dans un scénario.
 *
 * Un plan de trésorerie sur soixante mois est une suite de nombres ; ce qu'on
 * en retient tient en quatre ou cinq dates — l'embauche, la levée, le point
 * bas, le mois où l'exploitation s'autofinance, le premier exercice
 * bénéficiaire. Les repérer relève du modèle, pas du dessin : l'écran et le
 * document exporté annotent ainsi la même courbe aux mêmes endroits.
 */

import { euro } from '../format.js'

/**
 * Moments marquants du scénario, dans l'ordre chronologique.
 * On en retient peu : une frise saturée ne raconte plus rien.
 */
export function milestones(result, scenario, { max = 5 } = {}) {
  const events = []
  const cash = result.cash.balance

  // Embauches — les deux premières suffisent à situer la montée en charge.
  const hires = (scenario.team || [])
    .map((m) => ({ month: Number(m.startMonth) || 0, role: m.role }))
    .filter((x) => x.month > 0)
    .sort((a, b) => a.month - b.month)
    .slice(0, 2)
  for (const hire of hires) {
    events.push({
      month: hire.month, kind: 'hire', label: hire.role,
      detail: "Arrivée dans l'équipe", shortDetail: 'Embauche',
    })
  }

  // Levées et prêts significatifs.
  const f = scenario.financing || {}
  for (const e of [...(f.equityInvestors || []), ...(f.loans || [])]) {
    const amount = Number(e.amount) || 0
    if (amount >= 20000) {
      events.push({
        month: Number(e.month) || 0, kind: 'money', label: e.label || 'Financement',
        detail: euro(amount), shortDetail: euro(amount, { compact: true }),
      })
    }
  }

  // Point bas de trésorerie : le moment qui décide du financement.
  const lowMonth = cash.indexOf(Math.min(...cash))
  events.push({
    month: lowMonth, kind: cash[lowMonth] < 0 ? 'danger' : 'low',
    label: cash[lowMonth] < 0 ? 'Caisse à sec' : 'Point bas',
    detail: euro(cash[lowMonth]), shortDetail: euro(cash[lowMonth], { compact: true }),
  })

  // Premier mois où l'exploitation s'autofinance.
  const monthlyOperating = result.cash.inflow.map((v, m) =>
    v - result.cash.outflow[m] + (result.cash.rows.equity[m] || 0) * -1 + (result.cash.rows.loans[m] || 0) * -1)
  const firstSelfFunding = monthlyOperating.findIndex((v, m) => m > 2 && v > 0)
  if (firstSelfFunding > 0) {
    events.push({
      month: firstSelfFunding, kind: 'break', label: 'Exploitation autofinancée',
      detail: 'Les encaissements couvrent les décaissements',
      short: 'Autofinancé', shortDetail: 'Encaissements > décaissements',
    })
  }

  // Premier exercice bénéficiaire.
  const profitYear = result.pnl.netResult.findIndex((v) => v > 0)
  if (profitYear >= 0) {
    events.push({
      month: profitYear * 12 + 11, kind: 'win', label: 'Rentable',
      detail: `${euro(result.pnl.netResult[profitYear])} de résultat net`,
      shortDetail: euro(result.pnl.netResult[profitYear], { compact: true }),
    })
  }

  // Un seul repère par mois, le plus important l'emporte ; et peu au total,
  // au-delà la frise cesse de raconter quoi que ce soit. Sur un écran étroit
  // le plafond descend encore : la place manque avant que le sens ne manque.
  const priority = { danger: 5, win: 4, break: 3, low: 2, money: 1, hire: 0 }
  const byMonth = new Map()
  for (const e of events) {
    const existing = byMonth.get(e.month)
    if (!existing || priority[e.kind] > priority[existing.kind]) byMonth.set(e.month, e)
  }
  return [...byMonth.values()]
    .map((e) => ({ ...e, weight: priority[e.kind] }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max)
    .sort((a, b) => a.month - b.month)
}
