/**
 * Ce que la synthèse dit, partagé entre ses deux écritures.
 *
 * L'onglet « Synthèse » et son essai de forme lisent le même dossier. Tout ce
 * qui relève du fond — le texte d'avancement, dicté mot pour mot, les six
 * chiffres qu'on te demandera et le nom des pages où ils se corrigent — vit
 * ici, une seule fois. Les deux écrans n'en diffèrent que par la forme.
 */

import { euro, pct, num, monthLabel } from './dom.js'

/**
 * Le bandeau d'avancement, en mots.
 *
 * L'avancement chiffré, l'enjeu nommé, et la liste de ce qui reste : c'est ce
 * qui donne envie de poser la ligne suivante. `c` est le résultat de
 * checklist().
 */
export function avancement(c) {
  const reste = c.open
  return {
    surtitre: `Avancement : ${c.done} / ${c.total}`,
    titre: `Renseigne tes ${reste} dernier${reste > 1 ? 's' : ''} paramètre${reste > 1 ? 's' : ''} de ton business`,
    texte: 'Tes résultats actuels reposent sur des estimations génériques. Ajuste tes hypothèses pour obtenir un dossier prêt pour tes investisseurs et ta banque.',
    parcourir: `Parcourir les ${reste} éléments restants à remplir`,
  }
}

/**
 * Les six chiffres qu'un lecteur extérieur réclame.
 *
 * Chiffre d'affaires et résultat net n'y sont pas : l'opération de l'analyse
 * les porte déjà, et le même nombre deux fois double la page sans rien
 * ajouter. Restent les six qu'on ne déduit pas d'un coup d'œil.
 */
export function figureSet(r, s, y) {
  const k = r.kpis, p = r.pnl
  const reached = k.breakEven[y] && p.revenue[y] >= k.breakEven[y]
  const runway = Number.isFinite(k.runwayMonths) && k.runwayMonths !== null ? k.runwayMonths : null
  const marginRate = p.revenue[y] > 0 ? k.marginRate[y] : null
  return [
    { label: 'EBE', value: euro(p.ebitda[y], { compact: true }), note: `${pct(k.ebitdaMargin[y], 0)} du chiffre d'affaires`,
      tone: p.ebitda[y] >= 0 ? 'pos' : 'neg', spark: p.ebitda, go: 'resultats', help: 'ebitda', ico: 'entreprises' },
    { label: 'Point mort', value: k.breakEven[y] ? euro(k.breakEven[y], { compact: true }) : '\u2014',
      note: reached ? 'franchi cette ann\u00e9e' : 'pas encore franchi',
      tone: reached ? 'pos' : 'warn', spark: k.breakEven.map((v) => v || 0), go: 'resultats', help: 'pointMort', ico: 'cible' },
    { label: 'Tr\u00e9sorerie au plus bas', value: euro(k.cashLow.value, { compact: true }),
      note: `au plus bas en ${monthLabel(k.cashLow.month, r.startDate)}`, tone: k.cashLow.value < 0 ? 'neg' : 'pos',
      spark: r.cash.balance, go: 'financement', help: 'tresorerie', ico: 'argent' },
    { label: '\u00c0 financer', value: k.fundingNeed > 0 ? euro(k.fundingNeed, { compact: true }) : 'Rien',
      note: k.fundingNeed > 0 ? `\u00e0 r\u00e9unir avant ${monthLabel(k.cashLow.month, r.startDate)}` : 'la caisse se suffit',
      tone: k.fundingNeed > 0 ? 'warn' : 'pos', go: 'financement', help: 'besoinFinancement', ico: 'commerce' },
    { label: 'Marge brute', value: marginRate === null ? '\u2014' : pct(marginRate, 0),
      note: 'ce qui reste apr\u00e8s les co\u00fbts directs',
      tone: marginRate === null ? '' : marginRate >= 0.4 ? 'pos' : marginRate >= 0.15 ? 'warn' : 'neg',
      spark: k.marginRate, go: 'offre', help: 'margeBrute', ico: 'alimentaire' },
    { label: 'Autonomie', value: runway === null ? 'Illimit\u00e9e' : `${num(runway, 0)} mois`,
      note: runway === null ? 'la caisse ne se vide pas' : 'au rythme de consommation actuel',
      tone: runway === null ? 'pos' : runway >= 12 ? 'pos' : runway >= 6 ? 'warn' : 'neg',
      go: 'financement', help: 'runway', ico: 'depart' },
  ]
}


/** Le nom des pages, tel que le rail les nomme. */
export const PAGE_NAME = {
  resultats: '\u00c9tats financiers', financement: 'Financement', offre: 'Offre et revenus',
  achats: 'Achats et co\u00fbts', equipe: '\u00c9quipe', projet: 'Mon projet',
}
