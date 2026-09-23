/**
 * Une suggestion acceptée, et que ça se voie.
 *
 * Accepter une suggestion faisait monter un petit « + » et apparaître une
 * notification en bas d'écran. C'était juste, et presque invisible : la
 * pastille disparaissait sous le doigt, la ligne ajoutée arrivait quelque part
 * plus bas sans qu'on sache où, et rien ne reliait les deux.
 *
 * Le geste a maintenant trois temps, en moins d'une seconde :
 *
 *   1. l'éclat — des petites icônes jaillissent de la pastille (étincelles,
 *      croix, pièces), dans les couleurs de la maison ;
 *   2. le trajet — une copie de la pastille, cochée, quitte la rangée et
 *      vole jusqu'à la ligne qui vient d'être créée ;
 *   3. l'arrivée — la ligne entre en glissant et s'entoure un instant de la
 *      même lumière que la carte qu'on travaille.
 *
 * Tout se pose sur la page, hors de tout parent, pour qu'aucun bloc à
 * débordement caché ne le tronque, et tout s'efface de lui-même. Quand le
 * mouvement est refusé par le système, seule l'arrivée reste signalée.
 */

const reduit = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/* Les icônes de l'éclat : dessinées ici, en trait plein, pour rester nettes
   à seize pixels et ne dépendre d'aucune police. */
const ICONES = {
  etincelle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6-2.6 7.9-2.6-7.9L1.5 12l7.9-2.6z" fill="currentColor"/></svg>',
  croix: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" fill="currentColor"/></svg>',
  piece: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="currentColor"/><path d="M15.4 8.6a4.6 4.6 0 1 0 0 6.8M7 10.8h6M7 13.4h6" fill="none" stroke="#0E0F0C" stroke-width="1.8" stroke-linecap="round"/></svg>',
  anneau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3.2"/></svg>',
  outil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l9-5 9 5v8l-9 5-9-5z" fill="currentColor"/><path d="M3 8l9 5 9-5M12 13v8" fill="none" stroke="#0E0F0C" stroke-width="1.5" stroke-linejoin="round"/></svg>',
}
const COCHE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/* Ce qui jaillit dépend de ce qu'on ajoute : des pièces pour une charge, du
   matériel pour un investissement, des étincelles pour une offre. */
const MELANGE = {
  opex: ['piece', 'etincelle', 'croix', 'anneau', 'piece', 'etincelle'],
  capex: ['outil', 'etincelle', 'croix', 'anneau', 'outil', 'etincelle'],
  offers: ['etincelle', 'piece', 'croix', 'anneau', 'etincelle', 'etincelle'],
}
const TEINTES = ['is-lime', 'is-ink', 'is-blue', 'is-lime', 'is-dim']

/**
 * L'éclat, le trajet, l'arrivée.
 *
 * `depuis` est la pastille cliquée — mesurée tout de suite, avant que le
 * rendu ne la remplace. `cible` est un sélecteur : la ligne créée n'existe
 * qu'après le rendu, on la cherche donc pendant une demi-seconde.
 */
export function celebrate(depuis, { kind = 'opex', label = '', cible = null } = {}) {
  // Une pastille ou sa mesure : le rendu qui suit le clic peut l'avoir déjà
  // remplacée, on accepte donc un rectangle relevé juste avant.
  let r
  try { r = typeof depuis.getBoundingClientRect === 'function' ? depuis.getBoundingClientRect() : depuis } catch { return }
  if (!r || !r.width) return
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2

  if (!reduit()) {
    eclat(cx, cy, kind)
    trajet(r, label, cible)
  } else if (cible) {
    attendre(cible, (el) => arrivee(el))
  }
}

