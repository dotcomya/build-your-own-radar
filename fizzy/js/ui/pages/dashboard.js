/**
 * Tableau de bord.
 *
 * Un tableau de bord dirige l'attention ; il ne déverse pas. L'ordre de
 * lecture est donc imposé : d'abord un verdict, ensuite l'histoire des cinq
 * ans, puis ce qu'il faut faire — chiffré. Le détail vient après, replié,
 * pour qui veut vérifier.
 */

import { h, euro, pct, num, helpButton, narrow, monthLabel, yearLabel, levelBlock } from '../dom.js'
import { barChart, areaChart, donut, stackedBar, waterfall, sparkline, PALETTE, YEAR_CATEGORIES, STATUS } from '../charts.js'
import { getPersona, activeLevers, METRICS } from '../personas.js'
import { leverPanel, metricBoard } from '../levers.js'
import { referenceYear } from '../impact.js'
import { storyline, gauge } from '../story.js'
import { suggestActions, applyAction } from '../../engine/simulate.js'
import { nudges, nudgePanel, sectorTraps, sectorRegime } from '../nudges.js'
import { getSector } from '../../state/sectors.js'
import { verdict } from '../../engine/verdict.js'
import store from '../../state/store.js'

// Le jugement vient du moteur : l'écran et le PowerPoint exporté disent la
// même chose parce qu'ils lisent la même fonction.
export const assess = (r, s) => verdict(r, s)

export function renderDashboard(navigate, refresh) {
  const r = store.result
  const s = store.scenario
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun résultat.'))

  const persona = getPersona(store.persona)
  const sector = getSector(s.meta.sectorKey)
  const level = store.level
  const y = referenceYear(r)
  const health = assess(r, s)

  return h('div', { class: 'content content-wide' },
    s.meta.isDemo && demoBanner(navigate, refresh),

    boardHead(health, s, sector, y, navigate),

    keyFigures(r, s, y, navigate),

    h('section', { class: 'panel story-panel' },
      h('div', { class: 'card-head' },
        h('div', {},
          h('h2', {}, 'Les cinq ans qui viennent'),
          h('div', { class: 'tiny muted' }, 'Trésorerie mois par mois et moments qui comptent'),
        ),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-sm btn-quiet', onClick: () => navigate('#/resultats') }, 'Les comptes'),
      ),
      // La frise se dessine dans un cadre adapté à la largeur disponible :
      // rétrécir un dessin de bureau rendrait ses annotations illisibles.
      storyline(r, s, { compact: narrow() }),
    ),

    ...boardCharts(r, s, y, level, sector, navigate),

    sector && gaugePanel(r, s, sector, y),

    actionsPanel(r, s, navigate, refresh),

    nudgesSection(s, r, navigate),

    detailDisclosure(persona, r, s, y, sector, navigate, refresh),
  )
}

/* ────────────────────────── En-tête et verdict ────────────────────────── */

/**
 * Le nom du projet, et le verdict à côté.
 *
 * Le verdict occupait auparavant un bandeau sombre pleine largeur : il volait
 * la vedette aux chiffres alors qu'il n'en est que le résumé. Il tient
 * désormais dans une carte étroite, posée à droite du titre — une pastille de
 * couleur, un mot, une ligne. Le détail est à un clic, pas à l'écran.
 */
function boardHead(health, s, sector, y, navigate) {
  return h('header', { class: 'board-head' },
    h('div', { class: 'board-id' },
      h('div', { class: 'board-eyebrow' },
        [sector?.label, yearLabel(y)].filter(Boolean).join(' · ')),
      h('h1', { class: 'board-title' }, s.meta.company || 'Mon projet'),
    ),
    verdictCard(health, navigate),
  )
}

function verdictCard(health, navigate) {
  const detail = h('div', { class: 'verdict-body' }, health.body,
    health.figure && h('div', { class: 'verdict-figure' },
      h('span', {}, health.figure.label),
      h('strong', { class: 'num' }, health.figure.value),
    ),
  )
  const card = h('aside', { class: `verdict verdict-${health.tone}` },
    h('button', {
      class: 'verdict-head',
      title: 'Voir le raisonnement',
      onClick: () => { card.classList.toggle('open') },
    },
      h('span', { class: 'verdict-dot' }),
      h('span', { class: 'spacer' },
        h('span', { class: 'verdict-word' }, health.word),
        h('span', { class: 'verdict-line' }, health.line),
      ),
      h('span', { class: 'verdict-more' }, '›'),
    ),
    detail,
  )
  return card
}

