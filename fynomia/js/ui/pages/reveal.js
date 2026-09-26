/**
 * Ton business prend forme — la page qu'on ne voit qu'une fois.
 *
 * Au sortir du parcours, le fondateur a répondu à une dizaine de questions en
 * quelques minutes. Il ne sait pas encore ce que ça a produit. Le déposer sur
 * un tableau de bord couvert de chiffres, c'est lui montrer un bilan avant de
 * lui montrer son projet.
 *
 * Cette page le lui montre, en une minute et en images : son nom, ce qu'il
 * vend, ses cinq ans de chiffre d'affaires qui montent, sa trésorerie mois
 * par mois, quatre chiffres qui comptent, et les cinq pièces de son dossier
 * qui s'allument. Puis elle l'emmène vers le pitch investisseur — la lecture
 * qui lui dit ce qu'un financeur en retiendra.
 *
 * Elle ne se voit qu'une fois : y revenir mène au pitch.
 */

import { h, euro, num } from '../dom.js'
import { barres, courbe, compter } from '../vitrine.js'
import { uniteOffre } from '../../state/sectors.js'
import { checklist, parAxe } from '../checklist.js'
import { openPilotage } from './dashboard.js'
import store from '../../state/store.js'

const n = (v) => Number(v) || 0
const ME = new RegExp('fondateur|dirigeant|g\u00E9rant|moi', 'i')

/** Ouverte pendant cette visite : un redessin ne doit pas la fermer. */
let ouverte = false

/** La page peut-elle encore se montrer ? Une fois vue, on passe au pitch. */
export function revelationPermise() {
  return ouverte || !store.scenario?.meta?.revealSeen
}

export function renderReveal(navigate) {
  const s = store.scenario
  const r = store.result
  if (!s || !r) { navigate('#/tableau-de-bord'); return h('div') }
  if (!ouverte) {
    ouverte = true
    store.update((sc) => { sc.meta.revealSeen = true }, { label: 'Premier aperçu', silent: true })
  }
  const partir = (vers) => { ouverte = false; vers(); navigate('#/tableau-de-bord') }

  const p = r.pnl, k = r.kpis
  const nom = s.meta.company || s.meta.name || 'Ton projet'
  const a0 = (s.activities || [])[0] || {}
  const voc = uniteOffre(s, a0)
  const prix = n(a0.recurringPrice) > 0 ? `${euro(n(a0.recurringPrice))} par mois` : n(a0.unitPrice) > 0 ? euro(n(a0.unitPrice)) : null
  const offre = a0.name && a0.name !== 'À définir' ? a0.name : null
  const clients = n(a0.volumes?.startUnits)
  const moi = (s.team || []).find((m) => ME.test(m.role || ''))
  const premier = k.firstProfitableYear
  const bas = k.cashLow || {}

  let axes = []
  try { axes = parAxe(checklist(s)) } catch { axes = [] }

  const phrase = [
    offre ? `Tu vends « ${offre} »` : 'Tu vends ton offre',
    prix ? ` à ${prix}` : '',
    clients > 0 ? `, avec ${num(clients, 0)} ${voc.many} dès le premier mois` : '',
    '.',
  ].join('')

  const chiffres = [
    { l: 'Chiffre d’affaires en année 5', v: n(p.revenue[4]), f: (x) => euro(x, { compact: x >= 100000 }) },
    { l: 'Premier bénéfice', t: premier !== null && premier !== undefined ? `Année ${premier + 1}` : 'Au-delà de 5 ans' },
    { l: n(k.fundingNeed) > 0 ? 'À financer au point bas' : 'Trésorerie', v: n(k.fundingNeed) > 0 ? n(k.fundingNeed) : null, t: n(k.fundingNeed) > 0 ? null : 'Toujours positive', f: (x) => euro(x, { compact: x >= 100000 }) },
    { l: 'Ce que tu te verses', v: moi ? n(moi.monthlyGross) * 12 : 0, f: (x) => (x > 0 ? `${euro(x, { compact: x >= 100000 })} / an` : 'Rien pour l’instant') },
  ]

  const el = h('div', { class: 'rvl' },
    h('div', { class: 'rvl-glow', 'aria-hidden': 'true' }),
    h('header', { class: 'rvl-top' },
      h('span', { class: 'rvl-brand' }, 'Fynomia'),
      h('button', { class: 'rvl-skip', onClick: () => partir(openPilotage) }, 'Passer →'),
    ),
    h('main', { class: 'rvl-main' },
      h('p', { class: 'rvl-kicker', style: { '--d': '0s' } }, 'Ton business plan prend forme'),
      h('h1', { class: 'rvl-name' }, ...nom.split(' ').filter(Boolean).map((mot, i) => h('span', { style: { '--d': `${0.25 + i * 0.12}s` } }, mot))),
      h('p', { class: 'rvl-phrase', style: { '--d': '0.9s' } }, phrase),

      h('div', { class: 'rvl-charts' },
        h('figure', { class: 'rvl-chart', style: { '--d': '1.2s' } },
          h('figcaption', {}, h('b', {}, 'Ton chiffre d’affaires'), ' année par année'),
          barres(p.revenue, { debut: r.startDate }),
        ),
        h('figure', { class: 'rvl-chart', style: { '--d': '1.6s' } },
          h('figcaption', {}, h('b', {}, 'Ta trésorerie'), ' mois par mois'),
          courbe(r.cash.balance, bas, r.startDate),
        ),
      ),

      h('div', { class: 'rvl-figs' },
        ...chiffres.map((c, i) => h('div', { class: 'rvl-fig', style: { '--d': `${2.4 + i * 0.18}s` } },
          h('span', { class: 'rvl-fig-l' }, c.l),
          h('b', { class: 'rvl-fig-v', 'data-compte': c.v !== undefined && c.v !== null && c.v > 0 ? String(c.v) : null },
            c.t || (c.f ? c.f(c.v || 0) : String(c.v))),
        )),
      ),

      h('div', { class: 'rvl-dossier' },
        h('p', { class: 'rvl-dossier-t', style: { '--d': '3.2s' } }, 'Les pièces de ton dossier'),
        h('div', { class: 'rvl-pieces' },
          ...axes.map((ax, i) => h('div', { class: `rvl-piece ${ax.part >= 1 ? 'is-full' : ''}`, style: { '--d': `${3.4 + i * 0.16}s`, '--part': String(ax.part) } },
            h('span', { class: 'rvl-piece-ring', 'aria-hidden': 'true' }, h('i')),
            h('span', { class: 'rvl-piece-nom' }, ax.court || ax.label),
            h('span', { class: 'rvl-piece-num' }, `${ax.posees}/${ax.lignes.length}`),
          )),
        ),
      ),

      // Un seul geste à la fin du parcours : continuer. Le pilotage dit
      // ensuite quoi structurer, pièce par pièce.
      h('div', { class: 'rvl-go', style: { '--d': '4.3s' } },
        h('button', { class: 'rvl-cta', onClick: () => partir(openPilotage) }, 'Continuer à structurer →'),
      ),
    ),
  )
  // Les chiffres montent jusqu'à leur valeur, une fois la page posée.
  setTimeout(() => compter(el), 60)
  return el
}

