/** L'accueil : commencer, ou reprendre. */

import { h, toast } from '../dom.js'
import { resetSetup } from './setup.js'
import { resetChat } from './chat.js'
import store from '../../state/store.js'

/**
 * L'accueil.
 *
 * Deux panneaux : à gauche ce que fait l'outil, sur fond noir ; à droite ce
 * qu'on peut faire, tout de suite. L'exemple existe — il rassure — mais il
 * reste secondaire : ce que le fondateur doit faire, c'est commencer le sien.
 *
 * Tout tient dans un écran, sans défilement : la page d'accueil d'un outil de
 * calcul n'a rien à raconter de plus.
 */
export function renderOnboarding(navigate) {
  const existing = store.list().filter((p) => !store.scenarios[p.id]?.meta?.isDemo)

  return h('div', { class: 'landing' },
    h('section', { class: 'landing-brand' },
      h('span', { class: 'landing-arc', 'aria-hidden': 'true' }),
      h('div', { class: 'landing-mark' }, 'F'),
      h('h1', { class: 'landing-title' }, 'Ton business plan, calculé'),
      h('p', { class: 'landing-line' },
        'Tu réponds à onze questions. Fynomia en tire les cotisations, la TVA, l’impôt et la trésorerie mois par mois.'),
      h('ul', { class: 'landing-facts' },
        h('li', {}, 'Fiscalité française à jour'),
        h('li', {}, 'Compte de résultat, bilan, plan de trésorerie'),
        h('li', {}, 'Dossier exportable'),
      ),
    ),

    h('section', { class: 'landing-act' },
      h('div', { class: 'landing-act-inner' },
        h('div', { class: 'landing-kicker' }, 'Commencer'),
        h('p', { class: 'landing-sub' },
          'Une question à la fois, dans le désordre si tu veux. Rien n’est figé.'),
        h('button', {
          class: 'btn btn-primary btn-lg landing-go',
          onClick: () => { resetSetup(); navigate('#/creer') },
        }, 'Créer mon business plan'),
        // Deux manières de répondre aux mêmes questions. Certains remplissent
        // un formulaire sans hésiter, d'autres se figent devant un champ vide
        // et répondraient volontiers à quelqu'un qui leur pose la question.
        h('button', {
          class: 'btn btn-lg landing-talk',
          onClick: () => { resetChat(); navigate('#/discuter') },
        }, 'ou répondre en discutant'),
        h('button', {
          class: 'landing-example',
          onClick: () => {
            store.seedDemo()
            toast('Exemple chargé — modifie-le librement.')
            navigate('#/tableau-de-bord')
          },
        }, 'ou ouvrir un exemple complet'),

        existing.length ? h('div', { class: 'landing-resume' },
          h('span', { class: 'landing-resume-tag' }, 'Reprendre'),
          ...existing.slice(0, 3).map((p) => h('button', {
            class: 'landing-resume-item',
            onClick: () => { store.load(p.id); navigate('#/tableau-de-bord') },
          },
            h('span', {}, p.name),
            h('span', { class: 'landing-resume-when' }, relative(p.updatedAt)),
          )),
        ) : null,

        h('p', { class: 'landing-foot' },
          'Tes chiffres restent dans ce navigateur. Export libre à tout moment.'),
      ),
    ),
  )
}

export function relative(ts) {
  const diff = Date.now() - ts
  const min = Math.round(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const hr = Math.round(min / 60)
  if (hr < 24) return `il y a ${hr} h`
  const d = Math.round(hr / 24)
  if (d < 30) return `il y a ${d} j`
  return new Date(ts).toLocaleDateString('fr-FR')
}
