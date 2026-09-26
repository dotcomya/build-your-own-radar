/**
 * Le bandeau d'étape d'une partie.
 *
 * Il y avait aussi ici « Ce qu'il faut savoir ici », trois repères dépliables
 * en bas de chaque page de saisie ; ils ont été retirés à la demande.
 */

import { h } from './dom.js'
import { STEPS } from '../engine/journey.js'
import { guideFor } from './guides.js'

/**
 * Bandeau d'étape : où on en est, ce que cette page débloque, et par où
 * continuer. Posé en tête des pages du parcours.
 */
/**
 * Le bandeau d'étape — réduit à ce qu'il apporte.
 *
 * Il portait un encart vert « ça débloque », un bouton vers l'étape suivante et
 * un retour au parcours : trois promesses là où il suffisait de dire où l'on
 * est. Le reste encombrait la page sans jamais être utilisé — la barre de
 * guidage, à droite, fait déjà la navigation.
 */
/**
 * Le bandeau d'une partie.
 *
 * Une ligne repliée : le numéro de l'étape et sa question. Dépliée, elle dit
 * à quoi sert cette partie, ce qu'elle décide ailleurs dans le plan, et ce
 * qu'on regarde en premier. C'est le seul endroit où le logiciel s'explique :
 * partout ailleurs, il calcule.
 */
export function stepBanner(stepKey, journeyState, navigate, pageKey = stepKey) {
  const step = STEPS.find((x) => x.key === stepKey)
  const guide = guideFor(pageKey)
  if (!step && !guide) return null
  const live = step ? journeyState?.steps?.find((x) => x.key === stepKey) : null
  const index = step ? STEPS.indexOf(step) + 1 : null

  const el = h('details', { class: `step-line ${live?.status || 'todo'}` },
    h('summary', { class: 'step-line-head' },
      index ? h('span', { class: 'step-line-no num' }, `${index}`) : h('span', { class: 'step-line-no' }, 'i'),
      h('span', { class: 'step-line-q' }, step ? step.question : 'À quoi sert cette partie'),
      live?.status === 'done' ? h('span', { class: 'step-line-done' }, 'fait') : null,
      h('span', { class: 'step-line-chev' }, '›'),
    ),
    h('div', { class: 'step-guide' },
      step ? h('p', { class: 'step-line-why' }, step.promise) : null,
      guide ? h('div', { class: 'guide-grid' },
        guideCell('Ce que fait cette partie', guide.role),
        guideCell('Pourquoi ça compte', guide.why),
        guideCell('Ce qu’on regarde en premier', guide.first),
      ) : null,
    ),
  )
  return el
}

const guideCell = (title, body) => h('div', { class: 'guide-cell' },
  h('div', { class: 'guide-cell-tag' }, title),
  h('p', {}, body),
)


