/**
 * Le panneau « affiner mon dossier ».
 *
 * Il tient la promesse que le parcours ne pouvait pas tenir : dire ce qui
 * reste, dans l'ordre où ça rapporte. Trois paliers, dix-neuf lignes, une
 * barre pondérée — et chaque ligne est un bouton qui ouvre le champ à remplir.
 *
 * Ce qui est fait se tasse ; ce qui reste s'affiche. Personne n'a besoin de
 * relire ce qu'il a déjà posé.
 */

import { h } from './dom.js'
import { checklist, resumeAll } from './checklist.js'
import { goToGap } from './spotlight.js'
import store from '../state/store.js'
import { stageOf } from './stages.js'

export function refinePanel(navigate, { compact = false, refresh = () => {} } = {}) {
  const c = checklist(store.scenario)
  const pct = Math.round(c.ratio * 100)

  return h('section', { class: `refinery ${compact ? 'is-compact' : ''}` },
    h('header', { class: 'refinery-head' },
      h('div', { class: 'refinery-id' },
        h('div', { class: 'refinery-tag' }, 'Affiner mon dossier'),
        h('div', { class: 'refinery-sub' },
          c.next
            ? `${c.total - c.done} ligne${c.total - c.done > 1 ? 's' : ''} à poser. La plus utile d’abord.`
            : 'Tout est posé. Ton dossier est complet.'),
        // Le stade dit au parcours n'est pas un réglage qu'on vient triturer :
        // c'est une phrase qui rappelle pourquoi cet ordre-là, et qui dit
        // franchement que tout finira par être rempli de toute façon.
        stageLine(),
        // Ce qu'on a reporté depuis le guide se voit ici aussi, et se reprend
        // d'un clic : « plus tard » n'est jamais un aller simple.
        c.later > 0 ? h('button', { class: 'refinery-resume', onClick: () => { resumeAll(); refresh() } },
          `${c.later} remise${c.later > 1 ? 's' : ''} à plus tard`,
          h('span', {}, 'Les reprendre'),
        ) : null,
      ),
      h('div', { class: 'refinery-score' },
        h('span', { class: 'refinery-pct num' }, `${pct} %`),
        h('span', { class: 'refinery-count num' }, `${c.done}/${c.total}`),
      ),
    ),

    h('div', { class: 'refinery-bar' },
      ...c.groups.map((g) => h('span', {
        class: `refinery-bar-seg is-${g.key}`,
        style: { flex: String(g.total * g.weight) },
      }, h('i', { style: { width: `${g.total ? (g.done / g.total) * 100 : 0}%` } }))),
    ),

    h('div', { class: 'refinery-groups' },
      ...c.groups.map((g) => h('div', { class: `refinery-group ${g.done === g.total ? 'is-full' : ''}` },
        h('div', { class: 'refinery-group-head' },
          h('span', { class: `refinery-chip is-${g.key}` }, g.label),
          h('span', { class: 'refinery-group-note' }, g.note),
          h('span', { class: 'refinery-group-count num' }, `${g.done}/${g.total}`),
        ),
        h('div', { class: 'refinery-items' },
          ...g.items.map((it) => h('button', {
            class: `refinery-item ${it.done ? 'is-done' : ''} ${it.later ? 'is-later' : ''}`,
            title: it.done ? 'Revoir' : it.later ? 'Remis à plus tard. Renseigner maintenant.' : 'Renseigner',
            onClick: () => goToGap(it.go, navigate),
          },
            h('span', { class: 'refinery-mark', 'aria-hidden': 'true' }, it.done ? '✓' : ''),
            h('span', { class: 'refinery-text' },
              h('span', { class: 'refinery-label' }, it.label),
              it.done ? null : h('span', { class: 'refinery-why' },
                it.later ? h('b', { class: 'refinery-latertag' }, 'Plus tard · ') : null, it.why),
            ),
            it.done ? null : h('span', { class: 'refinery-go' }, '→'),
          )),
        ),
      )),
    ),
  )
}

/**
 * Pourquoi cet ordre-là.
 *
 * Le fondateur a dit où il en est au tout début. Ça n'a pas fait de lui un
 * profil, et ça ne lui a rien retiré : ça a seulement décidé par quoi on
 * commence. La phrase le rappelle et le dit sans détour — les dix-neuf lignes
 * sont les mêmes pour tout le monde, seul l'ordre change.
 */
function stageLine() {
  const here = stageOf(store.scenario)
  if (!here) return null
  return h('p', { class: 'refinery-stage' },
    h('b', {}, here.cap),
    ` — ${here.says} Les dix-neuf lignes restent les mêmes pour tout le monde : seul l’ordre change.`)
}