/* ────────────────────────────── Les chiffres ──────────────────────────── */

/**
 * Les six chiffres qu'on vient chercher, chacun avec sa trajectoire.
 *
 * Un nombre seul ne dit pas s'il monte ou s'il tombe. Chaque tuile porte donc
 * sa courbe sur cinq ans : c'est la différence entre un tableau de chiffres et
 * un tableau de bord.
 */
function keyFigures(r, s, y, navigate) {
  const k = r.kpis, p = r.pnl
  const reached = k.breakEven[y] && p.revenue[y] >= k.breakEven[y]
  const figures = [
    { label: "Chiffre d'affaires", value: euro(p.revenue[y], { compact: true }), note: yearLabel(y),
      spark: p.revenue, go: 'offre' },
    { label: 'EBITDA', value: euro(p.ebitda[y], { compact: true }), note: `${pct(k.ebitdaMargin[y], 0)} du CA`,
      tone: p.ebitda[y] >= 0 ? 'pos' : 'neg', spark: p.ebitda, go: 'resultats', help: 'ebitda' },
    { label: 'Point mort', value: k.breakEven[y] ? euro(k.breakEven[y], { compact: true }) : '—',
      note: reached ? 'atteint' : 'non atteint',
      tone: reached ? 'pos' : 'warn', spark: k.breakEven.map((v) => v || 0), go: 'resultats', help: 'pointMort' },
    { label: 'Résultat net', value: euro(p.netResult[y], { compact: true }), note: `${pct(k.netMargin[y], 0)} du CA`,
      tone: p.netResult[y] >= 0 ? 'pos' : 'neg', spark: p.netResult, go: 'resultats' },
    { label: 'Trésorerie au plus bas', value: euro(k.cashLow.value, { compact: true }),
      note: monthLabel(k.cashLow.month, r.startDate), tone: k.cashLow.value < 0 ? 'neg' : 'pos',
      spark: r.cash.balance, go: 'financement' },
    { label: 'À financer', value: k.fundingNeed > 0 ? euro(k.fundingNeed, { compact: true }) : 'Rien',
      note: k.fundingNeed > 0 ? 'avant ' + monthLabel(k.cashLow.month, r.startDate) : 'caisse couverte',
      tone: k.fundingNeed > 0 ? 'warn' : 'pos', go: 'financement' },
  ]

  const ink = { pos: STATUS.gain, neg: STATUS.loss, warn: STATUS.warn }
  return h('section', { class: 'figures' },
    ...figures.map((f) => h('button', {
      class: `figure ${f.tone || ''}`, onClick: () => navigate(`#/${f.go}`),
    },
      h('span', { class: 'figure-label' }, f.label),
      h('span', { class: 'figure-value num' }, f.value),
      h('span', { class: 'figure-foot' },
        h('span', { class: 'figure-note' }, f.note),
        f.spark && f.spark.some((v) => v) && sparkline({ values: f.spark, width: 58, height: 20, color: ink[f.tone] || STATUS.signal }),
      ),
    )),
  )
}

/* ────────────────────── Le plan, en graphiques ───────────────────── */

/**
 * Tout ce qu'un prévisionnel raconte, en images.
 *
 * L'ordre suit une question par graphique : où part l'argent, comment le
 * compte évolue, ce qui coûte, d'où vient le chiffre d'affaires, ce que pèse
 * l'équipe, ce que le cycle immobilise. Le niveau de détail choisi décide
 * combien de ces questions sont posées — pas si elles le sont graphiquement.
 */
