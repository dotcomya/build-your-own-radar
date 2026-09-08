/**
 * Tableau de bord, décliné par métier.
 *
 * Chaque persona voit d'abord la question dont il répond, puis ses
 * indicateurs, puis ses leviers. Bouger un levier recalcule le modèle entier
 * pendant le geste : les indicateurs changent sous les doigts, et le rail
 * d'impact mesure le chemin parcouru depuis le repère.
 */

import { h, euro, pct, num, helpButton, monthLabel, yearLabel } from '../dom.js'
import { barChart, areaChart, donut, stackedBar, PALETTE, YEAR_CATEGORIES, STATUS } from '../charts.js'
import { getPersona, activeLevers, METRICS } from '../personas.js'
import { leverPanel, metricBoard } from '../levers.js'
import { referenceYear } from '../impact.js'
import { nudges, nudgePanel, sectorTraps, sectorRegime } from '../nudges.js'
import { getSector, vocabulary } from '../../state/sectors.js'
import store from '../../state/store.js'

export function renderDashboard(navigate, refresh) {
  const r = store.result
  const s = store.scenario
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun résultat.'))

  const persona = getPersona(store.persona)
  const level = store.level
  const y = referenceYear(r)
  const sector = getSector(s.meta.sectorKey)
  const board = metricBoard(persona, r)
  const levers = activeLevers(persona, s)
  const advice = nudges(s, r)

  // Pendant qu'un curseur bouge, on réécrit les valeurs en place plutôt que de
  // redessiner : le geste ne doit jamais être interrompu.
  const live = (provisional) => board.updateWith(provisional)

  return h('div', { class: 'content' },
    s.meta.isDemo && demoBanner(navigate, refresh),

    h('section', { class: 'persona-banner' },
      h('div', { class: 'eyebrow', style: { color: 'var(--ink-4)', marginBottom: '7px' } },
        [sector?.label, persona.label, yearLabel(y)].filter(Boolean).join(' · ')),
      h('div', { class: 'persona-question' }, persona.question),
      h('p', { class: 'persona-answer' }, verdictFor(persona, r, y).headline),
    ),

    board,

    levers.length > 0 && h('div', { class: 'grid grid-2', style: { marginTop: '18px', alignItems: 'start' } },
      leverPanel(levers, { onLive: live, onDone: refresh }),
      verdictPanel(persona, r, y, navigate),
    ),

    issuesPanel(navigate),

    advice.length > 0 && h('div', { class: 'mt' }, nudgePanel(advice, navigate)),

    h('div', { class: 'grid grid-2 mt' }, ...personaCharts(persona, r, level)),

    sector && h('div', { class: 'grid grid-2 mt', style: { alignItems: 'start' } },
      sectorTraps(s),
      sectorRegime(s),
    ),

    level !== 'easy' && r.revenue.campaigns.length > 0 && ['cmo', 'founder', 'consultant'].includes(store.persona) && marketingPanel(r),

    h('section', { class: 'panel mt' },
      h('div', { class: 'card-head' },
        h('h2', {}, 'Compte de résultat'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-sm btn-quiet', onClick: () => navigate('#/resultats') }, 'Tout voir'),
      ),
      h('div', { class: 'table-wrap' }, summaryTable(r, level)),
    ),
  )
}

/* ────────────────────────────── Verdicts ─────────────────────────────── */

/**
 * L'outil prend position. Un prévisionnel qui ne dit rien ne sert à rien :
 * chaque persona reçoit une phrase qui tranche, puis ce qui la fonde.
 */
export function verdictFor(persona, r, y) {
  const k = r.kpis, p = r.pnl
  switch (persona.code) {
    case 'CFO': {
      // Un BFR négatif n'est pas un besoin : les clients financent le cycle.
      // Le dire, plutôt que d'annoncer « un besoin de 0 € à financer ».
      const bfrNote = k.peakBfr > 0
        ? `Le besoin en fonds de roulement culmine à ${euro(k.peakBfr)} : ce montant reste immobilisé en permanence dans le cycle et se couvre par des ressources stables, pas par du découvert.`
        : `Votre cycle dégage des ressources au lieu d'en consommer : encaissant avant de payer, vos clients financent l'exploitation. C'est un atout, à condition que les conditions de paiement tiennent quand vous grandirez.`
      if (k.fundingNeed > 0) return {
        tone: 'bad',
        headline: `Il manque ${euro(k.fundingNeed)} en ${monthLabel(k.cashLow.month, r.startDate)}.`,
        body: `Une exploitation rentable ne paie pas les salaires du mois où la caisse est vide. Trois leviers, du plus rapide au plus lent : l'acompte client, le délai fournisseur, le décalage des embauches. ${bfrNote}`,
      }
      return {
        tone: 'good',
        headline: `La trésorerie tient, au plus bas à ${euro(k.cashLow.value)}.`,
        body: `Le solde ne passe jamais sous zéro sur l'horizon modélisé. ${bfrNote}`,
      }
    }
    case 'CMO': {
      if (!k.ltvCacRatio) return {
        tone: 'watch',
        headline: "Aucune acquisition payante n'est modélisée.",
        body: "Sans campagne, la croissance repose entièrement sur la courbe saisie dans l'offre — une hypothèse que personne ne pourra challenger. Branchez un budget sur un entonnoir pour rendre l'acquisition discutable.",
      }
      if (k.ltvCacRatio < 1) return {
        tone: 'bad',
        headline: `Chaque client coûte ${euro(k.cac)} et en rapporte ${euro(k.ltv)}.`,
        body: `Vous perdez de l'argent à chaque acquisition : augmenter le budget aggraverait mécaniquement les pertes. Avant de dépenser plus, travaillez la conversion ou le prix — les deux améliorent le rapport sans coûter un euro de média.`,
      }
      if (k.ltvCacRatio < 3) return {
        tone: 'watch',
        headline: `Un client rapporte ${num(k.ltvCacRatio, 1)} fois ce qu'il coûte.`,
        body: `L'acquisition est rentable mais le retour est lent. Le seuil communément retenu est de 3. Gagner dix points de conversion vaut mieux que doubler le budget : c'est le même chiffre d'affaires pour moitié moins de média.`,
      }
      return {
        tone: 'good',
        headline: `Un client rapporte ${num(k.ltvCacRatio, 1)} fois ce qu'il coûte.`,
        body: `Au-dessus du seuil de 3, l'acquisition finance sa propre croissance. La question devient : jusqu'où pouvez-vous pousser le budget avant que le coût par client ne se dégrade ?`,
      }
    }
    case 'CHRO': {
      const ratio = k.payrollRatio[y]
      if (ratio > 0.6) return {
        tone: 'bad',
        headline: `La masse salariale absorbe ${pct(ratio, 0)} du chiffre d'affaires.`,
        body: `Au-delà de 60 %, la structure devient difficile à financer sans levée. Coût employeur : ${euro(p.payroll[y])} en ${yearLabel(y).toLowerCase()}, pour un point mort à ${k.breakEven[y] ? euro(k.breakEven[y]) : '—'}. Décaler une embauche de trois mois libère souvent tout le besoin de financement.`,
      }
      return {
        tone: 'good',
        headline: `L'équipe pèse ${pct(ratio, 0)} du chiffre d'affaires.`,
        body: `Coût employeur de ${euro(p.payroll[y])} en ${yearLabel(y).toLowerCase()} pour ${num(r.payroll.headcount[Math.min(59, y * 12 + 11)])} personnes. Rappel utile en arbitrage : entre le brut affiché et le coût réel, il y a ${pct(r.payroll.gross[11] > 0 ? r.payroll.employerCharges[11] / r.payroll.gross[11] : 0, 0)} d'écart.`,
      }
    }
    case 'CPO': {
      const rate = k.marginRate[y]
      if (rate <= 0) return {
        tone: 'bad',
        headline: 'Vous vendez à perte.',
        body: "Le coût de revient dépasse le prix de vente : chaque unité supplémentaire creuse le résultat, et aucun point mort ne peut être calculé. Rien d'autre ne compte tant que ce n'est pas corrigé.",
      }
      if (rate < 0.3) return {
        tone: 'watch',
        headline: `Chaque euro vendu n'en laisse que ${euro(rate)}.`,
        body: `Avec ${pct(rate)} de marge, il faut ${euro(k.breakEven[y] || 0)} de chiffre d'affaires pour couvrir la structure. Un modèle à faible marge est viable, mais il exige un volume que le plan doit démontrer.`,
      }
      return {
        tone: 'good',
        headline: `Chaque euro vendu en laisse ${euro(rate)}.`,
        body: `Une marge de ${pct(rate)} laisse de la place pour financer la structure et l'acquisition. Le point mort s'établit à ${euro(k.breakEven[y] || 0)} : chaque vente au-delà tombe presque entière en résultat.`,
      }
    }
    default: {
      // Fondateur et conseil : le diagnostic d'ensemble, sans complaisance.
      if (k.marginRate[y] <= 0) return {
        tone: 'bad',
        headline: 'Ce modèle ne tient pas.',
        body: "La marge sur coûts variables est nulle ou négative : vendre davantage aggrave la perte. Aucun point mort n'existe. Reprenez le prix ou le coût de revient avant toute autre chose.",
      }
      if (k.fundingNeed > 0 && k.firstProfitableYear === null) return {
        tone: 'bad',
        headline: `Pas de rentabilité en cinq ans, et ${euro(k.fundingNeed)} à trouver.`,
        body: `Le modèle consomme sans jamais basculer. Soit les volumes sont sous-estimés, soit la structure de coûts est trop lourde pour ce marché. En l'état, le dossier ne passera pas devant un financeur.`,
      }
      if (k.fundingNeed > 0) return {
        tone: 'watch',
        headline: `Rentable dès l'année ${k.firstProfitableYear + 1}, à condition de tenir jusque-là.`,
        body: `Le modèle bascule, mais la trésorerie descend à ${euro(k.cashLow.value)} en ${monthLabel(k.cashLow.month, r.startDate)} : il faut ${euro(k.fundingNeed)} pour franchir ce creux. C'est la seule question qui compte avant le premier euro de chiffre d'affaires.`,
      }
      if (k.firstProfitableYear === null) return {
        tone: 'watch',
        headline: "La trésorerie tient, la rentabilité non.",
        body: `Vous ne manquerez pas d'argent, mais aucun exercice n'est bénéficiaire sur l'horizon. Une entreprise financée qui ne gagne pas d'argent reste une entreprise qui ne gagne pas d'argent.`,
      }
      return {
        tone: 'good',
        headline: `Rentable dès l'année ${k.firstProfitableYear + 1}, sans financement complémentaire.`,
        body: `${euro(p.revenue[y])} de chiffre d'affaires en ${yearLabel(y).toLowerCase()}, ${euro(p.ebitda[y])} d'EBITDA, point mort à ${euro(k.breakEven[y] || 0)}. Le modèle se finance seul — vérifiez maintenant que les volumes projetés sont défendables.`,
      }
    }
  }
}

function verdictPanel(persona, r, y, navigate) {
  const v = verdictFor(persona, r, y)
  return h('section', { class: `verdict ${v.tone}` },
    h('div', { class: 'eyebrow', style: { color: 'var(--ink-4)', marginBottom: '8px' } }, 'Lecture'),
    h('div', { class: 'verdict-line' }, v.headline),
    h('p', { class: 'verdict-body' }, v.body),
    h('div', { class: 'row-wrap', style: { marginTop: '14px' } },
      ...suggestedActions(persona, r).map(([label, route]) =>
        h('button', { class: 'btn btn-sm btn-quiet', onClick: () => navigate(route) }, label)),
    ),
  )
}

function suggestedActions(persona, r) {
  const k = r.kpis
  const actions = []
  if (k.fundingNeed > 0) actions.push(['Financement', '#/financement'])
  if (k.marginRate[2] < 0.3) actions.push(["Prix et coûts", '#/offre'])
  if (persona.code === 'CMO' || (k.ltvCacRatio && k.ltvCacRatio < 3)) actions.push(['Campagnes', '#/marketing'])
  if (persona.code === 'CHRO' || k.payrollRatio[2] > 0.5) actions.push(['Équipe', '#/equipe'])
  actions.push(['États financiers', '#/resultats'])
  return actions.slice(0, 3)
}

/* ────────────────────────────── Graphiques ───────────────────────────── */

function personaCharts(persona, r, level) {
  const k = r.kpis, p = r.pnl
  const trajectory = panel("Chiffre d'affaires et résultat", 'Cinq exercices',
    barChart({
      categories: YEAR_CATEGORIES,
      series: [
        { label: "Chiffre d'affaires", values: p.revenue, color: PALETTE[0] },
        { label: 'EBITDA', values: p.ebitda, color: PALETTE[2] },
        { label: 'Résultat net', values: p.netResult, color: PALETTE[5] },
      ],
      line: k.breakEven.some((v) => v) ? { label: 'Point mort', values: k.breakEven.map((v) => v || 0), color: STATUS.loss, dashed: true } : null,
    }))

  const cash = panel('Trésorerie', 'Solde de fin de mois, 60 mois',
    areaChart({ values: r.cash.balance, startDate: r.startDate, color: k.fundingNeed > 0 ? STATUS.warn : STATUS.gain }))

  const costs = panel('Structure des coûts', 'Par exercice',
    stackedBar({
      categories: YEAR_CATEGORIES,
      series: [
        { label: 'Achats variables', values: p.variableCost, color: PALETTE[5] },
        { label: 'Charges externes', values: p.external, color: PALETTE[1] },
        { label: 'Personnel', values: p.payroll, color: PALETTE[0] },
        { label: 'Impôts et taxes', values: p.duties, color: PALETTE[4] },
        { label: 'Amortissements', values: p.amortisation, color: PALETTE[2] },
      ],
    }))

  const mix = panel("Répartition du chiffre d'affaires", 'Cumul sur cinq ans',
    donut({ items: r.revenue.perActivity.map((a, i) => ({ label: a.name, value: a.total.reduce((x, z) => x + z, 0), color: PALETTE[i % PALETTE.length] })) }))

  const payroll = panel('Masse salariale', 'Brut et cotisations patronales',
    barChart({
      categories: YEAR_CATEGORIES,
      series: [
        { label: 'Salaires bruts', values: yearly(r.payroll.gross), color: PALETTE[0] },
        { label: 'Cotisations patronales', values: yearly(r.payroll.employerCharges), color: PALETTE[1] },
      ],
    }))

  switch (persona.code) {
    case 'CFO': return [cash, panel(
      'Besoin en fonds de roulement',
      r.kpis.peakBfr > 0 ? 'Immobilisé dans le cycle' : 'Ressource dégagée par le cycle',
      areaChart({ values: r.bfr.total, startDate: r.startDate, color: r.kpis.peakBfr > 0 ? PALETTE[1] : STATUS.gain, markZero: true }),
      h('p', { class: 'tiny muted', style: { margin: '10px 0 0' } },
        r.kpis.peakBfr > 0
          ? "Au-dessus de zéro, l'argent est immobilisé : créances clients et stocks financés en attendant l'encaissement."
          : "Sous zéro, le cycle dégage de la trésorerie : vous encaissez avant de payer vos fournisseurs."),
    )]
    case 'CMO': return [trajectory, mix]
    case 'CHRO': return [payroll, costs]
    case 'CPO': return [trajectory, mix]
    default: return [trajectory, cash]
  }
}

function panel(title, subtitle, ...body) {
  return h('section', { class: 'panel' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, title), subtitle && h('div', { class: 'tiny muted' }, subtitle))),
    h('div', { class: 'panel-body' }, ...body),
  )
}

