/**
 * La vitrine : les dessins de « ton business prend forme ».
 *
 * Cinq barres de chiffre d'affaires qui montent, une trésorerie tracée d'un
 * trait avec son point bas, des montants qui comptent jusqu'à leur valeur.
 * La page de révélation les joue au chargement ; le pitch investisseur les
 * reprend en tête, et les joue quand on arrive dessus.
 */

import { h, svg, euro, monthLabel } from './dom.js'

const n = (v) => Number(v) || 0

/** Cinq barres qui montent l'une après l'autre. */
export function barres(valeurs) {
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
export function courbe(serie, bas, debut) {
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
export function compter(racine) {
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
