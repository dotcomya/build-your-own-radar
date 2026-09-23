/**
 * Faire parler les chiffres.
 *
 * Un graphique ne dit rien à qui ne sait pas déjà ce qu'il cherche. Chaque
 * dessin du tableau de bord porte donc une phrase — une seule — qui nomme ce
 * qu'on voit et le chiffre qui compte. Les phrases sont construites à partir du
 * résultat calculé : elles changent avec le modèle, elles ne sont jamais du
 * remplissage.
 */

import { euro, num, pct, monthLabel } from './dom.js'

const yearly = (monthly) => Array.from({ length: 5 }, (_, y) =>
  monthly.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0))

/** La trajectoire : d'où l'on part, où l'on arrive, quand ça bascule. */
export function trajectorySentence(r) {
  const p = r.pnl
  const y1 = p.revenue[0], y5 = p.revenue[4]
  const low = r.kpis.cashLow
  const when = monthLabel(low.month, r.startDate)
  const growth = y1 > 0 ? `${num(y5 / y1, 1)} fois le chiffre d'affaires de la première année` : 'un démarrage à zéro'
  const profit = r.kpis.firstProfitableYear !== null
    ? `Le premier exercice bénéficiaire est l'année ${r.kpis.firstProfitableYear + 1}.`
    : 'Aucun exercice n’est bénéficiaire sur cinq ans.'
  const cash = low.value < 0
    ? `La trésorerie passe sous zéro et touche ${euro(low.value)} en ${when} : c’est le montant à financer.`
    : `Le point bas de trésorerie est ${euro(low.value)} en ${when}, sans jamais devenir négatif.`
  return `L'année 5 atteint ${euro(y5, { compact: true })}, soit ${growth}. ${profit} ${cash}`
}

/** Les barres chiffre d'affaires / EBE / résultat net. */
export function revenueSentence(r) {
  const p = r.pnl
  const y = 0
  const marge = p.revenue[y] > 0 ? p.ebitda[y] / p.revenue[y] : 0
  const seuil = r.kpis.breakEven[y]
  const dessous = seuil && p.revenue[y] < seuil
  return `En année 1, ${euro(p.revenue[y], { compact: true })} de chiffre d'affaires laissent ${euro(p.ebitda[y], { compact: true })} d'EBE, soit ${pct(marge, 0)}. `
    + (seuil
      ? `Le point mort est à ${euro(seuil, { compact: true })} : ${dessous ? 'il n’est pas encore atteint' : 'il est franchi'}.`
      : 'Le point mort n’est pas calculable tant que la marge unitaire est nulle.')
}

/** La structure des charges : quel poste pèse le plus. */
export function costsSentence(r, y = 0) {
  const p = r.pnl
  const items = [
    { label: 'les achats variables', v: p.variableCost[y] },
    { label: 'les charges externes', v: p.external[y] },
    { label: 'le personnel', v: p.payroll[y] },
    { label: 'les impôts et taxes', v: p.duties[y] },
    { label: 'les amortissements', v: p.amortisation[y] },
  ]
  const total = items.reduce((a, x) => a + x.v, 0)
  if (total <= 0) return 'Aucune charge n’est encore saisie sur cet exercice.'
  const top = items.reduce((a, b) => (b.v > a.v ? b : a))
  const part = pct(top.v / total, 0)
  return `Sur ${euro(total, { compact: true })} de charges en année ${y + 1}, ${top.label} en représentent ${part} — ${euro(top.v, { compact: true })}. C’est le poste sur lequel une économie se voit le plus.`
}

/** La répartition du chiffre d'affaires entre les offres. */
export function mixSentence(items) {
  const total = items.reduce((a, x) => a + x.value, 0)
  if (total <= 0 || !items.length) return ''
  const top = items.reduce((a, b) => (b.value > a.value ? b : a))
  const part = top.value / total
  return `« ${top.label} » apporte ${pct(part, 0)} du chiffre d'affaires cumulé. `
    + (part > 0.7
      ? 'Une source qui pèse autant fait de sa disparition un risque pour tout le plan.'
      : 'La dépendance à une seule offre reste mesurée.')
}

