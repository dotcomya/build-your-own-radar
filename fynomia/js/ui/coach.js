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
 *
 * Et il accepte qu'on lui dise non. « Plus tard » range la ligne en fin de file
 * et en propose une autre — on remplit ce qui intéresse, dans l'ordre qu'on
 * veut. La ligne reportée n'est pas perdue : elle revient quand le reste est
 * posé, et le guide dit alors qu'il y revient. Un compteur en pied de carte
 * rappelle combien attendent, et les reprend toutes d'un clic.
 */

import { h } from './dom.js'
import { checklist, defer, resumeAll } from './checklist.js'
import { goToGap } from './spotlight.js'
import { changed } from './motion.js'
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
      class: `nextstep-tab ${changed('coachtab', pct) ? 'is-fresh' : ''}`, title: 'Reprendre le guide',
      onClick: () => { memory.closed = false; render() },
    }, h('span', { class: 'nextstep-tab-dot' }), `${pct} %`)
  }

  // Le guide ne rejoue son entrée que lorsqu'il change de ligne — sinon il
  // remonte et se refond à chaque rendu pour dire la même chose.
  const fresh = changed('coach', c.next.key)

  const el = h('aside', { class: `nextstep ${fresh ? 'is-fresh' : ''}`, role: 'complementary' },
    // La part posée se dessine sur l'anneau lui-même : c'est lui qui porte le
    // dégradé conique. Posée sur le disque intérieur, la variable ne remontait
    // pas, et l'anneau restait désespérément vide.
    h('div', { class: 'nextstep-ring', 'aria-hidden': 'true', style: { '--part': String(c.ratio) } },
      h('span', { class: 'nextstep-ring-fill' }),
      h('span', { class: 'nextstep-ring-num' }, `${pct}%`),
    ),
    h('div', { class: 'nextstep-body' },
      // Reproposer une ligne reportée sans le dire donnerait l'impression que
      // le guide n'écoute pas. Il le dit.
      h('div', { class: `nextstep-tag ${c.again ? 'is-again' : ''}` },
        c.again ? 'Tu l’avais remis à plus tard' : 'À poser maintenant'),
      h('div', { class: 'nextstep-do' }, c.next.label),
      h('div', { class: 'nextstep-unlock' }, c.next.why),
      h('div', { class: 'nextstep-actions' },
        h('button', {
          class: 'btn btn-primary nextstep-go',
          onClick: (e) => goToGap(c.next.go, navigate, e.currentTarget),
        }, 'Y aller'),
        // Une ligne de moins à poser ne doit jamais coûter un renoncement :
        // on la reporte, on passe à la suivante, elle reviendra.
        h('button', {
          class: 'nextstep-later',
          title: 'Passer à la suivante. Celle-ci reviendra.',
          onClick: () => { defer(c.next.key); render() },
        }, 'Plus tard'),
      ),
      c.later > 0 ? h('button', {
        class: 'nextstep-back',
        title: 'Remettre en tête de file tout ce qui a été reporté',
        onClick: () => { resumeAll(); render() },
      },
        `${c.later} en attente`,
        h('span', { class: 'nextstep-back-do' }, 'Les reprendre'),
      ) : null,
    ),
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
