/**
 * Les vues par métier — désormais au second plan.
 *
 * Fynomia s'adresse d'abord à un fondateur qui construit son dossier seul. Les
 * vues CFO, marketing, RH ou conseil restent utiles quand une équipe se
 * partage le modèle, ou quand un accompagnant relit avec ses propres yeux —
 * mais elles ne doivent plus occuper la barre supérieure, où elles posaient à
 * chaque ouverture une question que le fondateur ne se pose pas.
 *
 * Elles vivent donc dans les réglages, derrière un choix explicite.
 */

import { h, toast } from './dom.js'
import { PERSONAS, getPersona } from './personas.js'
import store from '../state/store.js'

/**
 * Le sélecteur, sous forme de liste dépliée.
 * `onPick` reçoit le persona choisi ; à l'appelant de naviguer et redessiner.
 */
export function personaPicker(onPick) {
  return h('div', { class: 'persona-list' },
    ...Object.entries(PERSONAS).map(([key, p]) => h('button', {
      class: `persona-option ${store.persona === key ? 'active' : ''}`,
      onClick: () => {
        store.setPersona(key)
        if (p.forceLevel) store.setLevel(p.forceLevel)
        toast(`${p.label} — ${p.tagline}`)
        onPick(p)
      },
    },
      h('div', { class: 'persona-option-name' }, h('span', { class: 'persona-code' }, p.code), p.label),
      h('div', { class: 'persona-option-tag' }, p.tagline),
      h('div', { class: 'persona-option-brief' }, p.brief),
    )),
  )
}

/** Le persona courant, pour l'afficher ailleurs sans importer tout le module. */
export const currentPersona = () => getPersona(store.persona)
