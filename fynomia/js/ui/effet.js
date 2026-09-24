/**
 * L'effet d'une saisie, là où on tape.
 *
 * Changer un prix, un salaire, un loyer, puis aller chercher dans une autre
 * page ce que ça a changé : c'est la boucle qui fait abandonner un
 * prévisionnel. Le chiffre qui compte doit apparaître sous le doigt, à côté
 * du champ, au moment où l'on tape — « +2 400 € de résultat en année 2 ».
 *
 * Le repère est pris quand on entre dans le champ. Tant qu'on y reste, et
 * après en être sorti, l'écart se lit en dessous : sur le résultat net de
 * l'année que le plan met en avant, ou, si le résultat ne bouge pas — un délai
 * de paiement, un acompte —, sur le point bas de trésorerie. Entrer dans un
 * autre champ repart de zéro.
 */

import { h, euro } from './dom.js'
import { referenceYear } from '../format.js'
import store from '../state/store.js'

/** Les pages où l'on saisit un plan ; le parcours et la présentation ont leur propre écho. */
const HORS = new Set(['creer', 'discuter', 'accueil', 'ton-business', 'presentation', 'demarrer', ''])
const route = () => (location.hash || '').replace(/^#\/?/, '').split(/[/?]/)[0]

let suivi = null      // { el, desc, base, modifie }
let dernier = null    // { desc, texte, bon }

function photo(r) {
  if (!r) return null
  return {
    net: r.pnl.netResult.slice(),
    bas: Number(r.kpis?.cashLow?.value) || 0,
    annee: referenceYear(r),
  }
}

/** Le texte de l'effet, ou rien si rien n'a bougé. */
export function effetDe(base, r) {
  if (!base || !r) return null
  const y = base.annee
  const dNet = (r.pnl.netResult[y] || 0) - (base.net[y] || 0)
  if (Math.abs(dNet) >= 1) {
    return { texte: `${euro(dNet, { sign: true, compact: Math.abs(dNet) >= 100000 })} de résultat en année\u00a0${y + 1}`, bon: dNet > 0 }
  }
  const dBas = (Number(r.kpis?.cashLow?.value) || 0) - base.bas
  if (Math.abs(dBas) >= 1) {
    return { texte: `${euro(dBas, { sign: true, compact: Math.abs(dBas) >= 100000 })} au point bas de trésorerie`, bon: dBas > 0 }
  }
  return null
}

const texteDe = (label) => [...(label?.childNodes || [])]
  .filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()

/**
 * Le champ d'une saisie : un `.field` (libellé, cadre, aide), ou une ligne qui
 * se déclare `data-effet` — une charge, un avantage — et dont les cases se
 * nomment par leur `aria-label`.
 */
const CHAMP = '.field, [data-effet]'
const champDe = (el) => el?.closest?.(CHAMP) || null
const nomDe = (champ, input) => (champ.matches('.field')
  ? texteDe(champ.querySelector('label'))
  : `${champ.getAttribute('data-effet') || ''}|${input?.getAttribute?.('aria-label') || ''}`)
const SAISIES = 'input, select, textarea'

/** Ce qui permet de retrouver le champ — et la case — après un redessin. */
export function decrire(input) {
  const champ = champDe(input)
  if (!champ) return null
  const ancres = []
  for (let el = champ.parentElement; el && el !== document.body; el = el.parentElement) {
    for (const a of ['data-row', 'data-gap', 'data-cle']) {
      if (el.hasAttribute && el.hasAttribute(a)) ancres.unshift([a, el.getAttribute(a)])
    }
  }
  const label = nomDe(champ, input)
  const portee = portee_(ancres)
  const memes = [...portee.querySelectorAll(CHAMP)].filter((f) => nomDe(f, input) === label)
  const cases = [...champ.querySelectorAll(SAISIES)]
  return {
    route: route(), cle: input.dataset?.fieldKey || null, label, ancres,
    index: Math.max(0, memes.indexOf(champ)), aria: input.getAttribute?.('aria-label') || null,
    pos: Math.max(0, cases.indexOf(input)),
  }
}

function portee_(ancres) {
  let scope = document
  for (const [a, v] of ancres) {
    const next = scope.querySelector(`[${a}="${CSS.escape(v)}"]`)
    if (next) scope = next
  }
  return scope
}

function retrouver(d) {
  if (!d || d.route !== route()) return null
  if (d.cle) {
    const i = document.querySelector(`[data-field-key="${CSS.escape(d.cle)}"]`)
    if (i && champDe(i)) return champDe(i)
  }
  const memes = [...portee_(d.ancres).querySelectorAll(CHAMP)].filter((f) => nomDe(f, d.aria ? { getAttribute: () => d.aria } : null) === d.label)
  return memes[d.index] || null
}

/** La case elle-même, dans le champ retrouvé : pour lui rendre le focus. */
export function retrouverSaisie(d) {
  if (!d) return null
  if (d.cle) {
    const i = document.querySelector(`[data-field-key="${CSS.escape(d.cle)}"]`)
    if (i) return i
  }
  const champ = retrouver(d)
  if (!champ) return null
  const cases = [...champ.querySelectorAll(SAISIES)]
  return (d.aria && cases.find((c) => c.getAttribute('aria-label') === d.aria)) || cases[d.pos] || null
}

/** Pose — ou retire — la pastille sous le champ. */
function poser() {
  document.querySelectorAll('.effet').forEach((x) => { if (!dernier || x.dataset.pour !== JSON.stringify(dernier.desc)) x.remove() })
  if (!dernier) return
  const champ = retrouver(dernier.desc)
  if (!champ) return
  let chip = champ.querySelector(':scope > .effet')
  if (!chip) {
    chip = h('span', { class: 'effet', role: 'status', 'aria-live': 'polite' })
    // Sous le cadre d'un champ ; sous la ligne d'une charge ou d'un avantage.
    const ancre = champ.querySelector(':scope > .control, :scope > [data-effet-ancre]')
    if (ancre) ancre.after(chip)
    else champ.appendChild(chip)
  }
  chip.dataset.pour = JSON.stringify(dernier.desc)
  chip.className = `effet ${dernier.bon ? 'is-bon' : 'is-mauvais'}`
  chip.textContent = dernier.texte
}

/** Après chaque redessin de page : la pastille retrouve son champ. */
export function reposerEffet() {
  if (dernier && dernier.desc.route !== route()) dernier = null
  poser()
}

export function installEffet() {
  document.addEventListener('focusin', (e) => {
    const el = e.target
    if (!(el instanceof HTMLElement) || !el.matches('input, select, textarea')) return
    if (HORS.has(route())) return
    if (!champDe(el)) return
    if (suivi && suivi.el === el) return
    const desc = decrire(el)
    if (!desc) return
    // Le même champ, redessiné et refocalisé après sa propre saisie : on
    // garde le repère pris en y entrant, sinon l'effet s'effacerait lui-même.
    if (suivi && JSON.stringify(suivi.desc) === JSON.stringify(desc)) { suivi.el = el; return }
    // Un autre champ : on repart de ce qu'est le plan maintenant.
    if (dernier && JSON.stringify(dernier.desc) !== JSON.stringify(desc)) { dernier = null; poser() }
    suivi = { el, desc, base: photo(store.result), modifie: false }
  }, true)
  const marque = (e) => { if (suivi && e.target === suivi.el) suivi.modifie = true }
  document.addEventListener('input', marque, true)
  document.addEventListener('change', marque, true)
  window.addEventListener('hashchange', () => { suivi = null; dernier = null })

  store.subscribe((_, raison) => {
    if (raison === 'scenario') { suivi = null; dernier = null; return }
    if (raison !== 'saisie' || !suivi || !suivi.modifie) return
    const e = effetDe(suivi.base, store.result)
    dernier = e ? { desc: suivi.desc, ...e } : null
    // Le redessin peut être différé : on pose tout de suite, et à nouveau
    // quand la page aura été remplacée.
    poser()
    requestAnimationFrame(poser)
  })
}
