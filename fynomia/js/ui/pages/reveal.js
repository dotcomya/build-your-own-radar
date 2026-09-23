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

import { h, svg, euro, num, monthLabel } from '../dom.js'
import { vocabulary } from '../../state/sectors.js'
import { checklist, parAxe } from '../checklist.js'
import { openPitch, openPilotage } from './dashboard.js'
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
  const voc = vocabulary(s)
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
      h('button', { class: 'rvl-skip', onClick: () => partir(openPitch) }, 'Passer →'),
    ),
    h('main', { class: 'rvl-main' },
      h('p', { class: 'rvl-kicker', style: { '--d': '0s' } }, 'Ton business plan prend forme'),
      h('h1', { class: 'rvl-name' }, ...nom.split(' ').filter(Boolean).map((mot, i) => h('span', { style: { '--d': `${0.25 + i * 0.12}s` } }, mot))),
      h('p', { class: 'rvl-phrase', style: { '--d': '0.9s' } }, phrase),

      h('div', { class: 'rvl-charts' },
        h('figure', { class: 'rvl-chart', style: { '--d': '1.2s' } },
          h('figcaption', {}, h('b', {}, 'Ton chiffre d’affaires'), ' année par année'),
          barres(p.revenue),
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

      h('div', { class: 'rvl-go', style: { '--d': '4.3s' } },
        h('button', { class: 'rvl-cta', onClick: () => partir(openPitch) }, 'Voir ce qu’un investisseur en retiendra →'),
        h('button', { class: 'rvl-ghost', onClick: () => partir(openPilotage) }, 'Compléter mon dossier d’abord'),
      ),
    ),
  )
  // Les chiffres montent jusqu'à leur valeur, une fois la page posée.
  setTimeout(() => compter(el), 60)
  return el
}

/** Cinq barres qui montent l'une après l'autre. */
function barres(valeurs) {
  const vals = (valeurs || []).map(n)
  const max = Math.max(1, ...vals)
  const W = 460, H = 210, base = 180, larg = 58, pas = 88, x0 = 34
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'rvl-svg', role: 'img', 'aria-label': 'Chiffre d’affaires sur cinq ans' },
    svg('line', { x1: 10, x2: W - 10, y1: base, y2: base, class: 'rvl-axis' }),
    ...vals.flatMap((v, i) => {
      const hh = Math.max(2, (Math.max(0, v) / max) * 150)
      const x = x0 + i * pas
      return [
        svg('rect', { x, y: base - hh, width: larg, height: hh, rx: 6, class: 'rvl-bar', style: `--i:${i}` }),
        svg('text', { x: x + larg / 2, y: base - hh - 9, class: 'rvl-bar-v', style: `--i:${i}`, 'text-anchor': 'middle' }, euro(v, { compact: true })),
        svg('text', { x: x + larg / 2, y: base + 20, class: 'rvl-bar-y', 'text-anchor': 'middle' }, `A${i + 1}`),
      ]
    }),
  )
}

/** La trésorerie, tracée d'un trait, et son point bas marqué. */
function courbe(serie, bas, debut) {
  const vals = (serie || []).map(n)
  if (!vals.length) return h('div')
  const W = 460, H = 210, t = 24, b = 186
  const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals)
  const span = hi - lo || 1
  const x = (m) => 14 + (m / Math.max(1, vals.length - 1)) * (W - 28)
  const y = (v) => t + (1 - (v - lo) / span) * (b - t)
  const d = vals.map((v, m) => `${m ? 'L' : 'M'}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const aire = `${d} L${x(vals.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
  const mb = Number.isInteger(bas?.month) ? bas.month : vals.indexOf(Math.min(...vals))
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'rvl-svg', role: 'img', 'aria-label': 'Trésorerie sur soixante mois' },
    svg('line', { x1: 10, x2: W - 10, y1: y(0), y2: y(0), class: 'rvl-axis' }),
    svg('path', { d: aire, class: 'rvl-area' }),
    svg('path', { d, class: 'rvl-line', pathLength: 1 }),
    ...[0, 1, 2, 3, 4].map((a) => svg('text', { x: x(a * 12) + 4, y: H - 4, class: 'rvl-bar-y' }, `A${a + 1}`)),
    vals[mb] < 0 ? svg('g', { class: 'rvl-low' },
      svg('circle', { cx: x(mb), cy: y(vals[mb]), r: 6 }),
      svg('text', { x: Math.min(W - 120, x(mb) + 10), y: Math.min(H - 20, y(vals[mb]) + 4), class: 'rvl-low-t' }, `Point bas ${monthLabel(mb, debut)}`),
    ) : null,
  )
}

/** Les montants montent de zéro à leur valeur, en un peu plus d'une seconde. */
function compter(racine) {
  if (!racine.isConnected) return
  const calme = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  racine.querySelectorAll('[data-compte]').forEach((b) => {
    const cible = Number(b.dataset.compte) || 0
    const fin = b.textContent
    if (calme || cible <= 0) return
    const delai = (parseFloat(getComputedStyle(b.parentElement).getPropertyValue('--d')) || 0) * 1000
    const duree = 1100
    b.textContent = euro(0)
    setTimeout(() => {
      const t0 = performance.now()
      const pas = (t) => {
        const q = Math.min(1, (t - t0) / duree)
        const e = 1 - Math.pow(1 - q, 3)
        b.textContent = q < 1 ? euro(Math.round(cible * e), { compact: cible >= 100000 }) : fin
        if (q < 1) requestAnimationFrame(pas)
      }
      requestAnimationFrame(pas)
    }, delai)
  })
}