/** La masse salariale : ce que l'entreprise débourse, cotisations comprises. */
export function payrollSentence(r, y = 0) {
  const gross = yearly(r.payroll.gross)[y] || 0
  const charges = yearly(r.payroll.employerCharges)[y] || 0
  if (gross <= 0) return 'Aucun salaire n’est versé sur cet exercice.'
  const ratio = charges / gross
  return `En année ${y + 1}, ${euro(gross, { compact: true })} de salaires bruts coûtent ${euro(gross + charges, { compact: true })} à l'entreprise : ${pct(ratio, 0)} de cotisations patronales s'y ajoutent.`
}

/**
 * Le besoin en fonds de roulement.
 *
 * C'est la notion que les fondateurs comprennent le plus tard et qui les met le
 * plus souvent en difficulté : on peut être rentable et manquer d'argent. La
 * phrase nomme donc le mécanisme, pas seulement le chiffre.
 */
export function bfrSentence(r) {
  const peak = r.kpis.peakBfr || 0
  const last = r.bfr.total[r.bfr.total.length - 1] || 0
  if (peak <= 0) {
    return "Le cycle d'exploitation dégage de la ressource : les clients paient avant que les fournisseurs ne soient réglés. "
      + "C'est le cas du commerce au comptant, et c'est un avantage de trésorerie qu'il faut savoir ne pas perdre en grandissant."
  }
  const at = r.bfr.total.indexOf(Math.max(...r.bfr.total))
  return `Le besoin en fonds de roulement culmine à ${euro(peak, { compact: true })} en ${monthLabel(at, r.startDate)}. `
    + `C'est l'argent immobilisé entre le moment où tu livres et celui où tu es payé : factures en attente de règlement, stock avancé, TVA à reverser. `
    + `Il grandit avec le chiffre d'affaires — plus tu vends, plus tu avances — ce qui explique qu'une entreprise rentable puisse manquer de trésorerie. `
    + `Trois leviers le réduisent : un acompte à la commande, un délai client plus court, un délai fournisseur plus long. `
    + `En fin d'horizon il s'établit à ${euro(last, { compact: true })}.`
}

/** La courbe de trésorerie : le point bas et ce qu'il veut dire. */
export function cashSentence(r) {
  const low = r.kpis.cashLow
  const when = monthLabel(low.month, r.startDate)
  if (low.value >= 0) {
    return `La caisse ne descend jamais en dessous de ${euro(low.value, { compact: true })}, atteint en ${when}. Le plan se finance seul.`
  }
  return `La courbe touche ${euro(low.value, { compact: true })} en ${when}. C'est ce trou, et non la perte comptable, qui détermine le montant à réunir avant de démarrer.`
}

/** Une phrase qui dit ce que le dessin montre, pour qui ne lit pas les dessins. */
export function moneyFlowSentence(r, y) {
  const p = r.pnl
  const rev = p.revenue[y]
  if (rev <= 0) return "Aucun chiffre d'affaires sur cet exercice : renseigne tes ventes pour voir la cascade se remplir."
  const kept = p.netResult[y] / rev
  const biggest = [
    { label: 'les achats', v: p.variableCost[y] },
    { label: 'les charges externes', v: p.external[y] },
    { label: "l'équipe", v: p.payroll[y] },
  ].sort((a, b) => b.v - a.v)[0]
  if (biggest.v <= 0) return `Sur 100 € facturés, il t’en reste ${Math.round(kept * 100)} € après impôt.`
  return `Sur 100 € facturés, ${biggest.label} en prennent ${Math.round((biggest.v / rev) * 100)} € et il t’en reste ${Math.round(kept * 100)} € après impôt.`
}