function boardCharts(r, s, y, level, sector, navigate) {
  const k = r.kpis, p = r.pnl
  const out = []

  out.push(panel(
    'Où part chaque euro',
    `De votre chiffre d'affaires à votre résultat net — ${yearLabel(y).toLowerCase()}`,
    waterfall({ items: moneyFlow(r, y) }),
    h('p', { class: 'chart-note' }, moneyFlowSentence(r, y)),
  ))

  const trajectory = panel("Chiffre d'affaires et résultat", 'Les cinq exercices',
    barChart({
      categories: YEAR_CATEGORIES,
      series: [
        { label: "Chiffre d'affaires", values: p.revenue, color: PALETTE[0] },
        { label: 'EBITDA', values: p.ebitda, color: PALETTE[2] },
        { label: 'Résultat net', values: p.netResult, color: PALETTE[5] },
      ],
      line: k.breakEven.some((v) => v)
        ? { label: 'Point mort', values: k.breakEven.map((v) => v || 0), color: STATUS.loss, dashed: true }
        : null,
    }))

  const costs = panel('Ce que coûte votre activité', 'Structure des charges, par exercice',
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
  out.push(pair(trajectory, costs))

  const activities = r.revenue.perActivity
    .map((a, i) => ({ label: a.name, value: a.total.reduce((x, z) => x + z, 0), color: PALETTE[i % PALETTE.length] }))
    .filter((a) => a.value > 0)
  // Un camembert à une part ne dit rien : il ne s'affiche qu'à partir de deux
  // sources de revenus.
  const mix = activities.length > 1
    ? panel("D'où vient le chiffre d'affaires", 'Cumul sur cinq ans', donut({ items: activities }))
    : null

  const payrollY = yearly(r.payroll.gross)
  const team = payrollY.some((v) => v > 0)
    ? panel('Ce que pèse votre équipe', 'Brut, cotisations patronales et avantages',
        barChart({
          categories: YEAR_CATEGORIES,
          series: [
            { label: 'Salaires bruts', values: payrollY, color: PALETTE[0] },
            { label: 'Cotisations patronales', values: yearly(r.payroll.employerCharges), color: PALETTE[1] },
            ...(r.payroll.benefits && r.payroll.benefits.some((v) => v > 0)
              ? [{ label: 'Avantages', values: yearly(r.payroll.benefits), color: PALETTE[4] }]
              : []),
          ],
        }))
    : null

  if (mix || team) out.push(pair(mix, team))

  if (level !== 'easy') {
    const bfr = panel('Ce que le cycle immobilise',
      k.peakBfr > 0 ? "Besoin en fonds de roulement — l'argent avancé aux clients et aux stocks" : 'Le cycle dégage de la ressource',
      areaChart({ values: r.bfr.total, startDate: r.startDate, color: k.peakBfr > 0 ? PALETTE[1] : STATUS.gain }))
    const cashPanel = panel('Combien de temps la caisse tient',
      Number.isFinite(k.runwayMonths) && k.runwayMonths !== null ? `${num(k.runwayMonths, 0)} mois au rythme de consommation actuel` : 'La caisse ne se vide pas',
      areaChart({ values: r.cash.balance, startDate: r.startDate, color: STATUS.signal }))
    out.push(levelBlock('intermediate', 'Ce que la profondeur intermédiaire ajoute', pair(bfr, cashPanel)))
  }

  return out
}

/** Deux graphiques côte à côte, un seul s'il n'y en a qu'un. */
function pair(a, b) {
  const cards = [a, b].filter(Boolean)
  if (cards.length === 0) return null
  return h('div', { class: 'board-pair' }, ...cards)
}

/**
 * La cascade du compte de résultat : chiffre d'affaires, ce qu'on en retire,
 * ce qu'il reste. Les paliers sont les soldes intermédiaires de gestion — ceux
 * qu'une banque lit en premier.
 */
function moneyFlow(r, y) {
  const p = r.pnl
  const items = [{ label: "Chiffre d'affaires", value: p.revenue[y], total: true }]
  if (p.grants[y]) items.push({ label: 'Subventions', value: p.grants[y] })
  if (p.variableCost[y]) items.push({ label: 'Achats', value: -p.variableCost[y] })
  if (p.external[y]) items.push({ label: 'Charges externes', value: -p.external[y] })
  if (p.duties[y]) items.push({ label: 'Impôts et taxes', value: -p.duties[y] })
  if (p.payroll[y]) items.push({ label: 'Personnel', value: -p.payroll[y] })
  items.push({ label: 'EBITDA', value: p.ebitda[y], total: true })
  if (p.amortisation[y]) items.push({ label: 'Amortis.', value: -p.amortisation[y] })
  if (p.interest[y]) items.push({ label: 'Frais fin.', value: -p.interest[y] })
  if (p.corporateTax[y]) items.push({ label: 'Impôt sociétés', value: -p.corporateTax[y] })
  if (p.credits[y]) items.push({ label: "Crédits impôt", value: p.credits[y] })
  items.push({ label: 'Résultat net', value: p.netResult[y], total: true })
  return items
}

/** Une phrase qui dit ce que le dessin montre, pour qui ne lit pas les dessins. */
function moneyFlowSentence(r, y) {
  const p = r.pnl
  const rev = p.revenue[y]
  if (rev <= 0) return "Aucun chiffre d'affaires sur cet exercice : renseignez vos ventes pour voir la cascade se remplir."
  const kept = p.netResult[y] / rev
  const biggest = [
    { label: 'les achats', v: p.variableCost[y] },
    { label: 'les charges externes', v: p.external[y] },
    { label: "l'équipe", v: p.payroll[y] },
  ].sort((a, b) => b.v - a.v)[0]
  if (biggest.v <= 0) return `Sur 100 € facturés, il vous en reste ${Math.round(kept * 100)} € après impôt.`
  return `Sur 100 € facturés, ${biggest.label} en prennent ${Math.round((biggest.v / rev) * 100)} € et il vous en reste ${Math.round(kept * 100)} € après impôt.`
}

/* ──────────────────────── Actions déjà chiffrées ──────────────────────── */

/**
 * Ce qu'il faut faire, et ce que ça rapporte.
 * Chaque proposition est obtenue en rejouant le modèle complet, pas estimée.
 */
function actionsPanel(r, s, navigate, refresh) {
  let suggestion
  try { suggestion = suggestActions(s, r) } catch { return null }
  if (!suggestion.best.length) return null

  const apply = (key, label) => {
    store.update((sc) => applyAction(sc, key), { label })
    refresh()
  }

  return h('section', { class: 'panel actions-panel' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, 'Ce qui changerait le plus'),
        h('div', { class: 'tiny muted' },
          suggestion.shortOfCash
            ? 'Classé par ce que cela libère en trésorerie'
            : "Classé par ce que cela ajoute à l'EBITDA"),
      ),
    ),
    h('div', { class: 'actions' },
      ...suggestion.best.map((a, i) => h('article', { class: 'action' },
        h('span', { class: 'action-rank num' }, String(i + 1)),
        h('div', { class: 'action-main' },
          h('h3', { class: 'action-label' }, a.label),
          a.detail && h('div', { class: 'action-detail num' }, a.detail),
          h('p', { class: 'action-why' }, a.rationale),
        ),
        h('div', { class: 'action-gains' },
          gainRow('EBITDA', a.delta.ebitda, true),
          a.delta.fundingNeed !== 0 && gainRow('Financement', a.delta.fundingNeed, false),
          a.delta.breakEven !== null && a.delta.breakEven !== 0 && gainRow('Point mort', a.delta.breakEven, false),
          a.delta.founderMonthly !== 0 && gainRow('Pour vous', a.delta.founderMonthly, true, '/mois'),
        ),
        h('button', { class: 'btn btn-sm', onClick: () => apply(a.key, a.label) }, 'Appliquer'),
      )),
    ),
    h('div', { class: 'panel-body', style: { paddingTop: '0' } },
      h('p', { class: 'tiny muted', style: { margin: 0 } },
        "Chaque estimation rejoue le modèle entier avec la modification. Appliquer reste réversible : la barre du bas mesure l'écart et l'annulation est disponible."),
    ),
  )
}

