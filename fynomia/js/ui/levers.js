/**
 * Leviers : des curseurs branchés sur de vrais champs du modèle.
 *
 * Pendant qu'on tire le curseur, le modèle est recalculé et les indicateurs
 * du persona bougent — sans redessiner la page, sinon le curseur serait
 * arraché de sous le doigt. À la fin du geste seulement, la modification entre
 * dans l'historique et devient annulable.
 */

import { h, euro, num, pct, helpButton } from './dom.js'
import { resolveLever } from './personas.js'
import { compute } from '../engine/engine.js'
import { causalChain } from './impact.js'
import store from '../state/store.js'

/**
 * Panneau de leviers.
 *
 * @param levers  liste issue de activeLevers()
 * @param onLive  (resultatProvisoire) => void, appelé pendant le geste
 * @param onDone  () => void, appelé à la fin du geste
 */
export function leverPanel(levers, { onLive, onDone }) {
  if (!levers.length) return null

  return h('section', { class: 'panel panel-levers' },
    h('header', { class: 'panel-head' },
      h('h2', {}, 'Vos leviers'),
      h('p', { class: 'panel-sub' }, "Tirez un curseur : tout se recalcule pendant le geste."),
    ),
    h('div', { class: 'levers' }, ...levers.map((lever) => leverRow(lever, { onLive, onDone }))),
  )
}

function leverRow(lever, { onLive, onDone }) {
  const resolved = resolveLever(store.scenario, lever)
  if (!resolved) return null

  const initial = Number(resolved.current) || 0
  const value = h('output', { class: 'lever-value num' }, lever.format(initial))
  const shift = h('span', { class: 'lever-shift num' }, '')

  // Bornes élargies si la valeur saisie sort de la plage proposée.
  const min = Math.min(lever.min, initial)
  const max = Math.max(lever.max, initial * 1.6 || lever.max)

  const input = h('input', {
    type: 'range', min, max, step: lever.step, value: initial,
    'aria-label': lever.label,
    class: 'lever-range',
  })

  const write = (raw) => {
    const target = resolveLever(store.scenario, lever)
    if (!target) return null
    target.object[target.key] = raw
    return raw
  }

  // Pendant le geste : on écrit dans le scénario et on recalcule, mais sans
  // passer par le magasin — pas d'historique, pas de rendu complet.
  input.addEventListener('input', () => {
    const raw = Number(input.value)
    write(raw)
    value.textContent = lever.format(raw)
    const delta = raw - initial
    shift.textContent = delta === 0 ? '' : `${delta > 0 ? '+' : '−'}${lever.format(Math.abs(delta)).replace('−', '')}`
    shift.className = `lever-shift num ${delta === 0 ? '' : delta > 0 ? 'up' : 'down'}`
    try {
      onLive(compute(store.scenario))
    } catch { /* un état transitoire incohérent n'a pas à interrompre le geste */ }
  })

  // Fin du geste : on repasse par le magasin pour l'historique et la sauvegarde.
  const commit = () => {
    const raw = Number(input.value)
    if (raw === initial) return
    // Remettre la valeur d'origine avant de la rejouer via le magasin, sinon
    // l'instantané d'annulation contiendrait déjà la nouvelle valeur.
    write(initial)
    store.update((sc) => {
      const t = resolveLever(sc, lever)
      if (t) t.object[t.key] = raw
    }, { label: lever.label })
    onDone()
  }
  input.addEventListener('change', commit)
  input.addEventListener('pointerup', commit)
  input.addEventListener('keyup', (e) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) commit() })

  return h('div', { class: 'lever' },
    h('div', { class: 'lever-top' },
      h('label', { class: 'lever-label' }, lever.label),
      h('div', { class: 'lever-readout' }, value, shift),
    ),
    input,
    h('div', { class: 'lever-foot' },
      h('span', { class: 'lever-why' }, lever.why || ''),
      lever.field && causalChain(lever.field),
    ),
  )
}

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
