/** Fabrique d'éléments : un hyperscript minimal, sans dépendance. */


export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue
    if (k === 'class') el.className = v
    // Object.assign avale les variables CSS sans rien dire : « --part » n'est
    // pas une propriété de CSSStyleDeclaration, l'affectation ne fait rien et
    // l'élément s'affiche à zéro. Elles passent par setProperty.
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (val === null || val === undefined || val === false) continue
        if (prop.startsWith('--')) el.style.setProperty(prop, String(val))
        else el.style[prop] = val
      }
    }
    else if (k === 'html') el.innerHTML = v
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v)
    else if (k === 'dataset') Object.assign(el.dataset, v)
    else if (v === true) el.setAttribute(k, '')
    else el.setAttribute(k, v)
  }
  append(el, children)
  return el
}

function append(el, children) {
  for (const c of children.flat(4)) {
    if (c === null || c === undefined || c === false || c === '') continue
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)))
  }
}

export function svg(tag, props = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue
    el.setAttribute(k, v)
  }
  for (const c of children.flat(4)) {
    if (c === null || c === undefined || c === false || c === '') continue
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)))
  }
  return el
}

// replaceChildren vide en une opération : un removeChild en boucle échoue si un
// gestionnaire de blur déclenche un nouveau rendu pendant qu'on retire les nœuds.
// Le repli sur innerHTML couvre le cas où un rendu concurrent — un curseur
// relâché pendant qu'une mise à jour live était en cours — a déjà déplacé un
// nœud sous nos pieds.
export const clear = (el) => {
  try { el.replaceChildren() } catch { el.innerHTML = '' }
  return el
}

/**
 * Vrai sur un écran étroit — téléphone en portrait, fenêtre réduite.
 *
 * Le CSS suffit pour reflow du texte, mais pas pour un dessin : un graphique
 * doit être *composé* autrement, pas seulement mis à l'échelle. Les vues qui
 * en dépendent interrogent cette fonction au moment où elles se construisent.
 */
export const narrow = () => (typeof window !== 'undefined' ? window.innerWidth : 1200) < 760

// Les formats vivent dans js/format.js : le moteur et l'export PowerPoint en
// ont besoin sans rien devoir à l'interface. Importés puis réexportés — et non
// simplement relayés — car ce module s'en sert aussi, et un renvoi
// « export … from » ne crée aucune liaison locale.
import { euro, num, pct, monthName, monthLabel, yearLabel } from '../format.js'
export { euro, num, pct, monthName, monthLabel, yearLabel }

// ────────────────────────────── Champ de saisie ───────────────────────────
import { BOUNDS, clampField } from '../state/schema.js'
import { memoire } from './memoire.js'

/**
 * La saisie différée : ce qu'on tape s'écrit une seconde après la dernière
 * frappe.
 *
 * Écrire à chaque chiffre recalculait le plan, et parfois redessinait la page,
 * pendant qu'on tapait « 26 843 » : le champ était remplacé sous les doigts,
 * le curseur revenait au début, et la suite du nombre s'écrivait devant. On
 * attend donc que la main se pose — une seconde sans frappe, chaque frappe
 * relançant l'attente — puis on écrit une fois. Quitter le champ ou appuyer
 * sur Entrée écrit tout de suite : on ne fait jamais attendre celui qui a fini.
 *
 * `ecrire(texte, { fin })` reçoit le texte du champ ; `fin` dit si la saisie
 * est terminée (sortie du champ, Entrée) ou seulement en pause.
 */
export const DELAI_SAISIE = 1000
/** Les saisies tapées mais pas encore écrites, pour qu'un redessin les écrive d'abord. */
const enAttente = new Set()
export function saisieDifferee(input, ecrire, { delai = DELAI_SAISIE } = {}) {
  let minuteur = null
  const pause = () => maintenant(false)
  const maintenant = (fin) => { clearTimeout(minuteur); minuteur = null; enAttente.delete(pause); ecrire(input.value, { fin }) }
  input.addEventListener('input', () => {
    clearTimeout(minuteur)
    minuteur = setTimeout(pause, delai)
    enAttente.add(pause)
  })
  input.addEventListener('change', () => maintenant(true))
  input.addEventListener('blur', () => maintenant(true))
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') maintenant(true) })
  return () => maintenant(true)
}

/**
 * Écrire tout de suite ce qui attend encore sa seconde.
 *
 * Un redessin qui arrive pendant la frappe — la synchronisation d'un autre
 * appareil, le guide qu'on ouvre, la fenêtre qu'on tourne — remplace le
 * champ par un neuf, rempli avec la valeur du plan : ce qu'on venait de taper
 * disparaissait de l'écran, puis revenait une seconde plus tard, et la suite
 * de la frappe s'écrivait dans l'ancien nombre. L'application appelle ceci
 * avant chaque redessin : le plan prend d'abord ce qui est tapé.
 */
