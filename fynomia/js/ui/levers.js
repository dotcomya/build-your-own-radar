/**
 * Le tableau d'indicateurs d'un persona : ses chiffres de l'année de
 * référence, chacun avec sa note et son entrée du glossaire.
 */

import { h, euro, num, pct, helpButton } from './dom.js'

/**
 * Tableau d'indicateurs d'un persona, capable de se mettre à jour seul pendant
 * qu'un curseur bouge : on rend une fois, puis on réécrit les valeurs en place.
 */
export function metricBoard(persona, result, { glossary = true } = {}) {
  const board = h('div', { class: 'metrics' })
  const cells = []

  const build = (r) => {
    const y = referenceYearOf(r)
    board.replaceChildren(...persona.metrics.map((key, i) => {
      const m = METRICS_SAFE[key]
      if (!m) return null
      const raw = m.read(r, y)
      const valueEl = h('div', { class: 'metric-value num' }, m.format(raw))
      cells[i] = { valueEl, metric: m }
      return h('div', { class: 'metric' },
        h('div', { class: 'metric-label' }, m.label, glossary && m.glossary ? helpButton(m.glossary) : null),
        valueEl,
        h('div', { class: 'metric-note' }, noteFor(key, r, y)),
      )
    }).filter(Boolean))
  }

  build(result)

  /** Réécrit les valeurs sans reconstruire le DOM. */
  board.updateWith = (r) => {
    const y = referenceYearOf(r)
    persona.metrics.forEach((key, i) => {
      const cell = cells[i]
      if (!cell) return
      const raw = cell.metric.read(r, y)
      cell.valueEl.textContent = cell.metric.format(raw)
      cell.valueEl.parentElement?.querySelector('.metric-note')?.replaceChildren(document.createTextNode(noteFor(key, r, y)))
    })
  }
  return board
}

function referenceYearOf(r) {
  const i = r.pnl.netResult.findIndex((v) => v > 0)
  return i >= 0 ? i : 2
}

function noteFor(key, r, y) {
  switch (key) {
    case 'revenue': return `Année ${y + 1}`
    case 'ebitda': return `${pct(r.kpis.ebitdaMargin[y])} du CA`
    case 'netResult': return `${pct(r.kpis.netMargin[y])} du CA`
    case 'breakEven': {
      const be = r.kpis.breakEven[y]
      if (!be) return 'Marge insuffisante'
      return r.pnl.revenue[y] >= be ? 'Atteint' : `${pct(r.pnl.revenue[y] / be, 0)} couvert`
    }
    case 'fundingNeed': return r.kpis.fundingNeed > 0 ? `Point bas mois ${r.kpis.cashLow.month + 1}` : 'Aucun'
    case 'runway': return r.kpis.burnRate > 0 ? `${euro(r.kpis.burnRate)} par mois` : 'Pas de consommation'
    case 'cashLow': return `Mois ${r.kpis.cashLow.month + 1}`
    case 'peakBfr': return 'À financer en permanence'
    case 'cac': return r.kpis.ltvCacRatio ? `LTV/CAC ${num(r.kpis.ltvCacRatio, 1)}×` : 'Aucune campagne'
    case 'ltv': return 'Marge par client'
    case 'ltvCac': return r.kpis.ltvCacRatio >= 3 ? 'Sain' : r.kpis.ltvCacRatio >= 1 ? 'Juste' : 'Non rentable'
    case 'payrollCost': return `Année ${y + 1}`
    case 'payrollRatio': return r.kpis.payrollRatio[y] > 0.6 ? 'Au-dessus du seuil tenable' : 'Soutenable'
    case 'headcount': return `Fin d'année ${y + 1}`
    case 'grossMargin': return `${pct(r.kpis.marginRate[y])} du CA`
    case 'marginRate': return 'Sur coûts variables'
    case 'recurringShare': return 'Du chiffre d\'affaires'
    case 'arpu': return 'Par unité vendue'
    case 'jeiSaving': return r.jei[y]?.eligible ? 'Statut acquis' : 'Non éligible'
    case 'credits': return 'CIR et CII'
    case 'corporateTax': return `Année ${y + 1}`
    case 'ebitdaMargin': return `Année ${y + 1}`
    default: return ''
  }
}

// Import tardif pour éviter une dépendance circulaire à l'initialisation.
import { METRICS } from './personas.js'
const METRICS_SAFE = METRICS
