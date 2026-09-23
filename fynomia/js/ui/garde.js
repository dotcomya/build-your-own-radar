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
import { vraisemblance } from '../engine/plausible.js'

/** Tout ce qui sort de l'ordinaire dans le plan courant. */
export function gardesDuPlan(s = store.scenario, r = store.result) {
  try { return vraisemblance(s, r) } catch { return [] }
}

/**
 * Le bloc « à vérifier » : la liste, le plus grave d'abord, et pour chaque
 * ligne le bouton qui mène au champ fautif.
 */
export function gardeBloc(liste, navigate, { titre, classe = '' } = {}) {
  if (!liste || !liste.length) return null
  const alertes = liste.filter((x) => x.niveau === 'alerte').length
  return h('section', { class: `garde ${alertes ? 'is-alerte' : 'is-attention'} ${classe}`, role: 'note', 'data-garde': String(liste.length) },
    h('div', { class: 'garde-head' },
      h('span', { class: 'garde-sign', 'aria-hidden': 'true' }),
      h('div', { class: 'garde-txt' },
        h('strong', { class: 'garde-title' }, titre || (liste.length > 1
          ? `${liste.length} chiffres sortent de l’ordinaire pour ton métier`
          : 'Un chiffre sort de l’ordinaire pour ton métier')),
        h('p', { class: 'garde-say' }, alertes
          ? 'Tout ce qui suit en découle : corrige d’abord, lis ensuite.'
          : 'Un positionnement atypique existe : vérifie simplement que c’est voulu.'),
      ),
    ),
    h('ul', { class: 'garde-list' },
      ...liste.map((x) => h('li', { class: `garde-item is-${x.niveau}` },
        h('div', { class: 'garde-item-txt' },
          h('b', {}, x.sujet),
          h('span', {}, x.texte),
        ),
        x.go && navigate
          ? h('button', { class: 'garde-go', onClick: (e) => goToGap(x.go, navigate, e.currentTarget) }, 'Corriger →')
          : null,
      )),
    ),
  )
}

/** Le bloc d'une page de saisie : seulement ce qui s'y corrige. */
export function gardePage(route, navigate) {
  const liste = gardesDuPlan().filter((x) => x.go?.route === route)
  return gardeBloc(liste, navigate, { classe: 'is-page' })
}
