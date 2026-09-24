/**
 * Une campagne marketing se paie.
 *
 * Son budget apportait des clients sans rien coûter : il n'entrait ni dans le
 * résultat ni dans la trésorerie, et un plan à 2 000 € de publicité par mois
 * affichait la marge d'un plan qui n'en dépense rien. On vérifie qu'il est
 * désormais une charge externe, mois par mois, sur la durée de la campagne,
 * que sa TVA se déduit, et qu'une campagne coupée ne coûte plus rien.
 */
import { compute } from '../js/engine/engine.js'
import { scenarioFromTemplate, newActivity, newCampaign } from '../js/state/schema.js'
const ok = (l, c, d = '') => { console.log(`${c ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!c) process.exitCode = 1 }
const near = (a, b, t = 1) => Math.abs(a - b) <= t

const s = scenarioFromTemplate('logiciel', 'campagnes')
s.team = []; s.opex = []; s.capex = []; s.marketing = []
s.financing = { ...s.financing, openingCash: 100000, equityFounders: [], loans: [], honourLoans: [], grants: [], advances: [], shareholderLoans: [], equityInvestors: [] }
const offre = newActivity({ name: 'Abonnement', recurringPrice: 50, paymentLag: 0, volumes: { mode: 'manual', manual: Array.from({ length: 60 }, () => 0) } })
s.activities = [offre]

const sans = compute(s)
// Une campagne qui n'apporte aucun client : on lit son coût, et lui seul.
const c = newCampaign({ name: 'Annonces', activityId: offre.id, simple: false })
Object.assign(c, { monthlyBudget: 1000, startMonth: 2, durationMonths: 6, model: 'cpc', cpc: 0 })
s.marketing = [c]
const avec = compute(s)
const somme = (xs, a = 0, b = 60) => xs.slice(a, b).reduce((t, v) => t + v, 0)

const budget = avec.opex.perItem.find((x) => x.id === c.id)
ok('la campagne est une ligne de charges', !!budget && budget.campagne === true, budget?.label)
ok('son budget tombe du mois 3 au mois 8, et seulement là', budget && budget.series.every((v, m) => (m >= 2 && m <= 7 ? v === 1000 : v === 0)),
  budget && budget.series.slice(0, 10).join(' '))
ok('les charges externes de l’année 1 prennent les 6 000 € du budget', near(avec.pnl.external[0] - sans.pnl.external[0], 6000, 0.01),
  `${Math.round(avec.pnl.external[0] - sans.pnl.external[0])} €`)
ok('le budget ne touche pas la marge brute : c’est une charge générale', near(avec.pnl.grossMargin[0], sans.pnl.grossMargin[0], 0.01))
ok('le résultat d’exploitation baisse d’autant', near(sans.pnl.ebit[0] - avec.pnl.ebit[0], 6000, 0.01))
ok('la TVA du budget se déduit : 20 % de 6 000 €', near(somme(avec.vat.deductible) - somme(sans.vat.deductible), 1200, 1),
  `${Math.round(somme(avec.vat.deductible) - somme(sans.vat.deductible))} €`)
const ecart = sans.cash.balance[59] - avec.cash.balance[59]
// Le crédit de TVA se rembourse selon ses seuils : une part peut rester à
// l'actif à la fin du plan, jamais plus que la TVA payée.
const credit = somme(avec.cash.rows.vatDeductible) - somme(avec.cash.rows.vatRefunded) - (somme(sans.cash.rows.vatDeductible) - somme(sans.cash.rows.vatRefunded))
ok('sur le plan, la trésorerie perd le budget hors taxes, plus la TVA pas encore remboursée', near(ecart, 6000 + credit, 1) && credit >= 0 && credit <= 1200 + 1,
  `${Math.round(ecart)} € de moins, dont ${Math.round(credit)} € de crédit de TVA`)
ok('au mois 8, le budget est sorti de la trésorerie', sans.cash.balance[7] - avec.cash.balance[7] >= 6000 - 1, `${Math.round(sans.cash.balance[7] - avec.cash.balance[7])} €`)

// Une campagne qui apporte des clients : ils paient, et le coût
// d'acquisition vaut le budget divisé par les clients.
Object.assign(c, { cpc: 2, visitToLead: 0.05, leadToClient: 0.2 })
const utile = compute(s)
const clients = utile.revenue.campaigns[0].totalClients
ok('elle apporte ses clients, et leur chiffre d’affaires', clients > 0 && utile.pnl.revenue[0] > sans.pnl.revenue[0], `${clients} clients`)
ok('le coût d’acquisition vaut le budget divisé par les clients', near(utile.kpis.cac, 6000 / clients, 0.01), `${Math.round(utile.kpis.cac)} €`)
ok('et son budget reste compté, clients ou non', near(utile.pnl.external[0] - sans.pnl.external[0], 6000, 0.01))

// Coupée, elle ne coûte plus rien.
c.enabled = false
const coupee = compute(s)
ok('une campagne coupée ne coûte plus rien', near(coupee.pnl.external[0], sans.pnl.external[0], 0.01) && !coupee.opex.perItem.some((x) => x.id === c.id))
