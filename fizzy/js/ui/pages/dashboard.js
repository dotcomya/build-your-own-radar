/** Tableau de bord : la santé du projet en un écran. */

import { h, euro, pct, num, helpButton, monthLabel, yearLabel } from '../dom.js'
import { barChart, areaChart, donut, stackedBar, PALETTE, YEAR_CATEGORIES } from '../charts.js'
import store from '../../state/store.js'

export function renderDashboard(navigate) {
  const r = store.result
  const s = store.scenario
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun scénario chargé.'))
  const level = store.level
  const k = r.kpis
  const p = r.pnl

  return h('div', { class: 'content' },
    h('div', { class: 'page-head' },
      h('h1', {}, s.meta.name),
      h('p', {}, describe(r)),
    ),

    kpiGrid(r, level),

    issuesPanel(navigate),

    h('div', { class: 'grid grid-2 mt' },
      card("Chiffre d'affaires et résultat", 'Cinq exercices',
        barChart({
          categories: YEAR_CATEGORIES,
          series: [
            { label: "Chiffre d'affaires", values: p.revenue, color: PALETTE[0] },
            { label: 'EBITDA', values: p.ebitda, color: PALETTE[1] },
            { label: 'Résultat net', values: p.netResult, color: PALETTE[3] },
          ],
          line: k.breakEven.some((v) => v) ? { label: 'Point mort', values: k.breakEven.map((v) => v || 0), color: '#e0335a', dashed: true } : null,
        })),
      card('Trésorerie mensuelle', 'Solde de fin de mois, 60 mois',
        areaChart({ values: r.cash.balance, startDate: r.startDate, color: k.fundingNeed > 0 ? '#d97a06' : '#05a578' }),
        k.fundingNeed > 0
          ? h('div', { class: 'note warn', style: { marginTop: '12px' } },
              h('div', { class: 'note-title' }, '⚠ Financement à réunir'),
              `Votre trésorerie descend à ${euro(-k.fundingNeed)} en ${monthLabel(k.cashLow.month, r.startDate)}. Il vous faut au moins ${euro(k.fundingNeed)} de financement complémentaire avant cette date.`)
          : h('div', { class: 'note ok', style: { marginTop: '12px' } },
              h('div', { class: 'note-title' }, '✓ Trésorerie couverte'),
              `Le solde reste positif sur tout l'horizon, au plus bas à ${euro(k.cashLow.value)} en ${monthLabel(k.cashLow.month, r.startDate)}.`),
      ),
    ),

    h('div', { class: 'grid grid-2 mt' },
      card('Structure des coûts', yearLabel(pickYear(p)),
        stackedBar({
          categories: YEAR_CATEGORIES,
          series: [
            { label: 'Achats variables', values: p.variableCost, color: PALETTE[3] },
            { label: 'Charges externes', values: p.external, color: PALETTE[2] },
            { label: 'Personnel', values: p.payroll, color: PALETTE[0] },
            { label: 'Impôts et taxes', values: p.duties, color: PALETTE[4] },
            { label: 'Amortissements', values: p.amortisation, color: PALETTE[6] },
          ],
        })),
      card("Répartition du chiffre d'affaires", `Cumul sur 5 ans`,
        donut({
          items: r.revenue.perActivity.map((a, i) => ({
            label: a.name, value: a.total.reduce((x, y) => x + y, 0), color: PALETTE[i % PALETTE.length],
          })),
        }),
        r.revenue.perActivity.length === 1
          ? h('p', { class: 'tiny muted', style: { marginTop: '10px', marginBottom: 0 } },
              level === 'easy' ? "Passez en niveau Intermédiaire pour modéliser plusieurs offres." : "Ajoutez une deuxième offre pour comparer leur contribution.")
          : null,
      ),
    ),

    level !== 'easy' && r.revenue.campaigns.length > 0 && marketingPanel(r),

    h('div', { class: 'card mt' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Compte de résultat résumé'), h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-sm', onClick: () => navigate('#/resultats') }, 'Détail complet')),
      h('div', { class: 'table-wrap' }, summaryTable(r, level)),
    ),
  )
}

