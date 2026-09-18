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

const n = (v) => Number(v) || 0
const has = (arr, fn) => (arr || []).some(fn)

/** Une entrée : ce qui manque, et ce que ça change si on le renseigne. */
const CHECKS = {
  projet: [
    { key: 'pitch', label: 'Description de l’activité', why: 'Alimente la partie narrative du dossier.',
      missing: (s) => !s.meta.pitch },
    { key: 'cloture', label: 'Mois de clôture', why: 'Décale la date des impôts, pas les montants.',
      missing: (s) => !s.meta.fiscalYearEnd },
  ],
  offre: [
    { key: 'cout', label: 'Coût de revient', why: 'Sans lui, la marge affichée est le prix entier.',
      missing: (s) => has(s.activities, (a) => n(a.unitPrice) > 0 && n(a.unitCost) === 0) },
    { key: 'delai', label: 'Délai de paiement client', why: 'C’est lui qui crée le besoin en fonds de roulement.',
      missing: (s) => has(s.activities, (a) => n(a.paymentLag) === 0 && n(a.deposit) === 0) },
    { key: 'churn', label: 'Attrition des abonnements', why: 'Un abonnement sans attrition surestime le revenu récurrent.',
      missing: (s) => has(s.activities, (a) => n(a.recurringPrice) > 0 && n(a.churnMonthly) === 0) },
    { key: 'acquisition', label: 'Budget d’acquisition', why: 'Relie une dépense marketing à des clients gagnés.',
      missing: (s) => (s.marketing || []).length === 0 },
  ],
  achats: [
    { key: 'assurance', label: 'Assurance', why: 'Obligatoire dans la plupart des activités.',
      missing: (s) => !has(s.opex, (o) => /assur/i.test(o.label || '')) },
    { key: 'comptable', label: 'Comptable', why: 'L’oubli le plus fréquent, entre 100 et 300 € par mois.',
      missing: (s) => !has(s.opex, (o) => /comptab|honorai/i.test(o.label || '')) },
    { key: 'capex', label: 'Investissements', why: 'Le matériel durable s’amortit au lieu de passer en charge.',
      missing: (s) => (s.capex || []).length === 0 },
  ],
  equipe: [
    { key: 'moi', label: 'Ta propre rémunération', why: 'Un plan où le fondateur ne se paie pas n’est pas prudent, il est faux.',
      missing: (s) => !has(s.team, (m) => /fondateur|dirigeant|moi/i.test(m.role || '') && n(m.monthlyGross) > 0) },
    { key: 'mutuelle', label: 'Mutuelle collective', why: 'Obligatoire dès le premier salarié.',
      missing: (s) => n(s.hr?.benefits?.mutuelle) === 0 && has(s.team, (m) => ['cdi', 'cdd'].includes(m.contractType)) },
    { key: 'transport', label: 'Abonnement de transport', why: 'La moitié du pass est à la charge de l’employeur.',
      missing: (s) => n(s.hr?.benefits?.transport) === 0 && has(s.team, (m) => ['cdi', 'cdd'].includes(m.contractType)) },
  ],
  financement: [
    { key: 'apport', label: 'Apport des fondateurs', why: 'C’est ce qu’une banque regarde en premier.',
      missing: (s) => (s.financing?.equityFounders || []).length === 0 },
    { key: 'cash', label: 'Trésorerie de départ', why: 'Ce qui est déjà sur le compte avant tout apport.',
      missing: (s) => n(s.financing?.openingCash) === 0 },
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
export function todoPanel(pageKey, scenario, onGo) {
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
        onClick: () => onGo && onGo(it.key),
      },
        h('div', { class: 'affine-item-label' }, it.label),
        h('div', { class: 'affine-item-why' }, it.why),
      )),
    ),
  )
}
