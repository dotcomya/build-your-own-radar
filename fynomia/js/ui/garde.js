/**
 * Les garde-fous, à l'écran.
 *
 * Le moteur sait dire qu'un chiffre sort de toute proportion avec le métier
 * (voir engine/plausible.js). Encore faut-il que ça se lise au bon endroit :
 *
 *   - sous le champ, pendant qu'on tape — c'est là que la faute se corrige ;
 *   - en tête de la page où elle se corrige, pour qui y revient plus tard ;
 *   - en tête des synthèses, avant les résultats qui en découlent.
 *
 * Le ton reste celui d'un associé qui relit : il dit l'écart, de combien, et
 * où corriger. Pas de rouge vif ni de point d'exclamation qui clignote ; un
 * trait de couleur, le chiffre, un bouton.
 */

import { h } from './dom.js'
import { goToGap } from './spotlight.js'
import store from '../state/store.js'
import { vraisemblance, signature } from '../engine/plausible.js'

/** Tout ce qui sort de l'ordinaire dans le plan courant. */
export function gardesDuPlan(s = store.scenario, r = store.result) {
  try { return vraisemblance(s, r) } catch { return [] }
}

/**
 * Le bloc « à vérifier », replié.
 *
 * Il s'étalait sur la moitié de l'écran, au-dessus des champs qu'on venait
 * remplir. Il tient maintenant sur une ligne — une pastille d'avertissement
 * qui dit combien de chiffres étonnent — et se déplie au clic : l'écart, de
 * combien, et le bouton qui mène au champ. On sait qu'il y a quelque chose
 * sans que ça prenne la place du travail.
 */
export function gardeBloc(liste, navigate, { classe = '', ouvert = false, court = false } = {}) {
  if (!liste || !liste.length) return null
  const alertes = liste.filter((x) => x.niveau === 'alerte').length
  const d = h('details', {
    class: `garde ${alertes ? 'is-alerte' : 'is-attention'} ${court ? 'is-court' : ''} ${classe}`,
    open: ouvert || ouvertIci(classe) || null, 'data-garde': String(liste.length), 'data-cle': classe,
  },
    h('summary', { class: 'garde-pill' },
      h('span', { class: 'garde-sign', 'aria-hidden': 'true' }),
      h('span', { class: 'garde-pill-txt' }, court
        ? `${liste.length} à vérifier`
        : liste.length > 1
          ? `${liste.length} chiffres à vérifier`
          : `${liste[0].sujet} est à vérifier`),
      court ? null : h('span', { class: 'garde-pill-more' }, 'Voir pourquoi'),
    ),
    h('div', { class: 'garde-body' },
      h('p', { class: 'garde-say' }, alertes
        ? 'Ces chiffres sont très loin de ce qu’on voit dans ton métier. Souvent, c’est un zéro de trop ou une unité confondue. Corrige-les, ou valide-les si c’est voulu.'
        : 'Ces chiffres sortent de l’ordinaire pour ton métier. Si c’est voulu, valide-les : on n’en parlera plus.'),
      h('ul', { class: 'garde-list' },
        ...liste.map((x) => h('li', { class: `garde-item is-${x.niveau}` },
          h('div', { class: 'garde-item-txt' },
            h('b', {}, x.sujet),
            h('span', {}, x.texte),
          ),
          h('div', { class: 'garde-acts' },
            h('button', { class: 'garde-ok', onClick: () => valider(x) }, 'Je valide'),
            x.go && navigate
              ? h('button', { class: 'garde-go', onClick: (e) => goToGap(x.go, navigate, e.currentTarget) }, 'Corriger →')
              : null,
          ),
        )),
      ),
    ),
  )
  d.addEventListener('toggle', () => { d.open ? gardeOuverts.add(classe) : gardeOuverts.delete(classe) })
  return d
}

/**
 * Un bloc déplié le reste d'un rendu à l'autre, sur la même page : corriger
 * un chiffre redessine la page, et le bloc ne doit pas se refermer sous les
 * yeux. Mais il se referme dès qu'on change de page — il ne doit pas suivre
 * le fondateur partout — et dès qu'on clique ailleurs.
 */
const gardeOuverts = new Set()
let pageDesOuverts = null
const pageCourante = () => String(typeof location !== 'undefined' ? location.hash : '').split('?')[0]
function ouvertIci(classe) {
  const page = pageCourante()
  if (page !== pageDesOuverts) { gardeOuverts.clear(); pageDesOuverts = page }
  return gardeOuverts.has(classe)
}
if (typeof window !== 'undefined') {
  // Une autre page, et plus rien d'ouvert — même si elle n'a pas d'alerte.
  window.addEventListener('hashchange', () => { gardeOuverts.clear(); pageDesOuverts = pageCourante() })
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    for (const d of document.querySelectorAll('details.garde[open]')) {
      // L'état retenu s'efface tout de suite : un redessin déclenché par ce
      // même clic ne doit pas rouvrir le bloc.
      if (!d.contains(e.target)) { d.open = false; gardeOuverts.delete(d.dataset.cle || '') }
    }
  }, true)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    for (const d of document.querySelectorAll('details.garde[open]')) { d.open = false; gardeOuverts.delete(d.dataset.cle || '') }
  })
}

/** Le bloc d'une page de saisie : seulement ce qui s'y corrige. */
export function gardePage(route, navigate, { court = false } = {}) {
  const liste = gardesDuPlan().filter((x) => x.go?.route === route)
  return gardeBloc(liste, navigate, { classe: 'is-page', court })
}

/**
 * « Je valide » : le chiffre est voulu, on n'en parle plus.
 *
 * Un loyer de 12 000 € par mois à Paris n'est pas une faute de frappe ; le
 * redire à chaque page finirait par faire ignorer les vrais avertissements.
 * Le fondateur le valide, et il disparaît partout — tant que la valeur ne
 * change pas.
 */
export function valider(x) {
  store.update((sc) => {
    sc.meta.gardesValidees = { ...(sc.meta.gardesValidees || {}), [x.cle]: signature(x) }
  }, { label: `${x.sujet} validé` })
}

/** L'avertissement d'une ligne précise (une charge, un poste), sous elle. */
export function gardeLigne(cle) {
  const x = gardesDuPlan().find((g) => g.cle === cle)
  if (!x) return null
  return h('div', { class: `garde-ligne is-${x.niveau}`, role: 'status' },
    h('span', { class: 'garde-sign', 'aria-hidden': 'true' }),
    h('span', { class: 'garde-ligne-txt' }, x.texte),
    h('button', { class: 'garde-ok', onClick: () => valider(x) }, 'Je valide'),
  )
}
