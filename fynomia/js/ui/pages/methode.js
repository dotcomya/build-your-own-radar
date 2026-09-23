/**
 * Méthode — d'où viennent les repères, et ce que Fynomia en fait.
 *
 * Un repère sans source est une opinion. Cette page dit, pour le métier du
 * plan ouvert, chaque fourchette, ce qu'elle mesure, comment elle se calcule
 * et d'où elle vient ; puis comment Fynomia s'en sert, et ce qu'elle ne dit
 * pas. On y arrive depuis chaque mention « dans ton métier ».
 */

import { h, euro, pct, num } from '../dom.js'
import { SECTORS } from '../../state/sectors.js'
import { SOURCES, RATIOS, REVISION, sourcesDe } from '../../state/reperes.js'
import { PARAMS } from '../../engine/fiscal-fr-2026.js'
import { SEUILS } from '../../engine/plausible.js'
import store from '../../state/store.js'

const valeur = (format, v) => {
  if (format === 'pct') return pct(v, 0)
  if (format === 'eur') return euro(v)
  if (format === 'fois') return `${num(v, v % 1 ? 1 : 0)}`
  if (format === 'jours') return `${num(v, 0)}\u00a0jours`
  if (format === 'mois') return `${num(v, 0)}\u00a0mois`
  return num(v, 0)
}

const fourchette = (format, [a, b]) => (format === 'fois'
  ? `${valeur(format, a)} à ${valeur(format, b)}\u00a0fois`
  : `${valeur(format, a)} à ${valeur(format, b)}`)

