/**
 * Les micro-tutos.
 *
 * Un fondateur seul devant un prévisionnel ne manque pas de champs à remplir :
 * il manque de quelqu'un qui lui dise, au moment où il hésite, ce que ce
 * chiffre déclenche et quelle erreur tout le monde fait ici. C'est ce que ce
 * composant apporte sur chaque page du parcours.
 *
 * Le ton est celui d'un associé qui a déjà fait l'exercice, pas d'un manuel :
 * une affirmation, un ordre de grandeur, et ce qu'il faut en conclure.
 */

import { h } from './dom.js'
import { STEPS } from '../engine/journey.js'

/** Les tutos restent ouverts ou fermés d'une page à l'autre, par étape. */
const closed = new Set()

/**
 * Le bloc de coaching d'une étape.
 * `step` peut être l'objet d'étape ou sa clé.
 */
export function tutorial(step, navigate) {
  const s = typeof step === 'string' ? STEPS.find((x) => x.key === step) : step
  if (!s?.tips?.length) return null
  const isClosed = closed.has(s.key)

  const body = h('div', { class: 'coach-body' },
    h('div', { class: 'coach-invest' },
      h('span', { class: 'coach-invest-tag' }, 'Ce qu’on te demandera'),
      h('p', {}, s.investor),
    ),
    h('div', { class: 'coach-tips' },
      ...s.tips.map((tip, i) => h('div', { class: 'coach-tip' },
        h('span', { class: 'coach-tip-no num' }, String(i + 1)),
        h('div', {},
          h('div', { class: 'coach-tip-title' }, tip.title),
          h('p', { class: 'coach-tip-body' }, tip.body),
        ),
      )),
    ),
  )

  const panel = h('section', { class: `coach ${isClosed ? 'is-closed' : ''}` },
    h('button', {
      class: 'coach-head', 'aria-expanded': String(!isClosed),
      onClick: () => {
        if (closed.has(s.key)) closed.delete(s.key); else closed.add(s.key)
        panel.classList.toggle('is-closed')
        const btn = panel.querySelector('.coach-head')
        btn.setAttribute('aria-expanded', String(!panel.classList.contains('is-closed')))
      },
    },
      h('span', { class: 'coach-badge' }, '?'),
      h('span', { class: 'coach-title' }, 'Ce qu’il faut savoir ici'),
      h('span', { class: 'coach-count' }, `${s.tips.length} repères`),
      h('span', { class: 'coach-chevron', 'aria-hidden': 'true' }, '›'),
    ),
    body,
  )
  return panel
}

/**
 * Bandeau d'étape : où on en est, ce que cette page débloque, et par où
 * continuer. Posé en tête des pages du parcours.
 */
export function stepBanner(stepKey, journeyState, navigate) {
  const step = STEPS.find((x) => x.key === stepKey)
  if (!step) return null
  const live = journeyState?.steps?.find((x) => x.key === stepKey)
  const index = STEPS.indexOf(step) + 1
  const next = journeyState?.steps?.find((x, i) => i >= index && x.status !== 'done')

  return h('div', { class: `step-banner ${live?.status || 'todo'}` },
    h('div', { class: 'step-banner-main' },
      h('div', { class: 'step-banner-tag' },
        h('span', { class: 'step-banner-no num' }, `${index}/${STEPS.length}`),
        h('span', {}, step.label),
        live?.status === 'done' ? h('span', { class: 'step-banner-check' }, '✓ fait') : null,
      ),
      h('div', { class: 'step-banner-q' }, step.question),
      h('p', { class: 'step-banner-why' }, step.promise),
    ),
    h('div', { class: 'step-banner-side' },
      h('div', { class: 'step-banner-unlock' },
        h('span', { class: 'eyebrow' }, 'Ça débloque'),
        h('span', {}, step.unlocks),
      ),
      next ? h('button', {
        class: 'btn btn-sm', onClick: () => navigate(`#/${next.page}`),
      }, `Suite : ${next.label} →`) : null,
      h('button', { class: 'btn btn-sm btn-ghost', onClick: () => navigate('#/parcours') }, '← Le parcours'),
    ),
  )
}
