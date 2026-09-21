/**
 * La page d'accueil du site.
 *
 * Elle n'existait pas : l'adresse racine tombait directement dans la première
 * question du parcours. C'est efficace pour qui sait déjà ce qu'il vient
 * chercher, et muet pour tous les autres — un investisseur, un partenaire, un
 * fondateur à qui on a envoyé le lien n'avaient aucun endroit où lire ce que
 * fait Fynomia avant de se voir demander leur métier.
 *
 * Cette page dit trois choses, dans cet ordre : à qui ça s'adresse, ce que ça
 * produit, et ce que ça coûte en temps. Puis elle laisse entrer. Le logo, en
 * haut, ramène toujours à l'outil : c'est le seul chemin de retour dont on a
 * besoin quand on est déjà client.
 */

import { h, toast } from '../dom.js'
import { resetSetup } from './setup.js'
import store from '../../state/store.js'
import { icon } from '../icons.js'

const PREUVES = [
  ['depart', 'Tu réponds en ordre de grandeur',
    'Douze questions, des estimations. Fynomia part des repères de ton métier partout où tu n’as pas de chiffre.'],
  ['argent', 'Il en sort des comptes, pas un document',
    'Cotisations, TVA, impôt sur les sociétés, amortissements, besoin en fonds de roulement : le calcul complet, à la fiscalité française 2026.'],
  ['savoir', 'Tu vois où agir, pas seulement où tu en es',
    'Chaque chiffre dit d’où il vient et sur quelle page il se corrige. Une valeur changée, tout se recalcule.'],
]

const LIVRABLES = [
  'Compte de résultat sur cinq ans',
  'Plan de trésorerie mois par mois',
  'Bilan et besoin en fonds de roulement',
  'Ce qu’il te reste, une fois tout payé',
  'Dossier exportable en PowerPoint et en tableur',
]

export function renderHome(navigate) {
  const reprises = store.list().filter((p) => !store.scenarios[p.id]?.meta?.isDemo)
  const entrer = () => navigate(store.scenario ? '#/tableau-de-bord' : '#/creer')

  return h('div', { class: 'home' },
    h('header', { class: 'home-bar' },
      // Le logo est un bouton, et il ramène dans l'outil.
      h('button', { class: 'home-logo', onClick: entrer, title: 'Ouvrir Fynomia' },
        h('span', { class: 'home-logo-mark' }, 'F'),
        h('span', { class: 'home-logo-name' }, 'FYNOMIA'),
        h('span', { class: 'home-logo-year' }, 'FR / 2026'),
      ),
      h('span', { class: 'spacer' }),
      reprises.length
        ? h('button', { class: 'btn btn-sm btn-ghost', onClick: () => { store.load(reprises[0].id); navigate('#/tableau-de-bord') } },
            `Reprendre « ${reprises[0].name} »`)
        : null,
      h('button', { class: 'btn btn-sm home-enter', onClick: entrer }, 'Ouvrir l’outil →'),
    ),

    h('section', { class: 'home-hero' },
      h('div', { class: 'home-say' },
        h('div', { class: 'home-kicker' }, 'Business plan · France 2026'),
        h('h1', { class: 'home-big' },
          'La puissance d’une direction financière',
          h('b', {}, ' à la portée de chaque entrepreneur.'),
        ),
        h('p', { class: 'home-lede' },
          'Que tu ouvres une boulangerie ou que tu développes une startup, piloter ton activité ne devrait pas nécessiter un master en finance.'),
        h('div', { class: 'home-cta' },
          h('button', {
            class: 'btn btn-primary btn-lg home-go',
            onClick: () => { resetSetup(); navigate('#/creer') },
          }, 'Construire mon business plan'),
          h('button', {
            class: 'btn btn-lg home-demo',
            onClick: () => { store.seedDemo(); toast('Exemple chargé — modifie-le librement.'); navigate('#/tableau-de-bord') },
          }, 'Voir un exemple complet'),
        ),
        h('p', { class: 'home-meta' }, 'Trois minutes · aucune inscription · tes données restent sur ton appareil'),
      ),
      h('div', { class: 'home-art', 'aria-hidden': 'true', html: icon('depart', 'home-art-img') }),
    ),

    h('section', { class: 'home-proof' },
      ...PREUVES.map(([ico, titre, corps], i) => h('article', { class: 'home-proof-item' },
        h('span', { class: 'home-proof-no' }, String(i + 1).padStart(2, '0')),
        h('span', { class: 'home-proof-ico', 'aria-hidden': 'true', html: icon(ico) }),
        h('h2', {}, titre),
        h('p', {}, corps),
      )),
    ),

    h('section', { class: 'home-out' },
      h('div', { class: 'home-out-say' },
        h('div', { class: 'home-out-kicker' }, 'Ce que tu repars avec'),
        h('h2', {}, 'Les pièces qu’un banquier, un comptable ou un investisseur demandent.'),
        h('p', {}, 'Pas un modèle à remplir : des états financiers calculés à partir de tes réponses, cohérents entre eux, et refaits à chaque modification.'),
      ),
      h('ul', { class: 'home-out-list' },
        ...LIVRABLES.map((l) => h('li', {}, l)),
      ),
    ),

    h('footer', { class: 'home-foot' },
      h('button', { class: 'btn btn-primary btn-lg', onClick: () => { resetSetup(); navigate('#/creer') } },
        'Commencer — trois minutes'),
      h('p', {}, 'Les règles de calcul appliquées sont celles du droit fiscal et social français. Les valeurs de l’exercice sont listées et sourcées dans les réglages.'),
    ),
  )
}