/** Les petites icônes, en couronne irrégulière autour du point de départ. */
function eclat(cx, cy, kind) {
  const noms = MELANGE[kind] || MELANGE.opex
  const nb = 14
  for (let i = 0; i < nb; i++) {
    const angle = (i / nb) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
    const dist = 46 + Math.random() * 46
    const bit = document.createElement('span')
    bit.className = `burst-bit ${TEINTES[i % TEINTES.length]}`
    bit.innerHTML = ICONES[noms[i % noms.length]]
    const taille = 11 + Math.round(Math.random() * 9)
    bit.style.cssText = `left:${cx}px;top:${cy}px;width:${taille}px;height:${taille}px;` +
      `--dx:${Math.cos(angle) * dist}px;--dy:${Math.sin(angle) * dist - 14}px;` +
      `--rot:${Math.round((Math.random() - 0.5) * 320)}deg;animation-delay:${Math.round(Math.random() * 60)}ms`
    document.body.appendChild(bit)
    setTimeout(() => bit.remove(), 1000)
  }
  // Un anneau d'onde, le temps d'un battement : il dit « pris » avant tout.
  const onde = document.createElement('span')
  onde.className = 'burst-wave'
  onde.style.cssText = `left:${cx}px;top:${cy}px`
  document.body.appendChild(onde)
  setTimeout(() => onde.remove(), 800)
}

/** La pastille cochée quitte la rangée et rejoint la ligne créée. */
function trajet(r, label, cible) {
  const fantome = document.createElement('span')
  fantome.className = 'burst-ghost'
  fantome.innerHTML = `<i>${COCHE}</i><b></b>`
  fantome.querySelector('b').textContent = label
  fantome.style.cssText = `left:${r.left}px;top:${r.top}px;height:${Math.max(30, r.height)}px`
  document.body.appendChild(fantome)

  const partir = (el, sel) => {
    const g = fantome.getBoundingClientRect()
    let dx = 0, dy = -70, echelle = 0.7
    if (el) {
      const t = el.getBoundingClientRect()
      const visible = t.top > 40 && t.bottom < window.innerHeight - 20
      if (visible) {
        dx = t.left + 24 - g.left
        dy = t.top + Math.min(t.height, 44) / 2 - (g.top + g.height / 2)
        echelle = 0.55
      }
    }
    try {
      const vol = fantome.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
        { transform: 'translate(0, -10px) scale(1.08)', opacity: 1, offset: 0.25 },
        { transform: `translate(${dx}px, ${dy}px) scale(${echelle})`, opacity: 0.15, offset: 1 },
      ], { duration: 780, easing: 'cubic-bezier(.5, 0, .2, 1)', fill: 'forwards' })
      vol.onfinish = () => { fantome.remove(); if (el) arrivee(el, sel) }
    } catch {
      fantome.remove(); if (el) arrivee(el, sel)
    }
    setTimeout(() => fantome.remove(), 1400)
  }

  if (cible) attendre(cible, (el) => partir(el, cible), () => partir(null))
  else setTimeout(() => partir(null), 60)
}

/**
 * La ligne arrive : elle glisse, et s'entoure un instant de lumière.
 *
 * Un second rendu peut suivre le premier de quelques images et remplacer la
 * ligne qu'on vient d'éclairer. On la retrouve donc par son sélecteur et on
 * rallume la nouvelle, pour que l'arrivée ne s'éteigne pas à mi-course.
 */
function arrivee(el, sel) {
  try {
    const t = el.getBoundingClientRect()
    if (t.top < 40 || t.bottom > window.innerHeight - 20) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch { /* vieux moteur */ }
  const allumer = (x) => {
    if (!x || x.classList.contains('is-just-added')) return
    x.classList.add('is-just-added')
    setTimeout(() => x.classList.remove('is-just-added'), 2200)
  }
  allumer(el)
  if (sel) for (const d of [120, 320, 700]) setTimeout(() => allumer(document.querySelector(sel)), d)
}

/**
 * Attendre qu'un élément existe.
 *
 * Le rendu qui suit un clic peut être différé d'un battement — il attend que
 * le doigt soit levé. On regarde donc à chaque image, une demi-seconde au plus.
 */
function attendre(selecteur, trouve, rate) {
  const debut = performance.now()
  const tour = () => {
    const el = document.querySelector(selecteur)
    if (el) { trouve(el); return }
    if (performance.now() - debut > 520) { if (rate) rate(); return }
    requestAnimationFrame(tour)
  }
  requestAnimationFrame(tour)
}