/* ───────────────────────────── Compléments ───────────────────────────── */

function demoBanner(navigate, refresh) {
  return h('div', { class: 'note', style: { marginBottom: '18px' } },
    h('div', { class: 'row-wrap', style: { gap: '12px' } },
      h('div', { class: 'spacer', style: { minWidth: '240px' } },
        h('div', { class: 'note-title' }, 'Vous regardez un exemple'),
        h('div', {}, "Les chiffres de ce scénario sont fictifs : ils servent à montrer comment tout s'articule. Modifiez-les librement, ou repartez d'une page blanche."),
      ),
      h('button', { class: 'btn btn-primary', onClick: () => { store.adoptDemo(); refresh() } }, 'Partir de cet exemple'),
      h('button', { class: 'btn', onClick: () => navigate('#/demarrer') }, 'Créer le mien'),
    ),
  )
}

function issuesPanel(navigate) {
  const issues = store.issues.filter((i) => i.level !== 'info')
  if (!issues.length) return null
  const errors = issues.filter((i) => i.level === 'error')
  return h('div', { class: `note ${errors.length ? 'danger' : 'warn'} mt` },
    h('div', { class: 'note-title' }, errors.length ? `${errors.length} point${errors.length > 1 ? 's' : ''} à corriger` : `${issues.length} point${issues.length > 1 ? 's' : ''} de vigilance`),
    h('div', { class: 'stack', style: { gap: '7px', marginTop: '7px' } },
      ...issues.slice(0, 4).map((i) => h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '8px' } },
        h('div', { class: 'spacer' },
          h('div', { style: { fontWeight: '500' } }, i.message),
          i.hint && h('div', { class: 'tiny muted' }, i.hint),
        ),
        i.page && h('button', { class: 'btn btn-sm btn-quiet', onClick: () => navigate(`#/${i.page}`) }, 'Corriger'),
      )),
    ),
  )
}

