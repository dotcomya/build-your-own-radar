/**
 * La barre de guidage.
 *
 * Le parcours guidé pose les onze questions et s'arrête là. Passé cet instant,
 * le fondateur se retrouve dans le logiciel complet — et c'est bien ce qu'il
 * veut : voir qu'il y a de la profondeur. Mais un logiciel complet sans fil
 * conducteur redevient un tableur avec des onglets.
 *
 * Cette barre est ce fil. Elle reste à droite, elle dit où l'on en est, ce que
 * la page ouverte sert à faire, et ce qui vient après. On avance d'un bouton,
 * on saute où l'on veut, on la replie quand on n'en a plus besoin — et ce choix
 * est retenu. Elle guide, elle n'enferme pas.
 */

import { h } from './dom.js'
import { journey, points } from '../engine/journey.js'
import store from '../state/store.js'

const KEY = 'fynomia.guide.open'
const isOpen = () => {
  try { return localStorage.getItem(KEY) !== '0' } catch { return true }
}
const setOpen = (v) => { try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* mode privé */ } }

/** Ce que chaque page sert à faire, en une phrase d'action. */
const WHAT = {
  modele: 'Fixe le prix, le coût de revient et la façon dont l’argent revient.',
  offre: 'Règle les volumes, les délais de paiement et la saisonnalité.',
  marketing: 'Branchez tes budgets d’acquisition sur tes offres.',
  equipe: 'Ajoute les postes : Fynomia calcule le coût employeur réel.',
  charges: 'Liste ce qui tombe tous les mois, et tes investissements.',
  financement: 'Apport, prêts, subventions — et ce qu’il reste à trouver.',
  'mon-revenu': 'Arbitre entre salaire et dividendes, et vois le net.',
  'business-case': 'Relis le dossier, puis exporte-le.',
  reglages: 'Le métier, la forme juridique, les paramètres fiscaux.',
  'tableau-de-bord': 'Le verdict, la trésorerie annotée et les leviers chiffrés.',
  resultats: 'Compte de résultat, trésorerie, bilan, plan de financement.',
  parcours: 'Ton avancement, étape par étape.',
}

export function guideBar(route, navigate) {
  if (!store.scenario || !store.result) return null

  let j
  try { j = journey(store.scenario, store.result) } catch { return null }

  const open = isOpen()
  const here = j.steps.find((s) => s.page === route)
  const index = here ? j.steps.indexOf(here) : -1
  const next = j.steps.find((s, i) => i > index && s.status !== 'done') || j.current
  const prev = index > 0 ? j.steps[index - 1] : null

  const bar = h('aside', { class: `guide ${open ? '' : 'is-closed'}`, 'aria-label': 'Guide' })

  const toggle = h('button', {
    class: 'guide-toggle', title: open ? 'Replier le guide' : 'Ouvrir le guide',
    onClick: () => {
      const now = !bar.classList.contains('is-closed')
      bar.classList.toggle('is-closed', now)
      setOpen(!now)
      toggle.setAttribute('title', now ? 'Ouvrir le guide' : 'Replier le guide')
    },
  }, h('span', { class: 'guide-toggle-glyph' }, '›'))

  bar.append(
    toggle,

    h('div', { class: 'guide-inner' },
      h('div', { class: 'guide-head' },
        h('span', { class: 'guide-title' }, 'Guide'),
        h('span', { class: 'guide-pct num' }, `${points(j)} %`),
      ),
      h('div', { class: 'guide-track' },
        h('i', { style: { width: `${points(j)}%` } })),

      // Les pages de lecture — le parcours, les comptes — ne correspondent à
      // aucune étape, mais la barre doit quand même dire à quoi elles servent.
      WHAT[route] || here ? h('p', { class: 'guide-what' }, WHAT[route] || here.promise) : null,

      h('div', { class: 'guide-steps' },
        ...j.steps.map((st) => h('button', {
          class: `guide-step ${st.page === route ? 'current' : ''} ${st.status === 'done' ? 'done' : ''}`,
          onClick: () => navigate(`#/${st.page}`),
          title: st.detail,
        },
          h('span', { class: 'guide-step-dot' }, st.status === 'done' ? '✓' : ''),
          h('span', { class: 'guide-step-label' }, st.label),
        )),
      ),

      h('div', { class: 'guide-nav' },
        prev ? h('button', {
          class: 'btn btn-sm btn-quiet', onClick: () => navigate(`#/${prev.page}`),
        }, '← ' + prev.label) : h('span', {}),
        next && next.page !== route ? h('button', {
          class: 'btn btn-sm btn-primary', onClick: () => navigate(`#/${next.page}`),
        }, next.label + ' →') : null,
      ),

      j.completion >= 1
        ? h('button', { class: 'guide-done', onClick: () => navigate('#/business-case') },
            'Tout est rempli — exporter le dossier')
        : h('p', { class: 'guide-foot' },
            `Il reste ${j.total - j.done} étape${j.total - j.done > 1 ? 's' : ''} · environ ${j.remainingMinutes} min. Rien n’est figé : reviens quand tu veux.`),
    ),
  )

  return bar
}