function kpiGrid(r, level) {
  const k = r.kpis, p = r.pnl
  const y = pickYear(p)
  const tiles = [
    kpi("Chiffre d'affaires", euro(p.revenue[y], { compact: true }), yearLabel(y), null, ''),
    kpi('EBITDA', euro(p.ebitda[y], { compact: true }), `${pct(k.ebitdaMargin[y])} du CA`, 'ebitda', p.ebitda[y] >= 0 ? 'pos' : 'neg'),
    kpi('Point mort', k.breakEven[y] ? euro(k.breakEven[y], { compact: true }) : '—',
      k.breakEven[y] ? (p.revenue[y] >= k.breakEven[y] ? '✓ Atteint' : `${pct(p.revenue[y] / k.breakEven[y])} atteint`) : 'Marge insuffisante',
      'pointMort', k.breakEven[y] && p.revenue[y] >= k.breakEven[y] ? 'pos' : 'warn'),
    kpi('Résultat net', euro(p.netResult[y], { compact: true }), `${pct(k.netMargin[y])} du CA`, null, p.netResult[y] >= 0 ? 'pos' : 'neg'),
  ]
  if (level !== 'easy') {
    tiles.push(
      kpi('Besoin de financement', k.fundingNeed > 0 ? euro(k.fundingNeed, { compact: true }) : 'Aucun',
        k.fundingNeed > 0 ? `Point bas ${monthLabel(k.cashLow.month, r.startDate)}` : 'Trésorerie toujours positive',
        'tresorerie', k.fundingNeed > 0 ? 'warn' : 'pos'),
      kpi('Autonomie', k.runwayMonths === null ? '—' : `${num(k.runwayMonths, 0)} mois`,
        k.burnRate > 0 ? `${euro(k.burnRate)} consommés/mois` : 'Aucune consommation nette', 'runway',
        k.runwayMonths !== null && k.runwayMonths < 6 ? 'neg' : ''),
    )
  }
  if (level === 'advanced') {
    tiles.push(
      kpi('BFR maximum', euro(k.peakBfr, { compact: true }), 'À financer en permanence', 'bfr', k.peakBfr > 0 ? 'warn' : ''),
      kpi('LTV / CAC', k.ltvCacRatio ? `${num(k.ltvCacRatio, 1)}×` : '—',
        k.cac ? `CAC ${euro(k.cac)} · LTV ${euro(k.ltv)}` : 'Aucune campagne marketing', 'ltv',
        k.ltvCacRatio ? (k.ltvCacRatio >= 3 ? 'pos' : k.ltvCacRatio >= 1 ? 'warn' : 'neg') : ''),
    )
  }
  return h('div', { class: 'grid grid-4 kpis' }, ...tiles)
}

function kpi(label, value, sub, glossaryKey, tone) {
  return h('div', { class: `kpi ${tone || ''}` },
    h('span', { class: 'kpi-accent' }),
    h('div', { class: 'kpi-label' }, label, glossaryKey && helpButton(glossaryKey)),
    h('div', { class: 'kpi-value' }, value),
    h('div', { class: 'kpi-sub' }, sub),
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
        h('span', {}, i.level === 'error' ? '●' : '○'),
        h('div', { class: 'spacer' },
          h('div', { style: { fontWeight: '570' } }, i.message),
          i.hint && h('div', { class: 'tiny muted' }, i.hint),
        ),
        i.page && h('button', { class: 'btn btn-sm btn-ghost', onClick: () => navigate(`#/${i.page}`) }, 'Corriger'),
      )),
    ),
  )
}

