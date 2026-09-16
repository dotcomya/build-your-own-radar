/** L'accueil : commencer, ou reprendre. */

import { h, toast } from '../dom.js'
import { resetSetup } from './setup.js'
import store from '../../state/store.js'

/**
 * L'accueil.
 *
 * Une phrase, un bouton. L'exemple existe — il rassure — mais il est à côté et
 * en petit : ce que le fondateur doit faire, c'est commencer le sien.
 */
export function renderOnboarding(navigate) {
  const existing = store.list().filter((p) => !store.scenarios[p.id]?.meta?.isDemo)

  return h('div', { class: 'landing' },
    h('div', { class: 'landing-inner' },
      h('div', { class: 'landing-mark' }, 'F'),
      h('h1', { class: 'landing-title' }, 'Faites votre business plan'),
      h('p', { class: 'landing-line' },
        'Onze questions. Fizzy s’occupe des cotisations, de la TVA, des impôts et de la trésorerie.'),

      h('div', { class: 'landing-actions' },
        h('button', {
          class: 'btn btn-primary btn-lg',
          onClick: () => { resetSetup(); navigate('#/creer') },
        }, 'Commencer'),
        h('button', {
          class: 'landing-example',
          onClick: () => {
            const demo = store.seedDemo()
            toast('Exemple chargé — modifiez-le librement.')
            navigate('#/parcours')
          },
        }, 'ou voir un exemple'),
      ),

      existing.length ? h('div', { class: 'landing-resume' },
        h('span', { class: 'landing-resume-tag' }, 'Reprendre'),
        ...existing.slice(0, 3).map((p) => h('button', {
          class: 'landing-resume-item',
          onClick: () => { store.load(p.id); navigate('#/parcours') },
        },
          h('span', {}, p.name),
          h('span', { class: 'landing-resume-when' }, relative(p.updatedAt)),
        )),
      ) : null,
    ),

    h('p', { class: 'landing-foot' },
      'Fiscalité française. Vos chiffres restent les vôtres — export libre à tout moment.'),
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