function marketingPanel(r) {
  const k = r.kpis
  const totalClients = r.revenue.campaigns.reduce((a, x) => a + x.totalClients, 0)
  return h('section', { class: 'panel mt' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Acquisition client'), h('span', { class: 'spacer' }),
      k.ltvCacRatio && h('span', { class: `chip ${k.ltvCacRatio >= 3 ? 'chip-pos' : k.ltvCacRatio >= 1 ? 'chip-warn' : 'chip-neg'}` }, `LTV/CAC ${num(k.ltvCacRatio, 1)}×`)),
    h('div', { class: 'table-wrap' },
      h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Campagne'), h('th', {}, 'Budget'), h('th', {}, 'Clients'), h('th', {}, 'CAC'), h('th', {}, 'Part'))),
        h('tbody', {},
          ...r.revenue.campaigns.map((c) => h('tr', {},
            h('td', {}, c.name),
            h('td', { class: 'num' }, euro(c.totalSpend)),
            h('td', { class: 'num' }, num(c.totalClients)),
            h('td', { class: 'num' }, c.cac ? euro(c.cac) : '—'),
            h('td', { class: 'num pct' }, totalClients > 0 ? pct(c.totalClients / totalClients, 0) : '—'),
          )),
          h('tr', { class: 'total' },
            h('td', {}, 'Total'),
            h('td', { class: 'num' }, euro(r.revenue.campaigns.reduce((a, c) => a + c.totalSpend, 0))),
            h('td', { class: 'num' }, num(totalClients)),
            h('td', { class: 'num' }, k.cac ? euro(k.cac) : '—'),
            h('td', {}, ''),
          ),
        ),
      ),
    ),
  )
}

