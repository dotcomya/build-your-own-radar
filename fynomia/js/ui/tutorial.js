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
import { guideFor } from './guides.js'

/** Les tutos restent ouverts ou fermés d'une page à l'autre, par étape. */
const closed = new Set()
let everOpened = false

/**
 * Le bloc de coaching d'une étape.
 * `step` peut être l'objet d'étape ou sa clé.
 */
export function tutorial(step, navigate) {
  const s = typeof step === 'string' ? STEPS.find((x) => x.key === step) : step
  if (!s?.tips?.length) return null
  // Fermé tant qu'on ne l'a jamais ouvert : les repères attendent qu'on les
  // demande, au lieu de s'imposer pendant la saisie.
  const isClosed = closed.has(s.key) || !everOpened

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
        everOpened = true
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

/**
 * Le contenu du bandeau d'étape, sans son enveloppe.
 *
 * `stepBanner` produisait un bloc replié de plus, posé sous le titre du module.
 * La tête de module l'absorbe désormais derrière le « + » de son lede : la
 * question du parcours et le mode d'emploi sont toujours là, mais ils ne
 * coûtent plus une ligne à l'écran tant qu'on ne les demande pas.
 */
export function stepGuide(stepKey, journeyState, pageKey = stepKey) {
  const step = STEPS.find((x) => x.key === stepKey)
  const guide = guideFor(pageKey)
  if (!step && !guide) return null
  const live = step ? journeyState?.steps?.find((x) => x.key === stepKey) : null

  return h('div', { class: 'module-guide-body' },
    step ? h('div', { class: `module-guide-q ${live?.status || 'todo'}` },
      h('span', { class: 'module-guide-mark', 'aria-hidden': 'true' }, live?.status === 'done' ? '✓' : '?'),
      h('div', {},
        h('div', { class: 'module-guide-ask' }, step.question),
        h('p', { class: 'module-guide-why' }, step.promise),
      ),
    ) : null,
    guide ? h('div', { class: 'guide-grid' },
      guideCell('Ce que fait cette partie', guide.role),
      guideCell('Pourquoi ça compte', guide.why),
      guideCell('Ce qu’on regarde en premier', guide.first),
    ) : null,
  )
}

const guideCell = (title, body) => h('div', { class: 'guide-cell' },
  h('div', { class: 'guide-cell-tag' }, title),
  h('p', {}, body),
)


