/**
 * Le style de la synthèse essai, pour tout le logiciel.
 *
 * La synthèse essai avait trouvé sa forme : des parties numérotées dont le
 * nom dit la question, des cartes où le chiffre s'écrit en grand avec sa
 * valeur exacte dessous, des images qui se tracent quand on arrive dessus.
 * Le reste du logiciel gardait l'ancienne — des cartes grises titrées en
 * petit, des tableaux posés à plat — et l'écart se voyait d'une page à
 * l'autre. Ces briques sont les mêmes partout : les états financiers et les
 * pages de saisie les emploient telles quelles.
 */

import { h, euro, pct } from './dom.js'
import { hot, entree } from './charts.js'
import { changed } from './motion.js'
import { referenceYear } from '../format.js'

const n = (v) => Number(v) || 0

/**
 * L'exercice lu, le même d'une page à l'autre.
 *
 * Choisir l'année 3 aux états financiers puis ouvrir l'équipe doit montrer
 * l'équipe de l'année 3 : un fondateur qui compare ne veut pas rechoisir
 * l'exercice à chaque page.
 */
const lecture = { an: null }
export function anneeLue(r) {
  return Number.isInteger(lecture.an) && lecture.an >= 0 && lecture.an < 5 ? lecture.an : referenceYear(r)
}
export function lireAnnee(k) { lecture.an = k }

/** Un montant en euros : abrégé en grand au-delà de cent mille, exact dessous. */
export const EUROS = (v) => ({ court: euro(v, { compact: Math.abs(v) >= 100000 }), exact: euro(v) })

/** La tête seule d'une partie numérotée, posée au-dessus d'un contenu existant. */
export function entete({ no, nom, dit = null, droite = null }) {
  return h('header', { class: 'sx sx-solo sx-head' },
    h('div', { class: 'sx-no' },
      h('b', {}, String(no).padStart(2, '0')),
      h('span', {}, nom),
      droite ? h('div', { class: 'sx-right' }, droite) : null,
    ),
    dit ? h('p', { class: 'sx-say' }, dit) : null,
  )
}

/**
 * Une partie numérotée.
 *
 * Le numéro et le nom de la partie d'abord — ce dont elle parle, en quelques
 * mots — puis, s'il y a lieu, un titre qui est déjà la réponse et une phrase
 * qui la justifie. `droite` loge un sélecteur (l'exercice lu, par exemple).
 */
export function section({ no, nom, titre = null, dit = null, droite = null, cle = null, classe = '' }, ...corps) {
  const el = h('section', { class: `sx ${classe}` },
    h('header', { class: 'sx-head' },
      h('div', { class: 'sx-no' },
        h('b', {}, String(no).padStart(2, '0')),
        h('span', {}, nom),
        droite ? h('div', { class: 'sx-right' }, droite) : null,
      ),
      titre ? h('h2', { class: 'sx-title' }, titre) : null,
      dit ? h('p', { class: 'sx-say' }, dit) : null,
    ),
    ...corps,
  )
  return cle ? entree(el, `sx:${cle}`) : el
}

/** Cinq pastilles, une par exercice. */
export function exercices(y, choisir) {
  return h('div', { class: 'sx-years', role: 'tablist', 'aria-label': 'Exercice lu' },
    ...Array.from({ length: 5 }, (_, k) => h('button', {
      class: `sx-year ${k === y ? 'is-on' : ''}`,
      role: 'tab', 'aria-selected': String(k === y),
      onClick: () => choisir(k),
    }, `A${k + 1}`)),
  )
}

/**
 * Des cartes de chiffres : le montant en grand, sa valeur exacte, ce qu'il a
 * fait depuis l'an dernier, et ses cinq exercices en barres qu'on clique pour
 * changer d'année.
 *
 * Chaque carte : `{ cle, label, valeurs[5], note(y), ton(v) }` — `ton` rend
 * 'good', 'bad', 'watch' ou 'none'.
 */
