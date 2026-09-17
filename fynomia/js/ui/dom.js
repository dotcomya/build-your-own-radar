/** Fabrique d'éléments : un hyperscript minimal, sans dépendance. */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue
    if (k === 'class') el.className = v
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v)
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
export const clear = (el) => { el.replaceChildren(); return el }
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
export function numberField({ label, value, field, suffix, prefix, hint, help, onInput, percent = false, step, min, max, disabled, fieldKey }) {
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
    'data-field-key': fieldKey || null,
  })
  const control = h('div', { class: 'control' },
    prefix && h('span', { class: 'affix affix-pre' }, prefix),
    input,
    (suffix || percent) && h('span', { class: 'affix' }, suffix || '%'),
  )
  const commit = () => {
    let raw = input.value === '' ? '' : Number(input.value)
    if (raw !== '') {
      if (percent) raw = raw / 100
      raw = clampField(field, raw)
      input.value = toDisplay(raw)
    }
    control.classList.remove('invalid')
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
  input.addEventListener('input', () => onInput(input.value, { silent: true }))
  input.addEventListener('change', () => onInput(input.value))
  input.addEventListener('blur', () => onInput(input.value))
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
    onClick: (e) => { e.stopPropagation(); onChange(!on) },
  }, h('i'))
  return btn
}

/**
 * Un bloc qui n'existe qu'à partir d'un certain niveau de détail.
 *
 * Sans marque, on ne sait pas pourquoi une section apparaît ou disparaît en
 * changeant de profondeur. Un filet de couleur et une étiquette suffisent à
 * rendre l'échange visible : bleu pour l'intermédiaire, violet pour l'expert.
 */
export function levelBlock(level, title, ...children) {
  const label = { intermediate: 'Intermédiaire', advanced: 'Expert' }[level] || level
  return h('div', { class: `lv lv-${level}` },
    h('div', { class: 'lv-head' },
      h('span', { class: 'lv-tag' }, label),
      title && h('span', { class: 'lv-title' }, title),
    ),
    ...children,
  )
}

/**
 * Ce que la profondeur suivante ajoute sur cette page.
 *
 * Changer de niveau faisait apparaître et disparaître des blocs sans qu'on
 * sache lesquels ni pourquoi. Cette ligne le dit à l'endroit exact où ça se
 * joue, et permet de basculer sans aller chercher le sélecteur en haut.
 */
export function levelFooter(page, level, onSwitch) {
  const next = level === 'easy' ? 'intermediate' : level === 'intermediate' ? 'advanced' : null
  const adds = LEVEL_ADDS[page] || {}
  const items = next ? adds[next] : null
  const removed = level !== 'easy' ? adds[level] : null

  if (!items && !removed) return null
  const name = { intermediate: 'Intermédiaire', advanced: 'Expert' }
  return h('div', { class: `levelfoot lf-${level}` },
    removed ? h('div', { class: 'levelfoot-now' },
      h('span', { class: 'levelfoot-tag' }, `Grâce au niveau ${name[level]}`),
      h('span', {}, removed.join(' · ')),
    ) : null,
    items ? h('div', { class: 'levelfoot-next' },
      h('span', { class: 'levelfoot-tag' }, `En ${name[next]}, cette page ajoute`),
      h('span', {}, items.join(' · ')),
      h('button', { class: 'btn btn-sm', onClick: () => onSwitch(next) }, `Passer en ${name[next]}`),
    ) : null,
  )
}

/**
 * Ce que chaque profondeur apporte, page par page.
 * C'est la seule source de vérité de ce que le sélecteur de niveau promet.
 */
const LEVEL_ADDS = {
  offre: {
    intermediate: ['le taux de TVA par offre', 'la saisie des volumes mois par mois', 'les conditions de paiement'],
    advanced: ["l'évolution des prix année par année"],
  },
  equipe: {
    intermediate: ['la date de départ de chaque poste'],
    advanced: ['les avantages salariés', 'le détail du brut au coût réel', 'le temps passé en recherche et le statut JEI'],
  },
  charges: {
    intermediate: ['les investissements et leur amortissement'],
    advanced: ['les dates de début et de fin', 'le rattachement au crédit d’impôt recherche'],
  },
  financement: {
    intermediate: ['la levée de fonds', 'le compte courant d’associé'],
    advanced: ['les avances remboursables', 'le plan de financement complet'],
  },
  marketing: {
    intermediate: ['les campagnes par canal', "l'entonnoir de conversion"],
    advanced: ['le rapport LTV/CAC et le délai de retour'],
  },
  'tableau-de-bord': {
    intermediate: ['le besoin en fonds de roulement et la courbe de trésorerie'],
    advanced: ['les indicateurs détaillés'],
  },
  resultats: {
    intermediate: ['le tableau de flux de trésorerie'],
    advanced: ['le bilan prévisionnel et le détail de la TVA'],
  },
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