function summaryTable(r, level) {
  const p = r.pnl
  const rows = [
    ["Chiffre d'affaires", p.revenue, ''],
    ['Achats et charges variables', p.variableCost.map((v) => -v)],
    ['Marge brute', p.grossMargin, 'highlight', 'margeBrute'],
    ['Charges externes', p.external.map((v) => -v)],
    ['Charges de personnel', p.payroll.map((v) => -v)],
    ['Impôts et taxes', p.duties.map((v) => -v)],
    ...(p.grants.some((v) => v) ? [["Subventions d'exploitation", p.grants]] : []),
    ['EBITDA', p.ebitda, 'highlight', 'ebitda'],
    ['Amortissements', p.amortisation.map((v) => -v)],
    ["Résultat d'exploitation", p.ebit, '', 'ebit'],
    ...(level !== 'easy' ? [['Charges financières', p.interest.map((v) => -v)]] : []),
    ...(level === 'advanced' && p.credits.some((v) => v) ? [["Crédits d'impôt", p.credits, '', 'cir']] : []),
    ['Impôt sur les sociétés', p.corporateTax.map((v) => -v), '', 'is'],
    ['Résultat net', p.netResult, 'total'],
  ]
  return h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, yearLabel(i))))),
    h('tbody', {},
      ...rows.map(([label, values, cls, glossaryKey]) => h('tr', { class: cls || '' },
        h('td', {}, h('span', { class: 'rowlabel' }, label, glossaryKey && helpButton(glossaryKey))),
        ...values.map((v) => h('td', { class: `num ${v < 0 ? 'muted' : ''}` }, euro(v))),
      )),
    ),
  )
}

const yearly = (arr) => Array.from({ length: 5 }, (_, y) => arr.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0))

/** Année de référence, réexportée pour les autres pages. */
export const pickYear = (pnl) => {
  const i = pnl.netResult.findIndex((v) => v > 0)
  return i >= 0 ? i : 2
}