export function ecrireEnAttente() {
  const liste = [...enAttente]
  enAttente.clear()
  for (const f of liste) f()
  return liste.length > 0
}

/** Un nombre tapé à la française : « 26 843,50 » → 26843.5 ; vide → '' ; illisible → NaN. */
export const lireNombre = (texte) => {
  const t = String(texte ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
  return t === '' ? '' : Number(t)
}
/** Et dans l'autre sens, avec la virgule décimale. */
const ecrireNombre = (v) => (v === '' || v === null || v === undefined ? '' : String(v).replace('.', ','))

/**
 * Champ numérique borné. La valeur est ramenée dans les limites du schéma
 * à la sortie du champ : l'utilisateur ne peut pas produire un scénario absurde.
 *
 * Un champ texte au clavier décimal, pas un `type=number` : un champ numérique
 * ne dit pas où est le curseur, et quand la page se redessine après un
 * recalcul, il le remettait au début. Les flèches haut et bas avancent d'un
 * pas, comme avant.
 */
export function numberField({ label, value, field, suffix, prefix, hint, help, onInput, percent = false, step, min, max, disabled, fieldKey, placeholder = null, muted = false, garde = null }) {
  const b = BOUNDS[field] || {}
  const toDisplay = (v) => (v === '' || v === null || v === undefined ? '' : ecrireNombre(percent ? round(Number(v) * 100, 4) : v))
  const pas = step ?? (percent ? 0.5 : b.step ?? 1)
  const lo = min ?? (percent ? (b.min ?? -Infinity) * 100 : b.min ?? -Infinity)
  const hi = max ?? (percent ? (b.max ?? Infinity) * 100 : b.max ?? Infinity)
  const input = h('input', {
    type: 'text',
    value: toDisplay(value),
    inputmode: 'decimal',
    autocomplete: 'off',
    disabled,
    placeholder: placeholder === null || placeholder === undefined ? null : String(placeholder),
    'data-field-key': fieldKey || null,
  })
  // `muted` : le champ est vide et hérite d'une valeur. Le gris dit « rien n'a
  // été saisi ici », le texte fantôme dit ce qui s'applique quand même.
  const control = h('div', { class: `control ${muted ? 'is-inherited' : ''}` },
    prefix && h('span', { class: 'affix affix-pre' }, prefix),
    input,
    (suffix || percent) && h('span', { class: 'affix' }, suffix || '%'),
  )
  const horsBornes = (v) => v !== '' && (Number.isNaN(v) || v < lo || v > hi)
  // Quitter un champ sans l'avoir modifié ne doit rien écrire.
  //
  // Le contraire coûtait un clic : sortir du champ pour appuyer sur un bouton
  // déclenchait un enregistrement, donc un redessin complet, et le bouton
  // visé disparaissait entre l'appui et le relâchement. Le clic était perdu,
  // et il fallait recommencer sans comprendre pourquoi.
  // `dernier` : la dernière valeur écrite dans le plan, pour ne pas réécrire
  // la même ; `affiche` : son texte, rendu si la sortie trouve un illisible.
  let dernier = value === '' || value === null || value === undefined ? '' : String(Number(value))
  let affiche = input.value
  saisieDifferee(input, (texte, { fin }) => {
    let raw = lireNombre(texte)
    if (Number.isNaN(raw)) {
      // Illisible : pendant une pause, on attend la suite ; à la sortie, on
      // rend la dernière valeur écrite.
      if (fin) { input.value = affiche; control.classList.remove('invalid') }
      return
    }
    // Hors bornes pendant une pause : on n'écrit rien, le cadre rouge suffit.
    // À la sortie, la valeur est ramenée dans les bornes, comme avant.
    if (!fin && horsBornes(raw)) return
    if (raw !== '') {
      if (percent) raw = raw / 100
      raw = clampField(field, raw)
      if (fin) input.value = toDisplay(raw)
    }
    if (fin) control.classList.remove('invalid')
    affiche = input.value
    const cle = raw === '' ? '' : String(raw)
    if (cle === dernier) return
    dernier = cle
    onInput(raw)
  })
  const note = garde ? gardeNote(control, garde) : null
  input.addEventListener('input', () => {
    const v = lireNombre(input.value)
    control.classList.toggle('invalid', horsBornes(v))
    if (note) note.juger(v === '' || Number.isNaN(v) ? '' : (percent ? v / 100 : v))
  })
  // Les flèches avancent d'un pas, dans les bornes.
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    const v = lireNombre(input.value)
    const base = v === '' || Number.isNaN(v) ? 0 : v
    const next = Math.min(hi, Math.max(lo, round(base + (e.key === 'ArrowUp' ? pas : -pas), 6)))
    e.preventDefault()
    input.value = ecrireNombre(next)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  if (note) note.juger(value)
  return h('div', { class: 'field' },
    label && h('label', {}, label, help && helpButton(help)),
    control,
    note,
    hint && h('div', { class: 'field-hint' }, hint),
  )
}

/**
 * La note d'un garde-fou, sous le champ.
 *
 * `garde(valeur)` rend `{ niveau, texte }` quand la valeur sort de toute
 * proportion avec le métier, rien sinon. La note se réécrit à chaque frappe,
 * sans rendu : on voit l'écart pendant qu'on tape, et il disparaît dès que
 * le chiffre redevient plausible.
 */
export function gardeNote(control, garde) {
  const texte = h('span', {})
  // Une ligne, pas trois : le texte entier au survol, et au clic il se déplie.
  const note = h('div', { class: 'field-garde', role: 'status', 'aria-live': 'polite', hidden: true,
    onClick: () => note.classList.toggle('is-open') },
    h('i', { 'aria-hidden': 'true' }), texte)
  note.juger = (v) => {
    let g = null
    try { g = v === '' || v === null || v === undefined ? null : garde(Number(v)) } catch { g = null }
    note.hidden = !g
    note.className = `field-garde ${g ? `is-${g.niveau}` : ''}`
    texte.textContent = g ? g.texte : ''
    note.title = g ? g.texte : ''
    control.classList.toggle('is-odd', !!g)
    control.classList.toggle('is-odd-alerte', !!g && g.niveau === 'alerte')
  }
  return note
}

export function textField({ label, value, placeholder, onInput, hint, help, fieldKey }) {
  const input = h('input', { type: 'text', value: value ?? '', placeholder: placeholder || '', 'data-field-key': fieldKey || null })
  // Pendant la frappe on enregistre sans redessiner ; la synchronisation
  // complète de l'interface a lieu à la sortie du champ.
  // Même règle que pour les nombres : une sortie de champ sans modification
  // n'enregistre rien, et ne fait donc pas disparaître le bouton qu'on visait.
  // `last` est la dernière valeur annoncée à toute l'interface, pas la
  // dernière tapée : la mettre à jour pendant la frappe rendait la sortie de
  // champ muette, et la saisie n'était jamais annoncée.
  let last = value ?? ''
  const commit = () => {
    if (String(input.value) === String(last)) return
    last = input.value
    onInput(input.value)
  }
  input.addEventListener('input', () => { onInput(input.value, { silent: true }) })
  input.addEventListener('change', commit)
  input.addEventListener('blur', commit)
  return h('div', { class: 'field' },
    label && h('label', {}, label, help && helpButton(help)),
    h('div', { class: 'control' }, input),
    hint && h('div', { class: 'field-hint' }, hint),
  )
}

export function selectField({ label, value, options, onInput, hint, help, fieldKey }) {
  const select = h('select', { 'data-field-key': fieldKey || null },
    ...options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label)),
  )
  select.addEventListener('change', () => onInput(select.value))
  return h('div', { class: 'field' },
    label && h('label', {}, label, help && helpButton(help)),
    h('div', { class: 'control' }, select),
    hint && h('div', { class: 'field-hint' }, hint),
  )
}

