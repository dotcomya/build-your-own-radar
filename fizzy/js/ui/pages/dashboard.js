/**
 * Tableau de bord.
 *
 * Un tableau de bord dirige l'attention ; il ne déverse pas. L'ordre de
 * lecture est donc imposé : d'abord un verdict, ensuite l'histoire des cinq
 * ans, puis ce qu'il faut faire — chiffré. Le détail vient après, replié,
 * pour qui veut vérifier.
 */

import { h, euro, pct, num, helpButton, narrow } from '../dom.js'
import { barChart, areaChart, donut, stackedBar, PALETTE, YEAR_CATEGORIES, STATUS } from '../charts.js'
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
  const y = referenceYear(r)
  const health = assess(r, s)

  return h('div', { class: 'content content-wide' },
    s.meta.isDemo && demoBanner(navigate, refresh),

    verdictHero(health, r, s, y, persona, sector),

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

    actionsPanel(r, s, navigate, refresh),

    sector && gaugePanel(r, s, sector, y),

    nudgesSection(s, r, navigate),

    detailDisclosure(persona, r, s, y, sector, navigate, refresh),
  )
}

/* ───────────────────────────── Diagnostic ─────────────────────────────── */

/**
 * État de santé en un mot, avec ce qui le motive.
 * L'ordre des tests est celui de la gravité : on meurt de trésorerie avant de
 * mourir de rentabilité.
 */
function verdictHero(health, r, s, y, persona, sector) {
  return h('section', { class: `hero hero-${health.tone}` },
    h('div', { class: 'hero-main' },
      h('div', { class: 'hero-eyebrow' },
        [sector?.label, s.meta.company, persona.label].filter(Boolean).join(' · ')),
      h('h1', { class: 'hero-word' }, health.word),
      h('p', { class: 'hero-line' }, health.line),
      h('p', { class: 'hero-body' }, health.body),
    ),
    h('div', { class: 'hero-figure' },
      h('div', { class: 'hero-figure-label' }, health.figure.label),
      h('div', { class: 'hero-figure-value num' }, health.figure.value),
      health.figure.link && h('a', { class: 'hero-figure-link', href: health.figure.link }, 'Voir le détail'),
    ),
  )
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
 * Tout ce qui précède répond à « que dois-je faire ». Ce bloc répond à
 * « montrez-moi les chiffres » — pour qui veut vérifier, et seulement alors.
 */
function detailDisclosure(persona, r, s, y, sector, navigate, refresh) {
  const board = metricBoard(persona, r)
  const levers = activeLevers(persona, s)
  const open = detailDisclosure.open ?? false

  const details = h('details', { class: 'detail-block', open: open || null },
    h('summary', { class: 'detail-summary' },
      h('span', { class: 'detail-title' }, 'Voir les chiffres'),
      h('span', { class: 'detail-hint' }, `${persona.metrics.length} indicateurs, vos leviers, la structure des coûts`),
    ),
    h('div', { class: 'detail-body' },
      board,
      levers.length > 0 && h('div', { class: 'mt' },
        leverPanel(levers, { onLive: (provisional) => board.updateWith(provisional), onDone: refresh })),
      h('div', { class: 'grid grid-2 mt' }, ...personaCharts(persona, r)),
      sector && h('div', { class: 'grid grid-2 mt', style: { alignItems: 'start' } },
        sectorTraps(s), sectorRegime(s)),
    ),
  )
  details.addEventListener('toggle', () => { detailDisclosure.open = details.open })
  return details
}

function personaCharts(persona, r) {
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

  const bfr = panel('Besoin en fonds de roulement', r.kpis.peakBfr > 0 ? 'Immobilisé dans le cycle' : 'Ressource dégagée par le cycle',
    areaChart({ values: r.bfr.total, startDate: r.startDate, color: r.kpis.peakBfr > 0 ? PALETTE[1] : STATUS.gain }))

  switch (persona.code) {
    case 'CFO': return [bfr, costs]
    case 'CMO': return [trajectory, mix]
    case 'CHRO': return [payroll, costs]
    case 'CPO': return [trajectory, mix]
    default: return [trajectory, costs]
  }
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
