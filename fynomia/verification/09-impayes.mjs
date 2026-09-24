/**
 * Les impayés : une part des factures n'est jamais réglée.
 *
 * Le chiffre d'affaires reste celui qu'on a facturé. La part impayée passe en
 * perte sur créances irrécouvrables (compte 654) à l'échéance de la facture :
 * sous l'EBE, que le plan comptable arrête avant elle, et dans l'EBITDA,
 * calculé par le bas depuis le résultat d'exploitation. Elle n'entre jamais
 * en caisse, ne porte pas de TVA collectée sur les encaissements, et sort des
 * créances clients : le bilan reste équilibré.
 */
import { compute } from '../js/engine/engine.js'
import { scenarioFromTemplate, newActivity } from '../js/state/schema.js'
const ok = (l, c, d = '') => { console.log(`${c ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!c) process.exitCode = 1 }
const near = (a, b, t = 1) => Math.abs(a - b) <= t
const somme = (xs, a = 0, b = 60) => xs.slice(a, b).reduce((t, v) => t + v, 0)

const base = scenarioFromTemplate('conseil', 'impayés')
base.team = []; base.opex = []; base.capex = []; base.marketing = []
base.financing = { ...base.financing, openingCash: 50000, equityFounders: [], loans: [], honourLoans: [], grants: [], advances: [], shareholderLoans: [], equityInvestors: [] }
const plan = (taux, acompte = 0.3) => {
  const s = JSON.parse(JSON.stringify(base))
  s.activities = [newActivity({ name: 'Mission', unitPrice: 10000, paymentLag: 1, deposit: acompte, badDebtRate: taux,
    volumes: { mode: 'manual', manual: Array.from({ length: 60 }, () => 1) } })]
  return compute(s)
}

const sans = plan(0)
const avec = plan(0.05)

// Onze factures échoient dans l'année 1 (mois 1 à 11) : 70 % de 10 000 €, dont 5 % impayés.
ok('la perte de l’année 1 : 5 % du solde des onze factures échues', near(avec.pnl.badDebts[0], 11 * 10000 * 0.7 * 0.05, 0.01), `${avec.pnl.badDebts[0]} €`)
ok('le chiffre d’affaires reste celui qu’on a facturé', avec.pnl.revenue.every((v, y) => near(v, sans.pnl.revenue[y], 0.01)))
ok('l’EBE ne bouge pas : les impayés passent en dessous', avec.pnl.ebe.every((v, y) => near(v, sans.pnl.ebe[y], 0.01)))
ok('EBITDA = EBE − pertes sur créances', avec.pnl.ebitda.every((v, y) => near(v, avec.pnl.ebe[y] - avec.pnl.badDebts[y], 0.01)),
  `${Math.round(avec.pnl.ebitda[0])} = ${Math.round(avec.pnl.ebe[0])} − ${Math.round(avec.pnl.badDebts[0])}`)
ok('résultat d’exploitation = EBE − amortissements − pertes sur créances', avec.pnl.ebit.every((v, y) => near(v, avec.pnl.ebe[y] - avec.pnl.amortisation[y] - avec.pnl.badDebts[y], 0.01)))
ok('sans impayés, EBITDA et EBE se confondent', sans.pnl.ebitda.every((v, y) => near(v, sans.pnl.ebe[y], 0.01)))

// La trésorerie : ce qui n'est pas payé n'entre pas.
const encaisse = (r) => somme(r.revenue.cash)
ok('les encaissements baissent exactement des impayés', near(encaisse(sans) - encaisse(avec), somme(avec.pnl.badDebts, 0, 5), 0.01),
  `${Math.round(encaisse(sans) - encaisse(avec))} € de moins encaissés`)
ok('les créances clients ne gardent pas les factures perdues', avec.bfr.receivables.every((v, m) => near(v, sans.bfr.receivables[m], 0.01)))
ok('pas de TVA collectée sur ce qui n’est pas encaissé', near(somme(sans.vat.collected) - somme(avec.vat.collected), 0.2 * (encaisse(sans) - encaisse(avec)), 0.5))
ok('le bilan reste équilibré, chaque année', avec.balance.every((b) => near(b.totalAssets, b.totalLiabilities, 2)),
  avec.balance.map((b) => Math.round(b.totalAssets - b.totalLiabilities)).join(' '))

// Le point mort se lit sur ce que chaque euro laisse vraiment.
const tauxContribution = (avec.pnl.grossMargin[1] - avec.pnl.badDebts[1]) / avec.pnl.revenue[1]
ok('le point mort compte les impayés comme un coût qui suit les ventes',
  avec.kpis.breakEven[1] === null ? tauxContribution <= 0 : near(avec.kpis.breakEven[1], avec.kpis.fixedCosts[1] / tauxContribution, 0.01))

// L'acompte, versé à la commande, n'est jamais impayé.
const acompteSeul = plan(0.05, 1)
ok('un paiement intégral à la commande ne laisse aucun impayé', acompteSeul.pnl.badDebts.every((v) => v === 0))
ok('le taux est borné à 50 %', near(plan(0.9).pnl.badDebts[1], plan(0.5).pnl.badDebts[1], 0.01))