/**
 * Un interrupteur qui se range comme un champ.
 *
 * Il portait son libellé à côté de sa bascule, donc sur la rangée des
 * libellés. Posé dans une grille à côté d'un champ chiffré, sa bascule se
 * retrouvait vingt-trois pixels au-dessus du cadre voisin — deux choses à
 * cocher ou à saisir sur la même ligne, et rien qui s'aligne. Le libellé monte
 * donc là où sont les autres, et la bascule descend sur la rangée des cadres,
 * avec l'état écrit à côté : oui ou non, lisible sans interpréter une couleur.
 */
export function switchField({ label, checked, onInput, hint }) {
  const input = h('input', { type: 'checkbox', checked: !!checked })
  const etat = h('span', { class: 'switch-state' }, checked ? 'Oui' : 'Non')
  input.addEventListener('change', () => { etat.textContent = input.checked ? 'Oui' : 'Non'; onInput(input.checked) })
  return h('div', { class: 'field field-switch' },
    h('label', { class: 'switch-name' }, label),
    h('label', { class: 'switch' }, input, h('span', { class: 'track' }), etat),
    hint && h('div', { class: 'field-hint' }, hint),
  )
}

export function monthField({ label, value, onInput, hint, startDate, allowEmpty }) {
  const options = [
    allowEmpty ? { value: '', label: "Jusqu'à la fin" } : null,
    ...Array.from({ length: 60 }, (_, m) => ({ value: m, label: `${monthLabel(m, startDate)} (M${m + 1})` })),
  ].filter(Boolean)
  return selectField({ label, value: value === '' || value === null || value === undefined ? '' : value, options, hint, onInput: (v) => onInput(v === '' ? '' : Number(v)) })
}

