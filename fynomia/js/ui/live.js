/**
 * Le modèle, en direct.
 *
 * Une page de saisie sans retour immédiat est un formulaire : on remplit sans
 * savoir ce qu'on déplace. Ce bandeau reste à l'écran quel que soit le module
 * ouvert et répond en continu à trois questions — combien ça fait, ce que
 * chaque réponse alimente ailleurs, et où en est le dossier.
 *
 * Il ne se saisit rien ici. Tout ce qu'il affiche vient d'être calculé par le
 * moteur, dans le navigateur, sans qu'aucune donnée sorte de la machine.
 */

import { h, euro, num } from './dom.js'
import { buildState } from '../engine/build.js'
import store from '../state/store.js'

/** Ce que chaque famille de réponses alimente dans le modèle. */
const FEEDS = [
  { label: 'Compte de résultat', from: 'revenus · coûts · équipe' },
  { label: 'Trésorerie', from: 'délais · paiements · investissements' },
  { label: 'Financement', from: 'besoins · ressources' },
  { label: 'Cadre', from: 'juridique · fiscal · social' },
]

export function liveRail(navigate) {
  const s = store.scenario
  const r = store.result
  if (!s) return null
  const b = buildState(s)

  const payroll = r ? yearOf(r.payroll.cost, 0) : 0
  const fixed = r ? (r.pnl.external[0] || 0) + (r.pnl.duties[0] || 0) : 0
  const capex = (s.capex || []).reduce((a, c) => a + (Number(c.amount) || 0), 0)
  const low = r ? r.kpis.cashLow.value : 0

  return h('aside', { class: 'live' },
    h('div', { class: 'live-card' },
      h('div', { class: 'live-head' },
        h('span', {}, 'Modèle live'),
        h('span', { class: 'live-local' }, h('i', { class: 'live-dot' }), ' Calcul local'),
      ),
      h('div', { class: 'live-hero-label' }, 'CA année 1'),
      h('div', { class: 'live-hero-value' }, r ? euro(r.pnl.revenue[0], { compact: true }) : '—'),
      h('div', { class: 'live-grid' },
        cell('Coûts fixes A1', euro(fixed, { compact: true })),
        cell('Masse salariale', euro(payroll, { compact: true })),
        cell('Investissements', euro(capex, { compact: true })),
        cell('Point bas cash', euro(low, { compact: true }), low < 0),
      ),
    ),

    h('div', { class: 'live-card' },
      h('div', { class: 'live-head' }, h('span', {}, 'Ce que tes réponses alimentent')),
      h('div', { class: 'live-rows' },
        ...FEEDS.map((f) => h('div', { class: 'live-row' }, h('b', {}, f.label), h('span', {}, f.from))),
      ),
    ),

    h('div', { class: 'live-card' },
      h('div', { class: 'live-head' }, h('span', {}, 'Complétude du dossier')),
      h('div', { class: 'live-steps' },
        ...b.bricks.map((x) => h('button', {
          class: `live-step ${x.done ? 'done' : ''} ${x.current ? 'current' : ''}`,
          onClick: () => navigate(`#/${x.page}`),
        }, h('i'), h('span', {}, x.label))),
      ),
    ),

    // Ce qui vient d'être débloqué, et ce qui suit. Deux phrases : le reste
    // serait du remplissage.
    (b.latest || b.upcoming) && h('div', { class: 'live-unlock' },
      b.latest
        ? h('div', {},
            h('div', { class: 'live-unlock-tag' }, 'Débloqué'),
            h('div', { class: 'live-unlock-text' }, b.latest.label))
        : h('div', {},
            h('div', { class: 'live-unlock-tag' }, 'Première étape'),
            h('div', { class: 'live-unlock-text' }, 'Pose un prix et des volumes.')),
      b.upcoming && h('div', { class: 'live-unlock-next' },
        `Ensuite : ${b.upcoming.label.toLowerCase()} Il manque ${listing(b.upcoming.missing)}.`),
    ),
  )
}

const cell = (label, value, neg = false) => h('div', { class: `live-cell ${neg ? 'is-neg' : ''}` },
  h('div', { class: 'live-cell-label' }, label),
  h('div', { class: 'live-cell-value num' }, value),
)

const listing = (arr) => {
  const list = (arr || []).filter(Boolean).map((x) => x.toLowerCase())
  if (list.length <= 1) return list[0] || 'une réponse'
  return `${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}`
}

const yearOf = (arr, y) => (arr || []).slice(y * 12, y * 12 + 12).reduce((a, x) => a + x, 0)
