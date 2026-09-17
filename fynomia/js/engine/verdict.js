/**
 * Le verdict : ce qu'il faut retenir d'un modèle, en un mot.
 *
 * Un prévisionnel ne se lit pas, il se juge. Cette fonction fait le tri à la
 * place du lecteur : elle cherche le premier défaut rédhibitoire dans un ordre
 * de gravité — vendre à perte, ne jamais devenir rentable, manquer d'argent en
 * route — et ne descend au diagnostic suivant que si le précédent est écarté.
 * Le chiffre qu'elle renvoie est celui qui décide, pas le plus flatteur.
 *
 * Elle vit dans le moteur, et non dans une page, pour que l'écran et le
 * document exporté disent exactement la même chose. Un business plan dont la
 * première diapositive contredit le tableau de bord ne vaut rien.
 */

import { euro, monthLabel, yearLabel, referenceYear } from '../format.js'
import { founderIncome } from './founder.js'

export function verdict(result, scenario) {
  const k = result.kpis, p = result.pnl
  const y = referenceYear(result)

  if (k.marginRate[y] <= 0 && p.revenue[y] > 0) {
    const units = result.revenue.units.reduce((a, b) => a + b, 0)
    return {
      word: 'Ne tient pas', tone: 'bad',
      line: 'Vous vendez à perte.',
      body: "Le coût de revient dépasse le prix de vente : chaque unité supplémentaire creuse le résultat, et aucun point mort n'existe. Rien d'autre ne compte tant que ce n'est pas corrigé.",
      figure: { label: 'Marge unitaire', value: euro(k.marginRate[y] * (p.revenue[y] / Math.max(1, units))), tone: 'bad' },
    }
  }

  if (p.revenue.every((v) => v === 0)) {
    return {
      word: 'À chiffrer', tone: 'neutral',
      line: "Aucun revenu n'est encore modélisé.",
      body: "Renseignez ce que vous vendez, à quel prix et à combien de clients : tout le reste en découle.",
      figure: { label: "Chiffre d'affaires", value: '—', tone: 'neutral' },
    }
  }

  if (k.fundingNeed > 0 && k.firstProfitableYear === null) {
    return {
      word: 'Ne tient pas', tone: 'bad',
      line: `Pas de rentabilité en cinq ans, et ${euro(k.fundingNeed)} à trouver.`,
      body: "Le modèle consomme sans jamais basculer. Soit les volumes sont sous-estimés, soit la structure est trop lourde pour ce marché. En l'état, aucun financeur ne suivra.",
      figure: { label: 'Il manque', value: euro(k.fundingNeed), tone: 'bad' },
    }
  }

  if (k.fundingNeed > 0) {
    return {
      word: 'Fragile', tone: 'watch',
      line: `Rentable en année ${k.firstProfitableYear + 1}, à condition de tenir jusque-là.`,
      body: `La trésorerie descend à ${euro(k.cashLow.value)} en ${monthLabel(k.cashLow.month, result.startDate)}. Réunir ce montant avant cette date est la seule question qui compte aujourd'hui.`,
      figure: { label: `À réunir avant ${monthLabel(k.cashLow.month, result.startDate)}`, value: euro(k.fundingNeed), tone: 'watch' },
    }
  }

  if (k.firstProfitableYear === null) {
    return {
      word: 'À consolider', tone: 'watch',
      line: 'La trésorerie tient, la rentabilité non.',
      body: "Vous ne manquerez pas d'argent, mais aucun exercice n'est bénéficiaire. Une entreprise financée qui ne gagne pas d'argent reste une entreprise qui ne gagne pas d'argent.",
      figure: { label: 'EBITDA année 5', value: euro(p.ebitda[4]), tone: 'watch' },
    }
  }

  // Le modèle se finance seul : le chiffre décisif devient ce que touche le
  // dirigeant, seule réponse à la question que tout le monde pose vraiment.
  let takeHome = null
  try {
    const income = founderIncome(scenario, result)
    const row = income.rows.find((x) => x.disposable > 0) || income.rows[y]
    if (row && row.disposable > 0) takeHome = row.monthly
  } catch { /* sans dirigeant modélisé, on retombe sur l'EBITDA */ }

  return {
    word: 'Solide', tone: 'good',
    line: `Rentable dès l'année ${k.firstProfitableYear + 1}, sans financement complémentaire.`,
    body: `${euro(p.revenue[y])} de chiffre d'affaires, ${euro(p.ebitda[y])} d'EBITDA, point mort à ${euro(k.breakEven[y] || 0)}. Le modèle se finance seul — reste à démontrer que les volumes sont atteignables.`,
    figure: takeHome !== null
      ? { label: 'Pour vous, par mois', value: euro(takeHome), tone: 'good', link: '#/mon-revenu' }
      : { label: `EBITDA ${yearLabel(y).toLowerCase()}`, value: euro(p.ebitda[y]), tone: 'good' },
  }
}