function round(v, d) { const p = Math.pow(10, d); return Math.round(v * p) / p }

// ──────────────────────────── Aide contextuelle ───────────────────────────
let drawerHost = null
export function setDrawerHost(fn) { drawerHost = fn }

/**
 * L'interrupteur bascule tout de suite ; le glissement continue sur le nouveau
 * nœud.
 *
 * Basculer recalcule le modèle et reconstruit la page : l'ancien bouton meurt,
 * le nouveau naît déjà dans sa position finale. On différait donc la validation
 * le temps du mouvement — et on payait ce répit par une latence : le chiffre
 * n'arrivait qu'après, et deux clics rapprochés se marchaient dessus.
 *
 * On commet maintenant sans attendre, et c'est le mouvement qui traverse le
 * rendu : avant de valider on note l'ancienne position ; le bouton reconstruit
 * naît dedans, puis rejoint la nouvelle à l'image suivante. Le glissement est
 * le même, la valeur est déjà là.
 *
 * @param {boolean} on
 * @param {(next:boolean)=>void} onChange
 * @param {string} [key] identité stable de la ligne, pour retrouver le
 *   mouvement en cours d'un rendu à l'autre. Sans elle, pas de glissement.
 */
const enCours = new Map()

export function enableToggle(on, onChange, key) {
  const repris = key ? enCours.get(key) : null
  if (repris) enCours.delete(key)
  const depart = repris ? repris.from : on

  const btn = h('button', {
    class: `onoff ${depart ? 'on' : ''} ${repris ? 'is-switching' : ''}`,
    role: 'switch', 'aria-checked': String(!!on),
    title: on ? 'Mettre en pause — la ligne reste, elle cesse de compter' : 'Réactiver cette ligne',
    onClick: (e) => {
      e.stopPropagation()
      const next = !on
      // L'apparence part devant : le rendu qui suit la rattrape.
      btn.classList.toggle('on', next)
      btn.setAttribute('aria-checked', String(next))
      const row = btn.closest('.item, .card, .opex-line, .cost-row, li, tr')
      if (row) row.classList.toggle('is-off', !next)
      if (key && !reducedMotion()) enCours.set(key, { from: on })
      onChange(next)
    },
  }, h('i'))

  // Le nouveau bouton naît dans l'ancienne position, puis glisse. Lire une
  // dimension force le style à se poser : sans cette lecture, les deux classes
  // seraient appliquées dans la même image et il n'y aurait aucun mouvement.
  if (repris) {
    requestAnimationFrame(() => {
      void btn.offsetWidth
      btn.classList.toggle('on', !!on)
      setTimeout(() => btn.classList.remove('is-switching'), 300)
    })
  }

  return btn
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Navigation horizontale.
 *
 * Une page de saisie est une pile de sujets ; empilés verticalement, ils
 * obligent à dérouler pour savoir ce qui existe. Rangés sur une ligne, ils se
 * comptent d'un regard et ne coûtent qu'un clic. Les entrées sans contenu ne
 * sont pas grises : elles ne sont pas là.
 *
 * @param {{key:string,label:string,count?:number,tone?:string}[]} items
 */
export function tabs(items, active, onPick) {
  const list = items.filter(Boolean)
  if (list.length <= 1) return null

  // Le trait actif glisse d'un onglet à l'autre.
  //
  // Chaque rendu fabrique une barre neuve : le trait réapparaissait sous
  // l'onglet d'arrivée sans jamais avoir traversé, et le changement se lisait
  // comme un saut. On retient donc où il était — par la signature de la barre,
  // qui ne dépend pas des nœuds —, on le repose là, et on le déplace à l'image
  // suivante : c'est le même geste qu'un doigt sur un onglet.
  const sig = list.map((it) => it.key).join('|')
  const ink = h('i', { class: 'hnav-ink', 'aria-hidden': 'true' })
  const nav = h('div', { class: 'hnav', role: 'tablist', 'data-tabs': sig })

  // Deux natures d'onglets, séparées par un filet.
  //
  // « Équipe » se remplit, « Masse salariale » se lit. Un simple mot sous le
  // libellé ne suffisait pas : on cliquait sur le second en cherchant un champ.
  // Un filet les range en deux groupes, et la coupure se voit avant même qu'on
  // ait lu quoi que ce soit.
  const firstRead = list.findIndex((it) => it.read)
  const mixed = firstRead > 0 && list.slice(0, firstRead).every((it) => !it.read)

  list.forEach((it, i) => {
    if (mixed && i === firstRead) nav.appendChild(h('span', { class: 'hnav-split', 'aria-hidden': 'true' }))
    const btn = h('button', {
      class: `hnav-tab ${it.key === active ? 'active' : ''} ${it.read ? 'is-read' : ''} ${it.tone ? `is-${it.tone}` : ''}`,
      role: 'tab', 'aria-selected': it.key === active ? 'true' : 'false',
      title: it.read ? `${it.label} — on y lit ce que le modèle calcule` : `${it.label} — on y saisit`,
      onClick: () => {
        // Aucun mouvement. Le contenu change, rien d'autre.
        //
        // Il y a eu, dans l'ordre : une entrée en cascade des blocs, une
        // animation de hauteur du cadre, puis un glissement latéral de toute
        // l'image. Chacune a été ajoutée pour corriger la précédente, et
        // chacune a produit la même plainte — ça bouge. Changer d'onglet n'est
        // pas un déplacement : on ne quitte pas la page, on ne parcourt rien,
        // on remplace le contenu d'un panneau. Le geste juste est donc le plus
        // court : il n'y en a pas.
        onPick(it.key)
      },
    },
      // Seul ce qui se lit porte un signe.
      //
      // Un crayon sur chaque onglet modifiable, c'était un pictogramme de plus
      // à chaque ligne pour dire ce qui va de soi : dans un logiciel de saisie,
      // on saisit. L'œil ne marque donc que l'exception — les pages qui ne font
      // que montrer un résultat.
      it.read ? h('span', { class: 'hnav-sign', 'aria-hidden': 'true', html: EYE }) : null,
      h('span', { class: 'hnav-label' }, it.label),
      it.count ? h('span', { class: 'hnav-count' }, String(it.count)) : null,
    )
    nav.appendChild(btn)
  })
  nav.appendChild(ink)

  // La barre n'est pas encore dans le document quand on la fabrique, et elle
  // peut le rester un moment : un changement de module diffère le remplacement
  // du DOM le temps de la transition. On attend donc qu'elle y soit, au lieu de
  // renoncer à la première image — sinon le trait restait large de zéro.
  let tries = 0
  const settleInk = () => {
    if (!nav.isConnected) {
      if (tries++ < 90) requestAnimationFrame(settleInk)
      return
    }
    const on = nav.querySelector('.hnav-tab.active')
    if (!on) return
    const to = { x: on.offsetLeft, w: on.offsetWidth }
    const from = tabs.ink?.[sig] || to
    const place = (p) => { ink.style.transform = `translateX(${p.x}px)`; ink.style.width = `${p.w}px` }
    // On pose d'abord le trait où il était, sans transition — sinon il partirait
    // d'une largeur nulle à chaque rendu, et on le verrait grandir depuis la
    // gauche au moindre recalcul. Le déplacement ne se joue qu'à l'image
    // suivante, et seulement s'il y a vraiment quelque chose à parcourir.
    ink.classList.add('is-jumping')
    place(from)
    requestAnimationFrame(() => {
      ink.classList.remove('is-jumping')
      place(to)
    })
    ;(tabs.ink || (tabs.ink = {}))[sig] = to
  }
  requestAnimationFrame(settleInk)

  return nav
}

/**
 * Un volet.
 *
 * Tout ce qui se vérifie plutôt qu'il ne se lit — un détail de calcul, une
 * liste de réglages rares — tient replié derrière un chevron. Le titre porte
 * déjà l'essentiel : on n'ouvre que pour vérifier.
 */
/** Deux traits, centrés par construction. */
export const PLUS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'

/** Les deux autres signes du même jeu : retirer, et fermer. */
export const MINUS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
export const CROSS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'

/** Un chevron, même construction : tracé dans sa boîte, donc centré. */
export const COPY = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.6" y="5.6" width="7.4" height="7.4" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.4 3.6H4.4a1.4 1.4 0 0 0-1.4 1.4v6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'

/**
 * Un onglet où l'on lit ce que le modèle calcule.
 *
 * Le mot « lecture » sous le libellé demandait d'être lu pour être compris.
 * Un œil se reconnaît sans lecture, et dit la même chose dans toutes les
 * langues.
 */
export const EYE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.6 8s2.4-4.2 6.4-4.2S14.4 8 14.4 8s-2.4 4.2-6.4 4.2S1.6 8 1.6 8Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>'

export const CHEVRON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6.5 8 10.5l4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/**
 * Le signe d'un volet : un chevron, dans un rond, qui se retourne.
 *
 * Il y a eu trois affordances en circulation — un chevron gris, un « + » qui
 * devenait une croix, un bouton portant le mot « Déplier » — et selon la page
 * on tombait sur l'une ou sur l'autre. Deux défauts à la fois : il fallait
 * apprendre trois signes pour un seul geste, et la croix, qui veut dire
 * « annuler » partout ailleurs, laissait croire qu'on allait perdre quelque
 * chose. Le chevron, lui, ne dit qu'un sens : ce qui est dessous s'ouvre, ce
 * qui est ouvert se referme. C'est celui-là, partout, et un seul.
 */
export const foldSign = () => h('span', { class: 'foldsign', 'aria-hidden': 'true', html: CHEVRON })

export function fold(title, summary, body, { open = false, id = null, tone = '' } = {}) {
  const el = h('details', { class: `refine refine-block ${tone}`, open: open || null },
    h('summary', { class: 'refine-head' },
      foldSign(),
      h('span', { class: 'refine-label' }, title),
      summary ? h('span', { class: 'refine-sum' }, summary) : null,
    ),
    h('div', { class: 'refine-body' }, body),
  )
  if (id) {
    const memory = fold.open || (fold.open = new Set())
    if (memory.has(id)) el.open = true
    el.addEventListener('toggle', () => { el.open ? memory.add(id) : memory.delete(id) })
  }
  return el
}

/**
 * Le bandeau d'une page : ce qu'on regarde, et l'action qui va avec.
 * L'action d'ajout est toujours ici, jamais au bas d'une liste qu'il faudrait
 * dérouler pour la trouver.
 */
export function pageBar(title, sub, ...actions) {
  return h('header', { class: 'pagebar' },
    h('div', { class: 'pagebar-id' },
      h('h2', { class: 'pagebar-title' }, title),
      sub ? h('div', { class: 'pagebar-sub' }, sub) : null,
    ),
    h('span', { class: 'spacer' }),
    ...actions.filter(Boolean),
  )
}

/**
 * Un montant avec son unité commutable.
 *
 * Un salaire se dit à l'année, un loyer au mois, une commission en pourcentage.
 * Plutôt que d'imposer une convention, le champ porte son unité et la bascule
 * d'un clic — la valeur stockée, elle, ne change jamais de nature.
 */
export function unitAmount({ label, value, units, unit, onUnit, onInput, hint, help, garde = null }) {
  const def = units.find((u) => u.key === unit) || units[0]
  const shown = def.toDisplay ? def.toDisplay(value) : value
  let note = null
  const input = h('input', {
    class: 'num', inputmode: 'decimal', autocomplete: 'off', value: shown === 0 ? '0' : ecrireNombre(Math.round(shown * 100) / 100),
  })
  const stocke = (texte) => { const raw = lireNombre(texte); const v = Number.isNaN(raw) || raw === '' ? 0 : raw; return def.fromDisplay ? def.fromDisplay(v) : v }
  // Le garde-fou juge à chaque frappe ; le plan, lui, s'écrit une seconde
  // après la dernière (voir saisieDifferee).
  input.addEventListener('input', () => { if (note) note.juger(stocke(input.value)) })
  let last = input.value
  saisieDifferee(input, (texte) => {
    if (texte === last) return
    last = texte
    onInput(stocke(texte))
  })
  const control = h('div', { class: 'control unit-control' },
    input,
    h('div', { class: 'unit-switch' },
      ...units.map((u) => h('button', {
        class: `unit-btn ${u.key === def.key ? 'active' : ''}`, type: 'button',
        title: u.title || u.label,
        onClick: () => onUnit(u.key),
      }, u.label)),
    ),
  )
  if (garde) { note = gardeNote(control, garde); note.juger(value) }
  return h('div', { class: 'field' },
    h('label', {}, label, help ? helpButton(help) : null),
    control,
    note,
    hint ? h('div', { class: 'field-hint' }, hint) : null,
  )
}

/**
 * Affiner.
 *
 * Le logiciel ne demande plus à qui que ce soit de s'auto-étiqueter
 * « débutant » ou « expert » — une question à laquelle personne ne sait
 * répondre, et dont la mauvaise réponse cache des réglages utiles ou en impose
 * d'inutiles. Chaque question se pose donc au premier degré, et ce qui la
 * raffine tient derrière un lien discret.
 *
 * Le modèle, lui, est le même pour tout le monde : ouvrir un volet n'active
 * aucun mode, ça montre des champs qui existaient déjà.
 *
 * @param {string} id     identité stable du volet, pour qu'il reste ouvert
 * @param {string} label  ce que l'ouverture apporte, dit en clair
 */
export function refine(id, label, ...children) {
  const body = children.flat(4).filter(Boolean)
  if (!body.length) return null
  const memory = memoire.affiner.open || (memoire.affiner.open = new Set())
  const el = h('details', { class: 'refine', open: memory.has(id) || null },
    h('summary', { class: 'refine-head' },
      foldSign(),
      h('span', { class: 'refine-label' }, label),
    ),
    h('div', { class: 'refine-body' }, ...body),
  )
  el.addEventListener('toggle', () => { el.open ? memory.add(id) : memory.delete(id) })
  return el
}

/**
 * La tête d'un module — une seule, au lieu de quatre.
 *
 * Il y avait le titre, puis une question repliée, puis une barre qui répétait
 * le sujet avec un chiffre, puis les onglets, puis le bouton d'ajout. Cinq
 * bandeaux avant la première donnée, et deux cents pixels de hauteur pour dire
 * trois choses. Sur un portable, la page commençait sous la ligne de flottaison.
 *
 * Tout tient désormais en trois lignes :
 *
 *   MODULE 04 / 09
 *   Équipe
 *   + Les postes salariés, leur brut annuel…        1 656 € la première année
 *   ─────────────────────────────────────────────────────────────────────
 *   Équipe ① · Avantages ① · Masse salariale          [+ Ajouter un poste]
 *
 * Le « + » du lede ouvre ce qui était le bandeau d'étape : la question du
 * parcours et le mode d'emploi de la partie. On ne le lit qu'une fois ; il n'a
 * pas à occuper l'écran les cinquante fois suivantes.
 */
/**
 * L'en-tête d'un module reste à l'écran.
 *
 * Deux écrans plus bas dans « Achats et coûts », plus rien ne disait où l'on
 * était ni quels onglets existaient : il fallait remonter pour changer de
 * vue. Il se colle donc sous la barre du haut — et se resserre en route : le
 * titre passe au corps d'une ligne de texte et la phrase d'introduction
 * s'efface, pour qu'un bandeau de repère ne mange pas le tiers de l'écran.
 *
 * La détection passe par une sentinelle placée juste au-dessus : quand elle
 * sort par le haut, l'en-tête est collé. Un écouteur de défilement ferait le
 * même travail en s'exécutant à chaque pixel parcouru.
 */
/**
 * Un « i » qui se voit, sans texte à côté.
 *
 * Une explication posée en toutes lettres à côté d'un titre coûte une ligne à
 * qui l'a déjà lue. Ce point la garde sous la main : elle s'affiche en bulle
 * au survol ou au focus, et un clic la laisse ouverte (ou ouvre le tiroir,
 * si on lui en donne un).
 */
if (typeof document !== 'undefined') {
  // Une bulle ouverte, une liste déroulante marquée « data-ferme-dehors »,
  // se referment dès qu'on clique ailleurs. `fermer`, s'il existe, oublie
  // tout de suite l'état retenu : un redessin déclenché par ce même clic ne
  // doit pas la rouvrir.
  document.addEventListener('pointerdown', (e) => {
    for (const b of document.querySelectorAll('.info-point.is-open')) if (!b.contains(e.target)) b.classList.remove('is-open')
    for (const d of document.querySelectorAll('details[data-ferme-dehors][open]')) {
      if (!d.contains(e.target)) { d.open = false; d.fermer?.() }
    }
  }, true)
}
export function infoPoint(texte, { onClick = null, classe = '' } = {}) {
  if (!texte) return null
  const b = h('button', {
    class: `info-point ${classe}`, type: 'button', 'data-tip': texte, 'aria-label': texte,
    onClick: (e) => { e.stopPropagation(); if (onClick) onClick(e); else b.classList.toggle('is-open') },
    onMouseleave: () => b.classList.remove('is-open'),
  }, 'i')
  return b
}

export function moduleShell({ no, title, figure, views, view, onPick, actions = [] }) {
  const acts = (actions || []).filter(Boolean)
  const nav = views ? tabs(views, view, onPick) : null

  // Le titre se suffit. La note du module a été une phrase grise au bout du
  // titre, puis un « i » qui ouvrait un tiroir ; elle est retirée de tous les
  // titres, à la demande : le nom du module dit déjà ce qu'on y fait.

  // Le titre ne bouge plus, et c'est tout le sujet.
  //
  // Il était collé sous la barre du haut et se resserrait en route : le titre
  // passait de quarante-six à vingt-deux pixels et le numéro de module
  // s'effaçait. Sauf que la bascule n'avait aucune zone morte — mesurée, elle
  // se faisait à trente pixels de défilement et revenait à vingt-neuf. Un
  // geste de trackpad près du haut de la page faisait donc claquer le titre
  // d'une taille à l'autre, plusieurs fois par seconde. C'est le
  // clignotement.
  //
  // On ne règle pas une bascule qui clignote, on la supprime : l'affiche du
  // module défile normalement, comme le reste de la page, et ne change jamais
  // de taille. Avec elle disparaissent la sentinelle, la cale qui compensait
  // sa hauteur, et les deux observateurs qui la surveillaient.
  const head = h('header', { class: 'module' },
    h('div', { class: 'module-tag' },
      h('span', { class: 'module-bar' }),
      h('span', {}, `Module ${no} / 09`),
    ),

    // Une seule ligne : ce qu'on fait, de quoi il s'agit, où l'on en est.
    h('div', { class: 'module-top' },
      h('h1', { class: 'module-title' }, title),
      figure ? h('div', { class: 'module-figure' },
        h('span', { class: 'module-figure-value num' }, figure.value),
        figure.note ? h('span', { class: 'module-figure-note' }, figure.note) : null,
      ) : null,
    ),
  )

  // Ce qui reste à l'écran, c'est la barre d'onglets — et elle seule.
  //
  // C'est ce qu'on avait cherché à obtenir en collant tout l'en-tête : savoir
  // où l'on est et pouvoir changer de vue sans remonter. Une barre d'onglets a
  // une hauteur fixe : rien à resserrer, rien à compenser, rien qui puisse
  // clignoter. Le nom du module, lui, est déjà dans le fil d'Ariane de la
  // barre du haut, qui ne quitte jamais l'écran.
  //
  // Elle sort de l'en-tête pour devenir sa sœur : un élément « sticky » ne
  // dépasse pas la boîte de son parent, et enfermée dans l'en-tête elle
  // n'aurait tenu que le temps de le traverser.
  const bar = nav || acts.length
    ? h('div', { class: 'module-nav' },
        nav || h('span', { class: 'spacer' }),
        acts.length ? h('div', { class: 'module-acts' }, ...acts) : null,
      )
    : null

  const out = document.createDocumentFragment()
  out.append(head)
  if (bar) out.append(bar)
  return out
}

/**
 * Le chiffre à retenir d'un module.
 *
 * Un bloc noir, un quart de cercle acide, un nombre. C'est la seule chose que
 * l'utilisateur doit emporter en quittant la page ; tout le reste était la
 * manière de l'obtenir.
 */
export function keystone(tag, value, note) {
  return h('section', { class: 'keystone' },
    h('span', { class: 'keystone-arc', 'aria-hidden': 'true' }),
    h('div', { class: 'keystone-tag' }, tag),
    h('div', { class: 'keystone-value' }, value),
    note ? h('p', { class: 'keystone-note' }, note) : null,
  )
}

export function helpButton(key) {
  return h('button', { class: 'help', type: 'button', title: 'En savoir plus', onClick: (e) => { e.preventDefault(); e.stopPropagation(); drawerHost && drawerHost(key) } }, '?')
}

// ─────────────────────────────── Notifications ────────────────────────────
export function toast(message, kind = '') {
  let host = document.querySelector('.toasts')
  if (!host) { host = h('div', { class: 'toasts' }); document.body.appendChild(host) }
  const el = h('div', { class: `toast ${kind}` }, message)
  host.appendChild(el)
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320) }, 2600)
}

export function confirmDialog({ title, message, confirmLabel = 'Confirmer', danger = false }) {
  return new Promise((resolve) => {
    const close = (v) => { wrap.remove(); scrim.remove(); resolve(v) }
    const scrim = h('div', { class: 'scrim', onClick: () => close(false) })
    const wrap = h('div', { class: 'modal-wrap' },
      h('div', { class: 'modal' },
        h('div', { class: 'modal-head' }, h('h2', {}, title)),
        h('div', { class: 'modal-body' }, h('p', { class: 'muted' }, message)),
        h('div', { class: 'modal-foot' },
          h('button', { class: 'btn', onClick: () => close(false) }, 'Annuler'),
          h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onClick: () => close(true) }, confirmLabel),
        ),
      ),
    )
    document.body.append(scrim, wrap)
  })
}
