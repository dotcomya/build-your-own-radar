/**
 * Repères de marché et alertes contextuelles.
 *
 * Un chiffre isolé ne dit rien. « 42 % de marge » n'a de sens que rapporté à
 * ce que fait le métier : excellent pour un commerce de détail, inquiétant
 * pour un logiciel. Ce module confronte la saisie aux ordres de grandeur du
 * secteur et formule ce qu'il faut en conclure.
 *
 * Les repères sont des fourchettes observées, pas des normes : on le dit.
 */

import { h, euro, pct, num } from './dom.js'
import { getSector } from '../state/sectors.js'

/**
 * Position d'une valeur par rapport à une fourchette.
 * @returns {'below'|'inside'|'above'}
 */
export function position(value, [low, high]) {
  if (value < low) return 'below'
  if (value > high) return 'inside' === 'x' ? 'inside' : (value > high ? 'above' : 'inside')
  return 'inside'
}

/** Puce de comparaison, à poser à côté d'un chiffre. */
export function benchmarkChip(value, range, { format = (v) => pct(v), invert = false } = {}) {
  if (!range) return null
  const [low, high] = range
  const where = value < low ? 'below' : value > high ? 'above' : 'inside'
  // `invert` : pour un coût, être au-dessus de la fourchette est mauvais.
  const good = where === 'inside' ? 'ok' : (where === 'below') === invert ? 'high' : 'low'
  const label = where === 'inside' ? 'dans la norme' : where === 'below' ? 'sous la norme' : 'au-dessus'
  return h('span', {
    class: `bench bench-${good}`,
    title: `Repère du secteur : ${format(low)} à ${format(high)}`,
  }, h('span', { class: 'bench-dot' }), `${label} · ${format(low)}–${format(high)}`)
}

/**
 * Alertes contextuelles pour le scénario courant.
 * Chacune porte un constat, sa raison d'être, et l'endroit où agir.
 */
