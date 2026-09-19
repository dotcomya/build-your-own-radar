/**
 * Le guide : une chose à faire, en bas de l'écran, toujours la même place.
 *
 * Arrivé au tableau de bord, le fondateur passe d'un parcours qui posait une
 * question à la fois à une page couverte de chiffres. Il a bien répondu, et il
 * ne sait plus quoi faire. Un tutoriel à fenêtres — « cliquez ici », « suivant »,
 * « suivant » — réglerait le problème en en créant un autre : on lit trois
 * écrans de texte avant de toucher quoi que ce soit.
 *
 * Celui-ci ne dit jamais plus d'une phrase. Il se tient dans le coin, à demeure,
 * annonce la prochaine chose à poser et ce qu'elle débloque, et emmène au champ
 * exact quand on le lui demande. Quand il n'y a plus rien à poser, il se tait.
 * On le referme ; il revient sous forme d'une pastille qu'on rouvre d'un clic.
 */

import { h } from './dom.js'
import { buildState } from '../engine/build.js'
import { goToGap } from './spotlight.js'
import store from '../state/store.js'

/** L'endroit exact où chaque brique se pose. */
const WHERE = {
  projet: { route: 'projet', anchor: 'pitch', do: 'Nomme ton projet et choisis ta forme juridique' },
  prix: { route: 'offre', view: 'offres', sec: 'prix', openAll: true, anchor: 'prix', do: 'Donne un prix à ce que tu vends' },
  clients: { route: 'offre', view: 'offres', sec: 'volumes', openAll: true, anchor: 'volumes', do: 'Dis combien tu en vends par mois' },
  couts: { route: 'achats', view: 'charges', anchor: 'oublis', do: 'Coche les charges qui tombent chaque mois' },
  equipe: { route: 'equipe', view: 'postes', anchor: 'equipe', do: 'Donne-toi une rémunération' },
  financement: { route: 'financement', view: 'sources', anchor: 'sources', do: 'Indique ce que tu mets sur la table' },
}

const memory = { closed: false }

export function coach(navigate) {
  const s = store.scenario
  if (!s) return null

  const b = buildState(s)
  const next = b.bricks.find((x) => !x.done)
  const where = next && WHERE[next.key]

  // Plus rien à poser : le guide n'a pas à occuper l'écran pour dire bravo.
  if (!next || !where) return null

  if (memory.closed) {
    return h('button', {
      class: 'nextstep-tab', title: 'Reprendre le guide',
      onClick: () => { memory.closed = false; render() },
    }, h('span', { class: 'nextstep-tab-dot' }), `${b.done}/${b.total}`)
  }

  const el = h('aside', { class: 'nextstep', role: 'complementary' },
    h('div', { class: 'nextstep-ring', 'aria-hidden': 'true' },
      h('span', { class: 'nextstep-ring-fill', style: { '--part': String(b.done / b.total) } }),
      h('span', { class: 'nextstep-ring-num' }, `${b.done}/${b.total}`),
    ),
    h('div', { class: 'nextstep-body' },
      h('div', { class: 'nextstep-tag' }, 'Prochaine étape'),
      h('div', { class: 'nextstep-do' }, where.do),
      b.upcoming ? h('div', { class: 'nextstep-unlock' }, `Ensuite : ${b.upcoming.label}`) : null,
    ),
    h('button', {
      class: 'btn btn-primary nextstep-go',
      onClick: () => goToGap(where, navigate),
    }, 'Y aller'),
    h('button', {
      class: 'nextstep-close', title: 'Masquer le guide',
      onClick: () => { memory.closed = true; render() },
    }, '×'),
  )
  return el
}

/** Le guide se redessine seul : il ne doit pas forcer un rendu de page. */
let render = () => {}
export function setCoachHost(fn) { render = fn }