/** Une ligne de gain : le sens du bien dépend de l'indicateur. */
function gainRow(label, delta, higherIsBetter, suffix = '') {
  if (!Number.isFinite(delta) || Math.round(delta) === 0) return null
  const good = higherIsBetter ? delta > 0 : delta < 0
  return h('div', { class: `gain ${good ? 'gain-good' : 'gain-bad'}` },
    h('span', { class: 'gain-label' }, label),
    h('span', { class: 'gain-value num' }, `${delta > 0 ? '+' : ''}${euro(delta, { compact: Math.abs(delta) >= 100000 })}${suffix}`),
  )
}

/* ─────────────────────── Position dans le métier ──────────────────────── */

function gaugePanel(r, s, sector, y) {
  const b = sector.benchmarks || {}
  const k = r.kpis, p = r.pnl
  const gauges = []

  if (b.grossMargin && p.revenue[y] > 0) {
    gauges.push(gauge({ label: 'Marge brute', value: k.marginRate[y], range: b.grossMargin }))
  }
  if (b.payrollRatio && p.revenue[y] > 0) {
    const denom = sector.resourcesIncludeGrants ? p.revenue[y] + p.grants[y] : p.revenue[y]
    if (denom > 0) gauges.push(gauge({ label: 'Masse salariale', value: p.payroll[y] / denom, range: b.payrollRatio, invert: true }))
  }
  if (b.overheadRatio && p.revenue[y] > 0) {
    const ownDraw = sector.ownerIsProfit
      ? (s.team || []).filter((m) => m.contractType === 'tns').reduce((a, m) => a + (Number(m.monthlyGross) || 0) * 12, 0)
      : 0
    const overhead = Math.max(0, p.payroll[y] - ownDraw) + p.external[y] + p.duties[y] + p.amortisation[y]
    gauges.push(gauge({ label: 'Charges de structure', value: overhead / p.revenue[y], range: b.overheadRatio, invert: true }))
  }
  if (b.churn) {
    const a = (s.activities || []).find((x) => (Number(x.recurringPrice) || 0) > 0)
    if (a) gauges.push(gauge({ label: 'Attrition mensuelle', value: Number(a.churnMonthly) || 0, range: b.churn, invert: true, format: (v) => pct(v, 1) }))
  }
  if (b.ltvCac && k.ltvCacRatio !== null) {
    gauges.push(gauge({ label: 'LTV / CAC', value: k.ltvCacRatio, range: b.ltvCac, format: (v) => `${num(v, 1)}×` }))
  }
  if (b.rentRatio && p.revenue[y] > 0) {
    const rent = (s.opex || []).filter((o) => /loyer|local|bureau|cabinet|salle/i.test(o.label))
      .reduce((a, o) => a + (Number(o.monthlyAmount) || 0) * 12, 0)
    if (rent > 0) gauges.push(gauge({ label: 'Loyer', value: rent / p.revenue[y], range: b.rentRatio, invert: true }))
  }

  if (!gauges.length) return null
  return h('section', { class: 'panel' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, `Où vous situez-vous ?`),
        h('div', { class: 'tiny muted' }, `Comparé aux ordres de grandeur observés — ${sector.label.toLowerCase()}`),
      ),
    ),
    h('div', { class: 'gauges' }, ...gauges),
  )
}