export function nudges(scenario, result) {
  const sector = getSector(scenario.meta?.sectorKey)
  if (!sector || !result) return []
  const b = sector.benchmarks || {}
  const k = result.kpis
  const p = result.pnl
  const y = k.marginRate.findIndex((v) => v > 0) >= 0 ? Math.max(0, p.netResult.findIndex((v) => v > 0)) : 2
  const yy = p.netResult.findIndex((v) => v > 0) >= 0 ? p.netResult.findIndex((v) => v > 0) : 2
  const out = []

  const push = (tone, title, body, page) => out.push({ tone, title, body, page })

  // ── Marge brute ────────────────────────────────────────────────────────
  if (b.grossMargin && p.revenue[yy] > 0) {
    const rate = k.marginRate[yy]
    const [low, high] = b.grossMargin
    if (rate < low) {
      push('bad', `Marge de ${pct(rate)} contre ${pct(low)} à ${pct(high)} dans le métier`,
        `Vous êtes ${pct(low - rate)} sous le bas de la fourchette. Sur ${euro(p.revenue[yy])} de chiffre d'affaires, revenir dans la norme dégagerait ${euro((low - rate) * p.revenue[yy])} de marge supplémentaire — sans vendre une unité de plus.`, 'offre')
    } else if (rate > high + 0.1) {
      push('watch', `Marge de ${pct(rate)}, au-dessus des ${pct(high)} habituels`,
        `C'est possible, mais un financeur le vérifiera. Assurez-vous que tous les coûts directs sont bien saisis : sous-traitance, livraison, commissions de paiement, pertes.`, 'offre')
    }
  }

  // ── Masse salariale ────────────────────────────────────────────────────
  // Les ressources d'une association ne se limitent pas à ses ventes : les
  // subventions financent l'essentiel de l'emploi.
  const resources = sector.resourcesIncludeGrants ? p.revenue[yy] + p.grants[yy] : p.revenue[yy]
  if (b.payrollRatio && resources > 0) {
    const ratio = p.payroll[yy] / resources
    const [, high] = b.payrollRatio
    if (ratio > high) {
      push('bad', `La masse salariale pèse ${pct(ratio, 0)} des ressources`,
        `Le métier tient d'ordinaire sous ${pct(high, 0)}. À ce niveau, chaque euro supplémentaire finance d'abord la structure. Deux issues : augmenter les ressources, ou décaler un recrutement.`, 'equipe')
    }
  }

  // ── Taux de charges des professions libérales ──────────────────────────
  // Chez un praticien libéral, la rémunération est le résultat : ce qui se
  // compare, ce sont les charges de structure rapportées aux honoraires.
  if (b.overheadRatio && p.revenue[yy] > 0) {
    const ownDraw = sector.ownerIsProfit
      ? (scenario.team || []).filter((m) => m.contractType === 'tns')
          .reduce((a, m) => a + (Number(m.monthlyGross) || 0) * 12, 0)
      : 0
    const overhead = Math.max(0, p.payroll[yy] - ownDraw) + p.external[yy] + p.duties[yy] + p.amortisation[yy]
    const ratio = overhead / p.revenue[yy]
    const [low, high] = b.overheadRatio
    if (ratio > high) {
      push('bad', `Vos charges absorbent ${pct(ratio, 0)} des honoraires`,
        `Un cabinet comparable tient entre ${pct(low, 0)} et ${pct(high, 0)}. Ce qui dépasse sort directement de votre revenu : à ce niveau, ${euro((ratio - high) * p.revenue[yy])} par an vous échappent.`, 'charges')
    } else if (ratio < low * 0.7) {
      push('info', `Charges à ${pct(ratio, 0)} des honoraires, sous les ${pct(low, 0)} habituels`,
        `Vérifiez que rien ne manque : cotisations ordinales, assurance responsabilité civile professionnelle, logiciel métier, entretien du matériel et remplacement des consommables.`, 'charges')
    }
  }

  // ── Loyer ──────────────────────────────────────────────────────────────
  if (b.rentRatio && p.revenue[yy] > 0) {
    const rent = (scenario.opex || []).filter((o) => /loyer|local|bureau|cabinet/i.test(o.label))
      .reduce((a, o) => a + (Number(o.monthlyAmount) || 0) * 12, 0)
    if (rent > 0) {
      const ratio = rent / p.revenue[yy]
      const [, high] = b.rentRatio
      if (ratio > high) {
        push('watch', `Le loyer représente ${pct(ratio, 0)} du chiffre d'affaires`,
          `Au-delà de ${pct(high, 0)}, l'emplacement devient difficile à rentabiliser : il se paie les mois creux comme les mois pleins. Soit le volume doit augmenter, soit la surface est trop grande.`, 'charges')
      }
    }
  }

  // ── Attrition ──────────────────────────────────────────────────────────
  if (b.churn) {
    const a = (scenario.activities || []).find((x) => (Number(x.recurringPrice) || 0) > 0)
    if (a) {
      const churn = Number(a.churnMonthly) || 0
      const [, high] = b.churn
      if (churn > high) {
        const annual = 1 - Math.pow(1 - churn, 12)
        push('bad', `${pct(churn, 1)} d'attrition par mois, soit ${pct(annual, 0)} par an`,
          `Vous renouvelez la moitié de votre base tous les ${Math.round(Math.log(0.5) / Math.log(1 - churn))} mois. Tant que ce chiffre n'est pas maîtrisé, augmenter l'acquisition revient à remplir une baignoire percée.`, 'offre')
      }
    }
  }

  // ── LTV / CAC ──────────────────────────────────────────────────────────
  if (b.ltvCac && k.ltvCacRatio !== null) {
    const [low] = b.ltvCac
    if (k.ltvCacRatio < low) {
      push('bad', `Un client rapporte ${num(k.ltvCacRatio, 1)} fois son coût, contre ${num(low, 1)} attendu`,
        `Dans ce métier, l'acquisition n'est tenable qu'au-delà de ${num(low, 1)}. Travaillez la conversion ou la rétention avant d'augmenter les budgets : dépenser plus à ce ratio accélère les pertes.`, 'marketing')
    }
  }

  // ── Stock ──────────────────────────────────────────────────────────────
  if (b.stockDays) {
    const days = Number(scenario.assumptions?.stockDays) || 0
    const [, high] = b.stockDays
    if (days > high) {
      push('watch', `${num(days)} jours de stock immobilisés`,
        `Au-delà de ${num(high)} jours, la trésorerie dort en entrepôt et le risque d'invendus grimpe. Le pic de besoin en fonds de roulement atteint ${euro(k.peakBfr)}.`, 'reglages')
    }
  }

  // ── Rémunération du dirigeant ──────────────────────────────────────────
  const founderPay = (scenario.team || [])[0]
  if (founderPay && (Number(founderPay.monthlyGross) || 0) === 0) {
    push('watch', 'Vous ne vous versez rien',
      "Un prévisionnel sans rémunération du dirigeant donne une rentabilité flatteuse et fausse. Si vous ne vous payez pas la première année, dites-le explicitement — mais chiffrez ce dont vous avez besoin pour vivre.", 'equipe')
  }

  // ── Saisonnalité ───────────────────────────────────────────────────────
  if (['restaurant', 'fleuriste', 'commerce', 'coiffeur'].includes(scenario.meta?.sectorKey)) {
    const a = (scenario.activities || [])[0]
    if (a && a.volumes?.mode !== 'manual' && !a.volumes?.seasonality) {
      push('info', 'Votre activité est saisonnière, votre projection ne l\'est pas',
        "Une courbe régulière lisse précisément les mois creux, ceux où la trésorerie casse. Passez en saisie mois par mois dans l'onglet Offre pour refléter les creux et les pics.", 'offre')
    }
  }

  return out
}

