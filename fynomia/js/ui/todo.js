/**
 * Ce qui reste à affiner, module par module.
 *
 * Un fondateur ne sait pas ce qu'il a oublié — c'est précisément la définition
 * d'un oubli. Ce panneau lit le scénario et liste, pour la page ouverte, les
 * hypothèses encore au repos : un délai de paiement laissé à zéro, une
 * attrition jamais renseignée, aucune charge d'assurance. Rien n'est bloquant ;
 * chaque ligne dit ce que l'affiner changerait.
 *
 * On ne liste que ce qui est vraiment absent, jamais ce qui est simplement
 * faible : un plan sans marketing peut être un choix, un plan sans délai de
 * paiement est presque toujours un trou.
 */

import { h } from './dom.js'
import { goToGap } from './spotlight.js'

const n = (v) => Number(v) || 0
const has = (arr, fn) => (arr || []).some(fn)

/**
 * Une entrée : ce qui manque, ce que ça change, et où aller le renseigner.
 *
 * `go` est l'adresse exacte du champ : la route, l'onglet, au besoin la section
 * d'une carte d'offre, et le repère `data-gap` que le rendu vient entourer.
 * Sans elle, la ligne ne serait qu'un reproche.
 */
const CHECKS = {
  projet: [
    { key: 'pitch', label: 'Description de l’activité', why: 'Alimente la partie narrative du dossier.',
      missing: (s) => !s.meta.pitch,
      go: { route: 'projet', anchor: 'pitch' } },
    // On ne liste que ce qui se referme : le mois de clôture figurait ici, mais
    // choisir décembre — le cas courant — ne produit aucun changement, donc la
    // ligne ne disparaissait jamais. Le type de client, lui, se choisit d'un
    // clic et commande les délais de paiement.
    { key: 'client', label: 'Type de clientèle', why: 'Entreprises ou particuliers : ce ne sont pas les mêmes délais de paiement.',
      missing: (s) => !s.meta.clientType,
      go: { route: 'projet', anchor: 'client' } },
  ],
  offre: [
    { key: 'cout', label: 'Coût de revient', why: 'Sans lui, la marge affichée est le prix entier.',
      missing: (s) => has(s.activities, (a) => n(a.unitPrice) > 0 && n(a.unitCost) === 0),
      go: { route: 'offre', view: 'offres', sec: 'prix', openAll: true, anchor: 'prix' } },
    { key: 'delai', label: 'Délai de paiement client', why: 'C’est lui qui crée le besoin en fonds de roulement.',
      missing: (s) => has(s.activities, (a) => n(a.paymentLag) === 0 && n(a.deposit) === 0),
      go: { route: 'offre', view: 'offres', sec: 'paiement', openAll: true, anchor: 'paiement' } },
    { key: 'churn', label: 'Attrition des abonnements', why: 'Un abonnement sans attrition surestime le revenu récurrent.',
      missing: (s) => has(s.activities, (a) => n(a.recurringPrice) > 0 && n(a.churnMonthly) === 0),
      go: { route: 'offre', view: 'offres', sec: 'offre', openAll: true, anchor: 'abonnement' } },
    { key: 'acquisition', label: 'Budget d’acquisition', why: 'Relie une dépense marketing à des clients gagnés.',
      missing: (s) => (s.marketing || []).length === 0,
      go: { route: 'offre', view: 'acquisition', anchor: 'campagnes' } },
  ],
  achats: [
    { key: 'assurance', label: 'Assurance', why: 'Obligatoire dans la plupart des activités.',
      missing: (s) => !has(s.opex, (o) => /assur/i.test(o.label || '')),
      go: { route: 'achats', view: 'charges', anchor: 'oublis' } },
    { key: 'comptable', label: 'Comptable', why: 'L’oubli le plus fréquent, entre 100 et 300 € par mois.',
      missing: (s) => !has(s.opex, (o) => /comptab|honorai/i.test(o.label || '')),
      go: { route: 'achats', view: 'charges', anchor: 'oublis' } },
    { key: 'capex', label: 'Investissements', why: 'Le matériel durable s’amortit au lieu de passer en charge.',
      missing: (s) => (s.capex || []).length === 0,
      go: { route: 'achats', view: 'invest', anchor: 'capex' } },
  ],
  equipe: [
    { key: 'moi', label: 'Ta propre rémunération', why: 'Un plan où le fondateur ne se paie pas n’est pas prudent, il est faux.',
      missing: (s) => !has(s.team, (m) => /fondateur|dirigeant|moi/i.test(m.role || '') && n(m.monthlyGross) > 0),
      go: { route: 'equipe', view: 'postes', anchor: 'equipe' } },
    { key: 'mutuelle', label: 'Mutuelle collective', why: 'Obligatoire dès le premier salarié.',
      missing: (s) => n(s.hr?.benefits?.mutuelle) === 0 && has(s.team, (m) => ['cdi', 'cdd'].includes(m.contractType)),
      go: { route: 'equipe', view: 'avantages', anchor: 'avantages' } },
    { key: 'transport', label: 'Abonnement de transport', why: 'La moitié du pass est à la charge de l’employeur.',
      missing: (s) => n(s.hr?.benefits?.transport) === 0 && has(s.team, (m) => ['cdi', 'cdd'].includes(m.contractType)),
      go: { route: 'equipe', view: 'avantages', anchor: 'avantages' } },
  ],
  financement: [
    { key: 'apport', label: 'Apport des fondateurs', why: 'C’est ce qu’une banque regarde en premier.',
      missing: (s) => (s.financing?.equityFounders || []).length === 0,
      go: { route: 'financement', view: 'sources', anchor: 'sources' } },
  ],
}

/** Les manques de la page ouverte, au plus quatre. */
export function pending(pageKey, scenario) {
  const list = CHECKS[pageKey] || []
  return list.filter((c) => { try { return c.missing(scenario) } catch { return false } }).slice(0, 4)
}

/**
 * Le panneau.
 * Absent quand il n'y a rien à dire : un encart « tout va bien » est du bruit.
 */
export function todoPanel(pageKey, scenario, navigate) {
  const items = pending(pageKey, scenario)
  if (!items.length) return null
  return h('section', { class: 'affine' },
    h('div', { class: 'affine-head' },
      h('div', {},
        h('div', { class: 'affine-title' }, 'Ce que tu pourrais encore affiner'),
        h('div', { class: 'affine-sub' }, 'Rien n’est bloquant. Chaque ligne rend le modèle un peu plus juste.'),
      ),
      h('span', { class: 'affine-count' }, String(items.length)),
    ),
    h('div', { class: 'affine-grid' },
      ...items.map((it) => h('button', {
        class: 'affine-item',
        // Le clic ouvre la page, l'onglet et la carte qu'il faut, puis entoure
        // le champ. La ligne disparaît d'elle-même au rendu suivant, puisqu'elle
        // n'existe que tant que la valeur manque.
        onClick: (e) => (it.go && navigate ? goToGap(it.go, navigate, e.currentTarget) : null),
      },
        h('div', { class: 'affine-item-label' }, it.label),
        h('div', { class: 'affine-item-why' }, it.why),
        h('span', { class: 'affine-item-go' }, 'Renseigner \u2192'),
      )),
    ),
  )
}