function marketingPanel(r) {
  const k = r.kpis
  return h('div', { class: 'card mt' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Acquisition client'), h('span', { class: 'spacer' }),
      k.ltvCacRatio && h('span', { class: `chip ${k.ltvCacRatio >= 3 ? 'chip-pos' : k.ltvCacRatio >= 1 ? 'chip-warn' : 'chip-neg'}` }, `LTV/CAC ${num(k.ltvCacRatio, 1)}×`)),
    h('div', { class: 'card-body' },
      h('div', { class: 'table-wrap' },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {},
            h('th', {}, 'Campagne'), h('th', {}, 'Budget total'), h('th', {}, 'Clients acquis'), h('th', {}, 'CAC'), h('th', {}, 'Part'),
          )),
          h('tbody', {},
            ...r.revenue.campaigns.map((c) => {
              const totalClients = r.revenue.campaigns.reduce((a, x) => a + x.totalClients, 0)
              return h('tr', {},
                h('td', {}, c.name),
                h('td', { class: 'num' }, euro(c.totalSpend)),
                h('td', { class: 'num' }, num(c.totalClients)),
                h('td', { class: 'num' }, c.cac ? euro(c.cac) : '—'),
                h('td', { class: 'num pct' }, totalClients > 0 ? pct(c.totalClients / totalClients, 0) : '—'),
              )
            }),
            h('tr', { class: 'total' },
              h('td', {}, 'Total'),
              h('td', { class: 'num' }, euro(r.revenue.campaigns.reduce((a, c) => a + c.totalSpend, 0))),
              h('td', { class: 'num' }, num(r.revenue.campaigns.reduce((a, c) => a + c.totalClients, 0))),
              h('td', { class: 'num' }, k.cac ? euro(k.cac) : '—'),
              h('td', {}, ''),
            ),
          ),
        ),
      ),
    ),
  )
}

function summaryTable(r, level) {
  const p = r.pnl
  const rows = [
    ['Chiffre d\'affaires', p.revenue, 'strong'],
    ['Achats et charges variables', p.variableCost.map((v) => -v)],
    ['Marge brute', p.grossMargin, 'highlight', 'margeBrute'],
    ['Charges externes', p.external.map((v) => -v)],
    ['Charges de personnel', p.payroll.map((v) => -v)],
    ['Impôts et taxes', p.duties.map((v) => -v)],
    ...(p.grants.some((v) => v) ? [['Subventions d\'exploitation', p.grants]] : []),
    ['EBITDA', p.ebitda, 'highlight', 'ebitda'],
    ['Amortissements', p.amortisation.map((v) => -v)],
    ['Résultat d\'exploitation', p.ebit, '', 'ebit'],
    ...(level !== 'easy' ? [['Charges financières', p.interest.map((v) => -v)]] : []),
    ...(level === 'advanced' && p.credits.some((v) => v) ? [['Crédits d\'impôt (CIR, CII)', p.credits, '', 'cir']] : []),
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

function card(title, subtitle, ...body) {
  return h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {}, h('h2', {}, title), subtitle && h('div', { class: 'tiny muted' }, subtitle)),
    ),
    h('div', { class: 'card-body' }, ...body),
  )
}

/** Année de référence : la première rentable, sinon la troisième. */
export function pickYear(pnl) {
  const i = pnl.netResult.findIndex((v) => v > 0)
  return i >= 0 ? i : 2
}

function describe(r) {
  const y = pickYear(r.pnl)
  const k = r.kpis
  const parts = []
  parts.push(`${euro(r.pnl.revenue[y], { compact: true })} de chiffre d'affaires en ${yearLabel(y).toLowerCase()}`)
  if (k.firstProfitableYear !== null) parts.push(`rentable dès l'année ${k.firstProfitableYear + 1}`)
  else parts.push("pas encore rentable sur l'horizon modélisé")
  if (k.fundingNeed > 0) parts.push(`${euro(k.fundingNeed, { compact: true })} de financement à réunir`)
  return parts.join(' · ')
}