/** Bloc d'alertes, à poser en tête de tableau de bord. */
export function nudgePanel(list, navigate) {
  if (!list.length) return null
  const order = { bad: 0, watch: 1, info: 2 }
  const sorted = [...list].sort((a, b) => order[a.tone] - order[b.tone])
  return h('section', { class: 'nudges' },
    h('div', { class: 'nudges-head' },
      h('span', { class: 'eyebrow' }, `Ce que votre métier dit de vos chiffres`),
      h('span', { class: 'chip chip-quiet' }, `${sorted.length}`),
    ),
    ...sorted.slice(0, 4).map((n) => h('div', { class: `nudge nudge-${n.tone}` },
      h('div', { class: 'nudge-title' }, n.title),
      h('p', { class: 'nudge-body' }, n.body),
      n.page && h('button', { class: 'btn btn-sm btn-quiet', onClick: () => navigate(`#/${n.page}`) }, 'Y aller'),
    )),
  )
}

/** Encart des pièges du métier, purement pédagogique. */
export function sectorTraps(scenario) {
  const sector = getSector(scenario.meta?.sectorKey)
  if (!sector?.traps?.length) return null
  return h('section', { class: 'panel' },
    h('header', { class: 'panel-head' },
      h('h2', {}, `Les pièges du métier`),
      h('p', { class: 'panel-sub' }, `Ce qui fait échouer un ${sector.label.toLowerCase()}, indépendamment de vos chiffres.`),
    ),
    h('div', { class: 'traps' },
      ...sector.traps.map((t, i) => h('div', { class: 'trap' },
        h('span', { class: 'trap-index num' }, String(i + 1).padStart(2, '0')),
        h('div', {},
          h('div', { class: 'trap-title' }, t.title),
          h('p', { class: 'trap-body' }, t.body),
        ),
      )),
    ),
  )
}

/** Rappel du régime fiscal et social propre au métier. */
export function sectorRegime(scenario) {
  const sector = getSector(scenario.meta?.sectorKey)
  if (!sector) return null
  return h('section', { class: 'panel' },
    h('header', { class: 'panel-head' }, h('h2', {}, 'Votre cadre réglementaire')),
    h('div', { class: 'regime' },
      h('div', { class: 'regime-row' },
        h('span', { class: 'eyebrow' }, 'TVA'),
        h('div', {}, h('strong', {}, sector.vat.label), h('p', { class: 'regime-note' }, sector.vat.note)),
      ),
      h('div', { class: 'regime-row' },
        h('span', { class: 'eyebrow' }, 'Statut'),
        h('div', {},
          h('strong', {}, `${sector.legal.forms.join(', ')} — ${sector.legal.regime}`),
          h('p', { class: 'regime-note' }, sector.legal.note),
        ),
      ),
    ),
  )
}
