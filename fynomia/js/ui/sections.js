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

import { h, euro, pct, monthLabel } from './dom.js'
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
  return h('header', { class: 'sx sx-solo sx-head' }, ligneTitre({ no, nom, dit, droite }))
}

/**
 * La ligne de tête d'une partie : le numéro, le nom, la phrase qui dit à
 * quoi elle sert — sur la même ligne, pour ne pas en coûter trois — et, au
 * bout, ce qui la règle (l'exercice lu, un avertissement).
 */
function ligneTitre({ no, nom, dit, droite }) {
  return h('div', { class: 'sx-no' },
    no === null || no === undefined ? null : h('b', {}, String(no).padStart(2, '0')),
    h('span', { class: 'sx-name' }, nom),
    dit ? h('p', { class: 'sx-say' }, dit) : null,
    droite ? h('div', { class: 'sx-right' }, droite) : null,
  )
}

/**
 * Une partie numérotée.
 *
 * Le numéro et le nom de la partie d'abord — ce dont elle parle, en quelques
 * mots, dans la typographie des titres du tableau de bord — avec, sur la même
 * ligne, la phrase qui la justifie. `titre`, s'il y a lieu, est déjà la
 * réponse. `droite` loge un sélecteur (l'exercice lu, par exemple).
 */
export function section({ no, nom, titre = null, dit = null, droite = null, cle = null, classe = '' }, ...corps) {
  const el = h('section', { class: `sx ${classe}` },
    h('header', { class: 'sx-head' },
      ligneTitre({ no, nom, dit, droite }),
      titre ? h('h2', { class: 'sx-title' }, titre) : null,
    ),
    ...corps,
  )
  return cle ? entree(el, `sx:${cle}`, { classe: 'rv', min: 0.12 }) : el
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
 * fait depuis l'an dernier, et ses cinq exercices en barres.
 *
 * Cliquer une barre choisit l'exercice et, si la carte connaît ses mois
 * (`mensuel`, soixante valeurs), zoome dedans : les douze mois de l'année
 * remplacent les cinq ans, comme si l'on descendait d'un étage. « ← 5 ans »
 * remonte.
 *
 * Chaque carte : `{ cle, label, valeurs[5], mensuel?[60], note(y), pourquoi,
 * ton(v), format, unite, baisseBonne, neutre }`. `compact` : la version des
 * pages de saisie, qui laisse la place aux champs.
 */
export function grandsChiffres(cartes, y, choisir, { cle = 'chiffres', compact = false, debut = null } = {}) {
  return h('div', { class: `sx-cards is-${Math.min(4, cartes.length)} ${compact ? 'is-compact' : ''}` },
    ...cartes.map((c, i) => carteChiffre(c, i, y, choisir, cle, { compact, debut })))
}

/** L'année dans laquelle une carte est zoomée, par carte. */
const zooms = new Map()

function carteChiffre(c, i, y, choisir, groupe, { compact, debut }) {
  const vals = (c.valeurs || []).map(n)
  const v = vals[y] || 0
  const ton = c.ton ? c.ton(v, y) : 'none'
  const fmt = c.format || EUROS
  const { court, exact } = fmt(v)
  const frais = changed(`sx-${groupe}-${c.cle}`, `${y}:${Math.round(v)}`)
  const cleZoom = `${groupe}:${c.cle}`
  const mensuel = Array.isArray(c.mensuel) && c.mensuel.length >= 60 ? c.mensuel.map(n) : null
  // Le zoom suit l'exercice lu : changer d'année ailleurs le déplace.
  if (zooms.has(cleZoom) && mensuel) zooms.set(cleZoom, y)
  const zoom = mensuel && zooms.has(cleZoom) ? y : null

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
      // sens de ce qu'on mesure, pas celui de la flèche. Un effectif ou un
      // investissement qui monte n'est ni bien ni mal : `neutre`.
      const bien = c.baisseBonne ? d <= 0 : d >= 0
      delta = h('span', { class: `sx-delta ${c.neutre ? '' : bien ? 'is-up' : 'is-down'}` },
        `${d >= 0 ? '+' : '−'}${ecart}${rel} sur un an`)
    } else delta = h('span', { class: 'sx-delta' }, 'Stable sur un an')
  }

  // Les barres : cinq ans, ou les douze mois de l'année zoomée.
  const serie = zoom !== null ? mensuel.slice(zoom * 12, zoom * 12 + 12) : vals
  const haut = Math.max(0, ...serie)
  const bas = Math.min(0, ...serie)
  const span = haut - bas || 1
  const zero = haut / span
  const etiquette = (k) => (zoom !== null ? monthLabel(zoom * 12 + k, debut).charAt(0).toUpperCase() : `A${k + 1}`)
  const titreBarre = (k) => (zoom !== null ? `${c.label} — ${monthLabel(zoom * 12 + k, debut)}` : `${c.label} — année ${k + 1}`)

  const barres = entree(h('div', { class: `sx-bars ${zoom !== null ? 'is-zoom' : ''}`, style: { '--zero': String(zero), '--ox': `${zoom !== null ? (zoom + 0.5) * 20 : 50}%` } },
    h('i', { class: 'sx-bars-zero', 'aria-hidden': 'true' }),
    ...serie.map((x, k) => {
      const hauteur = `${(Math.abs(x) / span) * 100}%`
      const pose = x >= 0 ? { bottom: `${(1 - zero) * 100}%`, height: hauteur } : { top: `${zero * 100}%`, height: hauteur }
      return hot(h('button', {
        class: `sx-bar ${zoom === null && k === y ? 'is-on' : ''}`,
        'aria-label': `${titreBarre(k)} : ${fmt(x).exact}`,
        onClick: () => {
          if (zoom !== null) return
          // Un clic sur l'année lue descend dans ses mois ; sur une autre, la
          // choisit (et y descend si la carte connaît ses mois).
          if (mensuel) zooms.set(cleZoom, k)
          choisir(k)
        },
      }, h('i', { class: `ch-bar ${x < 0 ? 'is-neg' : ''}`, style: { ...pose, '--i': String(k) } }),
      h('span', { class: 'sx-bar-year' }, etiquette(k))), titreBarre(k), () => [{ label: c.unite || 'Montant', value: fmt(x).exact, strong: true }])
    }),
  // Les barres poussent quand on les voit entières ; un zoom se rejoue.
  ), `sx-bars:${groupe}:${c.cle}:${zoom === null ? 'ans' : zoom}`, { min: 0.95 })

  const pied = h('div', { class: 'sx-bars-foot' },
    zoom !== null
      ? [h('span', {}, `Année ${zoom + 1}, mois par mois`),
          h('button', { class: 'sx-unzoom', onClick: () => { zooms.delete(cleZoom); choisir(y) } }, '← 5 ans')]
      : (mensuel ? h('span', {}, 'Clique une année pour voir ses mois') : null),
  )

  return h('article', { class: `sx-card is-${ton} ${compact ? 'is-compact' : ''}`, style: { '--i': String(i) } },
    h('div', { class: 'sx-card-kicker' }, h('i', { 'aria-hidden': 'true' }), c.label,
      compact && (c.pourquoi || c.note) ? h('span', { class: 'sx-why', title: [c.note ? c.note(y) : '', c.pourquoi || ''].filter(Boolean).join(' — '), 'aria-label': 'Pourquoi ce chiffre compte' }, 'i') : null),
    h('div', { class: 'sx-big' },
      h('span', { class: `sx-big-val ${frais ? 'is-fresh' : ''}` }, court),
      h('span', { class: 'sx-big-cap' }, court !== exact ? `${exact} · année ${y + 1}` : `Année ${y + 1}${c.unite ? ` · ${c.unite}` : ''}`),
    ),
    delta,
    barres,
    pied,
    !compact && c.note ? h('p', { class: 'sx-card-note' }, c.note(y)) : null,
    !compact && c.pourquoi ? h('p', { class: 'sx-card-why' }, h('b', {}, 'Pourquoi c’est important · '), c.pourquoi) : null,
  )
}
