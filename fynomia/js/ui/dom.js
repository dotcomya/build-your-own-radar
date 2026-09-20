/** Fabrique d'éléments : un hyperscript minimal, sans dépendance. */

import { markViewChange } from './motion.js'

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
export const qs = (sel, root = document) => root.querySelector(sel)

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

/**
 * Champ numérique borné. La valeur est ramenée dans les limites du schéma
 * à la sortie du champ : l'utilisateur ne peut pas produire un scénario absurde.
 */
export function numberField({ label, value, field, suffix, prefix, hint, help, onInput, percent = false, step, min, max, disabled, fieldKey, placeholder = null, muted = false }) {
  const b = BOUNDS[field] || {}
  const toDisplay = (v) => (v === '' || v === null || v === undefined ? '' : percent ? round(Number(v) * 100, 4) : v)
  const input = h('input', {
    type: 'number',
    value: toDisplay(value),
    step: step ?? (percent ? 0.5 : b.step ?? 1),
    min: min ?? (percent ? (b.min ?? 0) * 100 : b.min),
    max: max ?? (percent ? (b.max ?? 1) * 100 : b.max),
    inputmode: 'decimal',
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
  // Quitter un champ sans l'avoir modifié ne doit rien écrire.
  //
  // Le contraire coûtait un clic : sortir du champ pour appuyer sur un bouton
  // déclenchait un enregistrement, donc un redessin complet, et le bouton
  // visé disparaissait entre l'appui et le relâchement. Le clic était perdu,
  // et il fallait recommencer sans comprendre pourquoi.
  let last = toDisplay(value)
  const commit = () => {
    let raw = input.value === '' ? '' : Number(input.value)
    if (raw !== '') {
      if (percent) raw = raw / 100
      raw = clampField(field, raw)
      input.value = toDisplay(raw)
    }
    control.classList.remove('invalid')
    if (String(input.value) === String(last)) return
    last = input.value
    onInput(raw)
  }
  input.addEventListener('change', commit)
  input.addEventListener('blur', commit)
  input.addEventListener('input', () => {
    const v = Number(input.value)
    const lo = percent ? (b.min ?? -Infinity) * 100 : b.min ?? -Infinity
    const hi = percent ? (b.max ?? Infinity) * 100 : b.max ?? Infinity
    control.classList.toggle('invalid', input.value !== '' && (v < lo || v > hi))
  })
  return h('div', { class: 'field' },
    label && h('label', {}, label, help && helpButton(help)),
    control,
    hint && h('div', { class: 'field-hint' }, hint),
  )
}

export function textField({ label, value, placeholder, onInput, hint, help, fieldKey }) {
  const input = h('input', { type: 'text', value: value ?? '', placeholder: placeholder || '', 'data-field-key': fieldKey || null })
  // Pendant la frappe on enregistre sans redessiner ; la synchronisation
  // complète de l'interface a lieu à la sortie du champ.
  // Même règle que pour les nombres : une sortie de champ sans modification
  // n'enregistre rien, et ne fait donc pas disparaître le bouton qu'on visait.
  let last = value ?? ''
  const commit = () => {
    if (String(input.value) === String(last)) return
    last = input.value
    onInput(input.value)
  }
  input.addEventListener('input', () => { last = input.value; onInput(input.value, { silent: true }) })
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

export function switchField({ label, checked, onInput, hint }) {
  const input = h('input', { type: 'checkbox', checked: !!checked })
  input.addEventListener('change', () => onInput(input.checked))
  return h('div', { class: 'field' },
    h('label', { class: 'switch' }, input, h('span', { class: 'track' }), h('span', {}, label)),
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
 * L'interrupteur d'une ligne : actif / en pause.
 *
 * Désactiver plutôt que supprimer est ce qui rend un prévisionnel utilisable
 * pour réfléchir : on met une embauche en pause, on regarde ce que ça change,
 * on la remet. La saisie n'est jamais perdue. Posé dans l'en-tête, il agit sans
 * ouvrir la ligne.
 */
export function enableToggle(on, onChange) {
  const btn = h('button', {
    class: `onoff ${on ? 'on' : ''}`,
    role: 'switch', 'aria-checked': String(!!on),
    title: on ? 'Mettre en pause — la ligne reste, elle cesse de compter' : 'Réactiver cette ligne',
    onClick: (e) => {
      e.stopPropagation()
      // Basculer l'état recalcule le modèle et reconstruit la page : la ligne
      // disparaissait et revenait dans la même image, ce qui se lit comme un
      // défaut plutôt que comme une action.
      //
      // On bascule donc l'apparence tout de suite — l'interrupteur glisse, la
      // ligne s'éteint — et on ne commet la valeur qu'une fois le mouvement
      // terminé. Le rendu qui suit produit exactement ce qui est déjà à
      // l'écran : il ne se voit pas.
      const next = !on
      btn.classList.toggle('on', next)
      btn.setAttribute('aria-checked', String(next))
      const row = btn.closest('.item, .card, .opex-line, li, tr')
      if (row) row.classList.toggle('is-off', !next)
      if (reducedMotion()) { onChange(next); return }
      btn.classList.add('is-switching')
      // On attendait la fin du mouvement, puis on fondait toute la page pour
      // masquer le rendu. Le fondu était pire que ce qu'il cachait : tout
      // l'écran clignotait pour une case cochée. Le rendu ne se voit plus
      // parce qu'il ne produit plus d'animation du tout — il refabrique les
      // mêmes nœuds avec les mêmes styles, et seuls les chiffres changent.
      setTimeout(() => onChange(next), 340)
    },
  }, h('i'))
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
  const nav = h('div', { class: 'hnav', role: 'tablist' })

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
      onClick: () => { markViewChange(); onPick(it.key) },
    },
      h('span', { class: 'hnav-label' }, it.label),
      it.count ? h('span', { class: 'hnav-count' }, String(it.count)) : null,
      it.read ? h('span', { class: 'hnav-read' }, 'lecture') : null,
    )
    nav.appendChild(btn)
  })
  nav.appendChild(ink)

  requestAnimationFrame(() => {
    const on = nav.querySelector('.hnav-tab.active')
    if (!on || !nav.isConnected) return
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
  })

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
export function unitAmount({ label, value, units, unit, onUnit, onInput, hint, help }) {
  const def = units.find((u) => u.key === unit) || units[0]
  const shown = def.toDisplay ? def.toDisplay(value) : value
  const input = h('input', {
    class: 'num', inputmode: 'decimal', value: shown === 0 ? '0' : String(Math.round(shown * 100) / 100),
    onInput: (e) => {
      const raw = Number(String(e.target.value).replace(/\s/g, '').replace(',', '.')) || 0
      onInput(def.fromDisplay ? def.fromDisplay(raw) : raw)
    },
  })
  return h('div', { class: 'field' },
    h('label', {}, label, help ? helpButton(help) : null),
    h('div', { class: 'control unit-control' },
      input,
      h('div', { class: 'unit-switch' },
        ...units.map((u) => h('button', {
          class: `unit-btn ${u.key === def.key ? 'active' : ''}`, type: 'button',
          title: u.title || u.label,
          onClick: () => onUnit(u.key),
        }, u.label)),
      ),
    ),
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
  const memory = refine.open || (refine.open = new Set())
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
 * L'en-tête d'un module.
 *
 * Un numéro, un titre, une phrase. Le titre nomme ce qu'on fait — « Mon
 * projet », « Offre et revenus » — sans chercher la formule : une accroche
 * publicitaire en tête d'un outil de calcul fatigue dès la deuxième visite.
 */
export function moduleHead(no, title, lede, ...actions) {
  return h('header', { class: 'module' },
    h('div', { class: 'module-tag' },
      h('span', { class: 'module-bar' }),
      h('span', {}, `Module ${no} / 09`),
    ),
    h('div', { class: 'module-row' },
      h('h1', { class: 'module-title' }, title),
      actions.filter(Boolean).length ? h('div', { class: 'module-actions' }, ...actions.filter(Boolean)) : null,
    ),
    lede ? h('p', { class: 'module-lede' }, lede) : null,
  )
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
export function moduleShell({ no, title, lede, figure, guide, views, view, onPick, actions = [] }) {
  const acts = (actions || []).filter(Boolean)
  const nav = views ? tabs(views, view, onPick) : null
  return h('header', { class: 'module' },
    h('div', { class: 'module-tag' },
      h('span', { class: 'module-bar' }),
      h('span', {}, `Module ${no} / 09`),
    ),
    h('h1', { class: 'module-title' }, title),

    // Le lede et le chiffre du module sur la même ligne : la phrase dit de
    // quoi on parle, le nombre dit où on en est.
    h('div', { class: 'module-line' },
      guide
        ? h('details', { class: 'module-lede-fold' },
            h('summary', { class: 'module-lede-head' },
              h('span', { class: 'module-lede-sign', 'aria-hidden': 'true' }, '+'),
              h('span', { class: 'module-lede' }, lede),
            ),
            h('div', { class: 'module-guide' }, guide),
          )
        : h('p', { class: 'module-lede is-plain' }, lede),
      figure ? h('div', { class: 'module-figure' },
        h('span', { class: 'module-figure-value num' }, figure.value),
        figure.note ? h('span', { class: 'module-figure-note' }, figure.note) : null,
      ) : null,
    ),

    // Une seule barre pour naviguer dans le module et pour y ajouter quelque
    // chose : l'action appartient à l'onglet ouvert, pas à un bandeau séparé.
    nav || acts.length ? h('div', { class: 'module-nav' },
      nav || h('span', { class: 'spacer' }),
      acts.length ? h('div', { class: 'module-acts' }, ...acts) : null,
    ) : null,
  )
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