export function grandsChiffres(cartes, y, choisir, { cle = 'chiffres' } = {}) {
  return entree(h('div', { class: `sx-cards is-${Math.min(4, cartes.length)}` },
    ...cartes.map((c, i) => carteChiffre(c, i, y, choisir))), `sx-cards:${cle}`)
}

function carteChiffre(c, i, y, choisir) {
  const vals = (c.valeurs || []).map(n)
  const v = vals[y] || 0
  const ton = c.ton ? c.ton(v, y) : 'none'
  const fmt = c.format || EUROS
  const { court, exact } = fmt(v)
  const frais = changed(`sx-${c.cle}`, `${y}:${Math.round(v)}`)

  // Ce que le chiffre a fait en un an : un écart en euros toujours, un
  // pourcentage seulement quand il veut dire quelque chose (deux montants
  // positifs) — « +340 % » d'une perte à un bénéfice ne se lit pas.
  let delta = null
  if (y > 0) {
    const prev = vals[y - 1] || 0
    const d = v - prev
    if (Math.abs(d) >= 1) {
      const rel = prev > 0 && v > 0 ? ` (${d >= 0 ? '+' : '−'}${pct(Math.abs(d) / prev, 0)})` : ''
      const ecart = c.format ? fmt(Math.abs(d)).court : euro(Math.abs(d), { compact: true })
      // Une charge qui monte n'est pas une bonne nouvelle : la couleur suit le
      // sens de ce qu'on mesure, pas celui de la flèche.
      const bien = c.baisseBonne ? d <= 0 : d >= 0
      // Un effectif ou un investissement qui monte n'est ni bien ni mal en
      // soi : `neutre` garde l'écart sans couleur.
      delta = h('span', { class: `sx-delta ${c.neutre ? '' : bien ? 'is-up' : 'is-down'}` },
        `${d >= 0 ? '+' : '−'}${ecart}${rel} sur un an`)
    } else delta = h('span', { class: 'sx-delta' }, 'Stable sur un an')
  }

  const haut = Math.max(0, ...vals)
  const bas = Math.min(0, ...vals)
  const span = haut - bas || 1
  const zero = haut / span

  return h('article', { class: `sx-card is-${ton}`, style: { '--i': String(i) } },
    h('div', { class: 'sx-card-kicker' }, h('i', { 'aria-hidden': 'true' }), c.label),
    h('div', { class: 'sx-big' },
      h('span', { class: `sx-big-val ${frais ? 'is-fresh' : ''}` }, court),
      h('span', { class: 'sx-big-cap' }, court !== exact ? `${exact} · année ${y + 1}` : `Année ${y + 1}${c.unite ? ` · ${c.unite}` : ''}`),
    ),
    delta,
    h('div', { class: 'sx-bars', style: { '--zero': String(zero) } },
      h('i', { class: 'sx-bars-zero', 'aria-hidden': 'true' }),
      ...vals.map((x, k) => {
        const hauteur = `${(Math.abs(x) / span) * 100}%`
        const pose = x >= 0 ? { bottom: `${(1 - zero) * 100}%`, height: hauteur } : { top: `${zero * 100}%`, height: hauteur }
        return hot(h('button', {
          class: `sx-bar ${k === y ? 'is-on' : ''}`,
          'aria-label': `Année ${k + 1} : ${fmt(x).exact}`,
          onClick: () => choisir(k),
        }, h('i', { class: `ch-bar ${x < 0 ? 'is-neg' : ''}`, style: { ...pose, '--i': String(i * 5 + k) } }),
        h('span', { class: 'sx-bar-year' }, `A${k + 1}`)), `${c.label} — année ${k + 1}`, () => [{ label: c.unite || 'Montant', value: fmt(x).exact, strong: true }])
      }),
    ),
    c.note ? h('p', { class: 'sx-card-note' }, c.note(y)) : null,
  )
}
