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
import { STAGES, stageOf } from './stages.js'

/**
 * Où en est le projet — déclaré au parcours, corrigeable ici.
 *
 * Le stade n'est pas un badge : il remonte, dans la liste juste en dessous,
 * les lignes qui comptent pour lui. Le changer réordonne donc la suite
 * immédiatement, ce que le fondateur voit sans qu'on ait à l'expliquer.
 */
export function stageBand(refresh) {
  const s = store.scenario
  if (!s) return null
  const here = stageOf(s)
  return h('section', { class: 'stageband', 'data-gap': 'stade' },
    h('div', { class: 'stageband-id' },
      h('div', { class: 'stageband-tag' }, here ? 'Tu en es là' : 'Où en es-tu ?'),
      h('div', { class: 'stageband-cap' }, here ? here.cap : 'Dis-nous où tu en es'),
      h('div', { class: 'stageband-says' },
        here ? here.says : "Quatre réponses possibles. Celle que tu choisis décide de ce qu'on te proposera en premier."),
    ),
    h('div', { class: 'stageband-pick' },
      ...STAGES.map((st) => h('button', {
        class: `stageband-step ${here?.key === st.key ? 'is-here' : ''}`,
        title: st.hint,
        onClick: () => { store.update((d) => { d.meta.stage = st.key }, { label: 'Stade du projet' }); refresh() },
      }, st.label)),
    ),
  )
}

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