function nudgesSection(s, r, navigate) {
  const advice = nudges(s, r)
  const issues = store.issues.filter((i) => i.level === 'error')
  if (!advice.length && !issues.length) return null
  return h('div', { class: 'stack' },
    issues.length > 0 && h('div', { class: 'note danger' },
      h('div', { class: 'note-title' }, `${issues.length} point${issues.length > 1 ? 's' : ''} à corriger`),
      h('div', { class: 'stack', style: { gap: '6px', marginTop: '6px' } },
        ...issues.slice(0, 3).map((i) => h('div', { class: 'row', style: { alignItems: 'flex-start' } },
          h('div', { class: 'spacer' },
            h('div', { style: { fontWeight: '500' } }, i.message),
            i.hint && h('div', { class: 'tiny muted' }, i.hint)),
          i.page && h('button', { class: 'btn btn-sm btn-quiet', onClick: () => navigate(`#/${i.page}`) }, 'Corriger'),
        )),
      ),
    ),
    advice.length > 0 && nudgePanel(advice, navigate),
  )
}

/* ────────────────────────────── Le détail ─────────────────────────────── */

/**
 * Les graphiques sont désormais à l'écran, plus dans un pli. Ne restent ici
 * que les indicateurs détaillés, les leviers à tirer et les pièges propres au
 * métier — utiles, mais qu'on ne consulte pas à chaque visite.
 */
function detailDisclosure(persona, r, s, y, sector, navigate, refresh) {
  const board = metricBoard(persona, r)
  const levers = activeLevers(persona, s)
  const open = detailDisclosure.open ?? false

  const details = h('details', { class: 'detail-block', open: open || null },
    h('summary', { class: 'detail-summary' },
      h('span', { class: 'detail-title' }, 'Aller plus loin'),
      h('span', { class: 'detail-hint' }, `${persona.metrics.length} indicateurs, vos leviers, les pièges du métier`),
    ),
    h('div', { class: 'detail-body' },
      board,
      levers.length > 0 && h('div', { class: 'mt' },
        leverPanel(levers, { onLive: (provisional) => board.updateWith(provisional), onDone: refresh })),
      sector && h('div', { class: 'grid grid-2 mt', style: { alignItems: 'start' } },
        sectorTraps(s), sectorRegime(s)),
    ),
  )
  details.addEventListener('toggle', () => { detailDisclosure.open = details.open })
  return details
}

function panel(title, subtitle, ...body) {
  return h('section', { class: 'panel' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, title), subtitle && h('div', { class: 'tiny muted' }, subtitle))),
    h('div', { class: 'panel-body' }, ...body),
  )
}

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

const yearly = (arr) => Array.from({ length: 5 }, (_, y) => arr.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0))

export const pickYear = (pnl) => {
  const i = pnl.netResult.findIndex((v) => v > 0)
  return i >= 0 ? i : 2
}