export function renderMethode(navigate) {
  const s = store.scenario
  const cle = s?.meta?.sectorKey
  const sector = SECTORS[cle]
  const bm = sector?.benchmarks || {}
  const sources = sourcesDe(cle)
  const params = Object.values(PARAMS)
  const aVerifier = params.filter((p) => p.confidence === 'to-verify').length

  const bloc = (no, titre, dit, ...corps) => h('section', { class: 'mt-bloc' },
    h('header', { class: 'mt-bloc-tete' },
      h('span', { class: 'mt-no' }, no),
      h('div', {},
        h('h2', { class: 'mt-bloc-titre' }, titre),
        dit ? h('p', { class: 'mt-bloc-dit' }, dit) : null,
      ),
    ),
    h('div', { class: 'mt-bloc-corps' }, ...corps),
  )

  return h('div', { class: 'content mt' },
    h('header', { class: 'module mt-tete' },
      h('div', { class: 'module-tag' }, h('span', { class: 'module-bar' }), h('span', {}, 'Méthode')),
      h('div', { class: 'module-top' }, h('h1', { class: 'module-title' }, 'D’où viennent les repères')),
      h('p', { class: 'mt-lede' },
        'Quand Fynomia écrit « 75 % à 90 % dans ton métier », voici ce que la fourchette mesure, comment elle se calcule, d’où elle vient — et ce qu’elle ne dit pas.'),
    ),

    bloc('01', sector ? `Les repères de ton métier : ${sector.label.toLowerCase()}` : 'Les repères de ton métier',
      `Revus en ${REVISION}. Sources : ${sources.map((x) => `${x.editeur} (données ${x.annee})`).join(', ')}.`,
      Object.keys(bm).length
        ? h('div', { class: 'table-wrap' },
          h('table', { class: 'mt-table' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Repère'), h('th', {}, 'Fourchette'), h('th', {}, 'Comment on le calcule'))),
            h('tbody', {}, ...Object.entries(bm).map(([k, v]) => {
              const R = RATIOS[k] || { nom: k, calcul: '', lecture: '', format: 'nb' }
              return h('tr', { 'data-ratio': k },
                h('td', {}, h('b', {}, R.nom), R.lecture ? h('span', { class: 'mt-lecture' }, R.lecture) : null),
                h('td', { class: 'num mt-range' }, fourchette(R.format, v)),
                h('td', { class: 'mt-calcul' }, R.calcul),
              )
            })),
          ))
        : h('p', { class: 'muted' }, 'Choisis ton métier dans Mon projet : ses repères apparaîtront ici.'),
    ),

    bloc('02', 'Comment une fourchette est construite',
      'Un ordre de grandeur, pas un chiffre recopié.',
      h('ol', { class: 'mt-etapes' },
        h('li', {}, h('b', {}, 'Le métier le plus proche. '), 'On part des ratios que publient l’INSEE (Ésane, par code d’activité) et, quand ils existent, les quartiles de la Banque de France ; pour le logiciel, l’enquête annuelle de KeyBanc auprès des éditeurs non cotés.'),
        h('li', {}, h('b', {}, 'La moitié centrale. '), 'La fourchette vise les entreprises du milieu — ni les meilleures, ni les plus fragiles —, là où la source donne des quartiles. Elle est élargie quand la publication porte sur des entreprises plus installées que celles qui démarrent : la Banque de France ne suit que celles qui dépassent 1,25 M€ de chiffre d’affaires.'),
        h('li', {}, h('b', {}, 'Arrondie. '), 'Aux cinq points près pour un pourcentage, à la dizaine pour un prix : un repère n’est jamais plus précis que sa source.'),
        h('li', {}, h('b', {}, 'Revue chaque année. '), `À la publication des nouvelles données. Dernière revue : ${REVISION}.`),
      ),
    ),

    bloc('03', 'Ce que Fynomia en fait',
      'Situer une saisie, jamais l’interdire.',
      h('ul', { class: 'mt-liste' },
        h('li', {}, 'Ta marge, ta masse salariale, ton loyer se lisent à côté de la fourchette de ton métier, dans le pitch et dans le détail de ton plan.'),
        h('li', {}, `Un prix, un salaire ou une charge ${SEUILS.attention} fois au-delà de ce qu’on voit dans ton métier fait apparaître une note sous le champ ; ${SEUILS.alerte} fois, un avertissement — c’est le plus souvent un zéro de trop ou une unité confondue.`),
        h('li', {}, 'Si ton chiffre est voulu, « Je valide » le fait taire tant qu’il ne change pas. Rien ne bloque jamais ton plan.'),
      ),
    ),

    bloc('04', 'Les paramètres fiscaux et sociaux',
      'Une autre nature de chiffre : ils viennent des textes.',
      h('p', { class: 'mt-p' },
        `Le SMIC, le plafond de la Sécurité sociale, les taux de cotisation, l’impôt sur les sociétés, les taux de la micro-entreprise, l’ACRE : ${params.length} paramètres, chacun avec sa source — loi de finances, loi de financement de la Sécurité sociale, décret, barème URSSAF. ${aVerifier} restent des ordres de grandeur à confirmer avant un usage engageant ; ils sont signalés comme tels.`),
      h('button', { class: 'btn btn-sm', onClick: () => navigate('#/reglages') }, 'Les voir dans Réglages →'),
    ),

    bloc('05', 'Toutes les sources', null,
      h('ul', { class: 'mt-sources' }, ...Object.entries(SOURCES).map(([k, x]) => h('li', { 'data-source': k },
        h('div', { class: 'mt-source-tete' },
          h('b', {}, x.editeur), ' — ', x.titre, h('span', { class: 'mt-annee' }, `données ${x.annee}`),
        ),
        h('p', { class: 'mt-source-apporte' }, x.apporte),
        h('a', { href: x.url, target: '_blank', rel: 'noopener', class: 'mt-lien' }, x.url.replace(/^https:\/\//, '')),
      ))),
    ),

    bloc('06', 'Ce que les repères ne disent pas', null,
      h('p', { class: 'mt-p' },
        'Une fourchette décrit des entreprises installées, pas la tienne. Un lancement, un emplacement exceptionnel, un modèle nouveau peuvent légitimement en sortir. Elle sert à poser la bonne question — « pourquoi suis-je au-dessus ? » — avant qu’un banquier ou un investisseur la pose. Les fourchettes ne sont pas recalculées automatiquement à partir des bases de données : elles sont relues à la main, à la date indiquée, et peuvent retarder d’une publication.'),
    ),
  )
}
