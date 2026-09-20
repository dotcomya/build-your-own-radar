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
import { checklist } from './checklist.js'
import { goToGap } from './spotlight.js'
import store from '../state/store.js'

const memory = { closed: false }

export function coach(navigate) {
  const s = store.scenario
  if (!s) return null

  // Le guide et la liste « affiner » disent la même chose au même moment : ils
  // lisent donc la même source, classée par ce que chaque ligne apporte au
  // dossier. Le guide n'en montre qu'une — la plus utile encore ouverte.
  const c = checklist(s)
  // Plus rien à poser : le guide n'a pas à occuper l'écran pour dire bravo.
  if (!c.next) return null
  const pct = Math.round(c.ratio * 100)

  if (memory.closed) {
    return h('button', {
      class: 'nextstep-tab', title: 'Reprendre le guide',
      onClick: () => { memory.closed = false; render() },
    }, h('span', { class: 'nextstep-tab-dot' }), `${pct} %`)
  }

  const el = h('aside', { class: 'nextstep', role: 'complementary' },
    h('div', { class: 'nextstep-ring', 'aria-hidden': 'true' },
      h('span', { class: 'nextstep-ring-fill', style: { '--part': String(c.ratio) } }),
      h('span', { class: 'nextstep-ring-num' }, `${pct}%`),
    ),
    h('div', { class: 'nextstep-body' },
      h('div', { class: 'nextstep-tag' }, 'À poser maintenant'),
      h('div', { class: 'nextstep-do' }, c.next.label),
      h('div', { class: 'nextstep-unlock' }, c.next.why),
    ),
    h('button', {
      class: 'btn btn-primary nextstep-go',
      onClick: () => goToGap(c.next.go, navigate),
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
