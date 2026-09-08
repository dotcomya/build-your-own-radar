/** États financiers : résultat, trésorerie, bilan, BFR, fiscalité. */

import { h, euro, pct, num, helpButton, monthLabel, yearLabel } from '../dom.js'
import { areaChart, barChart, stackedBar, PALETTE, YEAR_CATEGORIES } from '../charts.js'
import store from '../../state/store.js'

const TABS = {
  resultat: 'Compte de résultat',
  tresorerie: 'Trésorerie',
  bilan: 'Bilan',
  bfr: 'BFR',
  fiscalite: 'Fiscalité',
}

export function renderResults(navigate, refresh) {
  const r = store.result
  const level = store.level
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun résultat.'))
  const available = Object.entries(TABS).filter(([k]) => level === 'advanced' || ['resultat', 'tresorerie'].includes(k) || (level === 'intermediate' && k === 'fiscalite'))
  const current = available.some(([k]) => k === renderResults.tab) ? renderResults.tab : 'resultat'

  return h('div', { class: 'content' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'États financiers'),
      h('p', {}, "Tout est calculé à partir de ce que vous avez saisi. Aucune ligne n'est à remplir ici."),
    ),
    h('div', { class: 'levels mb', style: { flexWrap: 'wrap' } },
      ...available.map(([k, label]) => h('button', {
        class: `level-btn ${current === k ? 'active' : ''}`,
        onClick: () => { renderResults.tab = k; refresh() },
      }, label)),
    ),
    current === 'resultat' ? pnlView(r, level)
      : current === 'tresorerie' ? cashView(r, level, refresh)
      : current === 'bilan' ? balanceView(r)
      : current === 'bfr' ? bfrView(r)
      : taxView(r),
  )
}

function pnlView(r, level) {
  const p = r.pnl, k = r.kpis
  const line = (label, values, opts = {}) => h('tr', { class: opts.cls || '' },
    h('td', {}, h('span', { class: 'rowlabel' }, label, opts.help && helpButton(opts.help))),
    ...values.map((v) => h('td', { class: `num ${opts.negate ? 'muted' : ''}` }, euro(opts.negate ? -v : v))),
  )
  const rate = (label, values) => h('tr', {},
    h('td', { class: 'muted small' }, label),
    ...values.map((v) => h('td', { class: 'num pct' }, pct(v))),
  )

  return h('div', {},
    h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Soldes intermédiaires de gestion'), h('span', { class: 'tiny muted' }, 'Montants hors taxes')),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, yearLabel(i))))),
          h('tbody', {},
            line("Chiffre d'affaires", p.revenue, { cls: 'highlight' }),
            line('Achats et charges variables', p.variableCost, { negate: true }),
            line('Marge brute', p.grossMargin, { cls: 'highlight', help: 'margeBrute' }),
            rate('en % du chiffre d\'affaires', k.marginRate),
            line('Charges externes', p.external, { negate: true }),
            line('Valeur ajoutée', p.valueAdded, { help: 'valeurAjoutee' }),
            line('Impôts et taxes', p.duties, { negate: true }),
            ...(p.grants.some((v) => v) ? [line("Subventions d'exploitation", p.grants)] : []),
            line('Charges de personnel', p.payroll, { negate: true, help: 'superBrut' }),
            line("EBITDA — Excédent brut d'exploitation", p.ebitda, { cls: 'highlight', help: 'ebitda' }),
            rate('marge d\'EBITDA', k.ebitdaMargin),
            line('Dotations aux amortissements', p.amortisation, { negate: true }),
            line("Résultat d'exploitation", p.ebit, { help: 'ebit' }),
            ...(level !== 'easy' ? [line('Charges financières', p.interest, { negate: true })] : []),
            line('Résultat avant impôt', p.preTax),
            ...(p.credits.some((v) => v) ? [line("Crédits d'impôt recherche et innovation", p.credits, { help: 'cir' })] : []),
            line('Impôt sur les sociétés', p.corporateTax, { negate: true, help: 'is' }),
            line('Résultat net', p.netResult, { cls: 'total' }),
            rate('marge nette', k.netMargin),
          ),
        ),
      ),
    ),

    h('div', { class: 'grid grid-2' },
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', {}, 'Du chiffre d\'affaires au résultat')),
        h('div', { class: 'card-body' },
          barChart({
            categories: YEAR_CATEGORIES,
            series: [
              { label: "Chiffre d'affaires", values: p.revenue, color: PALETTE[0] },
              { label: 'Marge brute', values: p.grossMargin, color: PALETTE[1] },
              { label: 'EBITDA', values: p.ebitda, color: PALETTE[3] },
              { label: 'Résultat net', values: p.netResult, color: PALETTE[2] },
            ],
          }),
        ),
      ),
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', {}, 'Point mort'), helpButton('pointMort')),
        h('div', { class: 'card-body' },
          h('div', { class: 'table-wrap' },
            h('table', { class: 'data' },
              h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, `A${i + 1}`)))),
              h('tbody', {},
                h('tr', {}, h('td', {}, 'Charges fixes'), ...k.fixedCosts.map((v) => h('td', { class: 'num' }, euro(v)))),
                h('tr', {}, h('td', {}, 'Taux de marge'), ...k.marginRate.map((v) => h('td', { class: 'num pct' }, pct(v)))),
                h('tr', { class: 'highlight' }, h('td', {}, 'Point mort'), ...k.breakEven.map((v) => h('td', { class: 'num' }, v ? euro(v) : '—'))),
                h('tr', {}, h('td', {}, "Chiffre d'affaires réalisé"), ...p.revenue.map((v) => h('td', { class: 'num' }, euro(v)))),
                h('tr', { class: 'total' }, h('td', {}, 'Atteint ?'), ...p.revenue.map((v, i) => h('td', {},
                  h('span', { class: `chip ${k.breakEven[i] && v >= k.breakEven[i] ? 'chip-pos' : 'chip-warn'}` },
                    k.breakEven[i] ? (v >= k.breakEven[i] ? '✓' : pct(v / k.breakEven[i], 0)) : '—')))),
                ...(k.breakEvenMonth.some((m) => m) ? [h('tr', {}, h('td', { class: 'muted small' }, 'Mois où il est franchi'), ...k.breakEvenMonth.map((m) => h('td', { class: 'num muted small' }, m ? `M${m}` : '—')))] : []),
              ),
            ),
          ),
          h('div', { class: 'note mt' },
            h('div', { class: 'note-title' }, 'Comment le lire'),
            k.breakEven[0]
              ? `En année 1, il faut réaliser ${euro(k.breakEven[0])} de chiffre d'affaires pour couvrir vos charges. Avec un taux de marge de ${pct(k.marginRate[0], 0)}, chaque euro vendu en dégage ${euro(k.marginRate[0])} pour financer vos frais fixes de ${euro(k.fixedCosts[0])}.`
              : "Le point mort n'est calculable qu'avec une marge brute positive. Vérifiez vos prix et coûts de revient."),
        ),
      ),
    ),
  )
}

function cashView(r, level, refresh) {
  const rows = r.cash.rows
  const monthsHeader = Array.from({ length: 60 }, (_, m) => monthLabel(m, r.startDate))
  const line = (label, series, negate) => h('tr', {},
    h('td', {}, label),
    ...series.map((v) => h('td', { class: `num ${negate ? 'muted' : ''}` }, v === 0 ? '—' : euro(negate ? -v : v))),
  )
  const view = renderResults.cashView || 'annual'

  return h('div', {},
    h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Solde de trésorerie'), helpButton('tresorerie')),
      h('div', { class: 'card-body' },
        areaChart({ values: r.cash.balance, startDate: r.startDate, color: r.kpis.fundingNeed > 0 ? '#d97a06' : '#05a578' }),
      ),
    ),
    h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h2', {}, 'Plan de trésorerie'),
        h('span', { class: 'spacer' }),
        h('div', { class: 'levels' },
          h('button', { class: `level-btn ${view === 'annual' ? 'active' : ''}`, onClick: () => { renderResults.cashView = 'annual'; refresh() } }, 'Par année'),
          h('button', { class: `level-btn ${view === 'monthly' ? 'active' : ''}`, onClick: () => { renderResults.cashView = 'monthly'; refresh() } }, 'Mois par mois'),
        ),
      ),
      h('div', { class: 'table-wrap' },
        view === 'annual'
          ? h('table', { class: 'data' },
              h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, yearLabel(i))))),
              h('tbody', {},
                h('tr', { class: 'section' }, h('td', { colspan: 6 }, 'Encaissements')),
                line('Ventes encaissées', yearly(rows.sales)),
                line('TVA collectée', yearly(rows.vatCollected)),
                ...(rows.vatRefunded.some((v) => v) ? [line('Remboursements de TVA', yearly(rows.vatRefunded))] : []),
                ...(rows.equity.some((v) => v) ? [line('Apports en capital', yearly(rows.equity))] : []),
                ...(rows.loans.some((v) => v) ? [line('Emprunts débloqués', yearly(rows.loans))] : []),
                ...(rows.grants.some((v) => v) ? [line('Subventions', yearly(rows.grants))] : []),
                ...(rows.shareholder.some((v) => v) ? [line('Avances et comptes courants', yearly(rows.shareholder))] : []),
                ...(rows.credits.some((v) => v) ? [line("Crédits d'impôt encaissés", yearly(rows.credits))] : []),
                h('tr', { class: 'total' }, h('td', {}, 'Total des encaissements'), ...yearly(r.cash.inflow).map((v) => h('td', { class: 'num' }, euro(v)))),
                h('tr', { class: 'section' }, h('td', { colspan: 6 }, 'Décaissements')),
                line('Achats', yearly(rows.purchases)),
                line('Charges externes', yearly(rows.opex)),
                line('Salaires et cotisations', yearly(rows.payroll)),
                line('TVA déductible payée', yearly(rows.vatDeductible)),
                line('TVA reversée', yearly(rows.vatPaid)),
                line('Impôts et taxes', yearly(rows.duties)),
                ...(rows.capex.some((v) => v) ? [line('Investissements', yearly(rows.capex))] : []),
                ...(rows.lease.some((v) => v) ? [line('Loyers de crédit-bail', yearly(rows.lease))] : []),
                ...(rows.stockChange.some((v) => v) ? [line('Variation de stock', yearly(rows.stockChange))] : []),
                ...(rows.loanRepayment.some((v) => v) ? [line("Remboursement d'emprunts", yearly(rows.loanRepayment))] : []),
                ...(rows.corporateTax.some((v) => v) ? [line('Impôt sur les sociétés', yearly(rows.corporateTax))] : []),
                h('tr', { class: 'total' }, h('td', {}, 'Total des décaissements'), ...yearly(r.cash.outflow).map((v) => h('td', { class: 'num' }, euro(v)))),
                h('tr', { class: 'highlight' }, h('td', {}, 'Variation de trésorerie'),
                  ...yearly(r.cash.inflow).map((v, i) => h('td', { class: `num ${v - yearly(r.cash.outflow)[i] < 0 ? 'neg' : 'pos'}` }, euro(v - yearly(r.cash.outflow)[i])))),
                h('tr', { class: 'total' }, h('td', {}, "Solde de fin d'exercice"),
                  ...r.cash.yearEnd.map((v) => h('td', { class: `num ${v < 0 ? 'neg' : ''}` }, euro(v)))),
              ),
            )
          : h('table', { class: 'data' },
              h('thead', {}, h('tr', {}, h('th', {}, ''), ...monthsHeader.map((m) => h('th', {}, m)))),
              h('tbody', {},
                h('tr', {}, h('td', {}, 'Encaissements'), ...r.cash.inflow.map((v) => h('td', { class: 'num' }, euro(v, { compact: true })))),
                h('tr', {}, h('td', {}, 'Décaissements'), ...r.cash.outflow.map((v) => h('td', { class: 'num muted' }, euro(-v, { compact: true })))),
                h('tr', { class: 'total' }, h('td', {}, 'Solde cumulé'), ...r.cash.balance.map((v) => h('td', { class: `num ${v < 0 ? 'neg' : ''}` }, euro(v, { compact: true })))),
              ),
            ),
      ),
    ),
  )
}

function balanceView(r) {
  const rowsOf = (keys) => keys.map(([label, key, cls]) => h('tr', { class: cls || '' },
    h('td', {}, label), ...r.balance.map((b) => h('td', { class: 'num' }, euro(b[key])))))
  return h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Bilans prévisionnels'), helpButton('bilan')),
    h('div', { class: 'table-wrap' },
      h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, yearLabel(i))))),
        h('tbody', {},
          h('tr', { class: 'section' }, h('td', { colspan: 6 }, 'Actif')),
          ...rowsOf([
            ['Immobilisations brutes', 'grossFixed'],
            ['Amortissements cumulés', 'amortisation'],
            ['Immobilisations nettes', 'netFixed'],
            ['Créances clients', 'receivables'],
            ['Stocks', 'stock'],
            ['Créance de TVA', 'vatCredit'],
            ["Créance de crédit d'impôt", 'taxCredit'],
            ['Trésorerie', 'treasury'],
            ['Total actif', 'totalAssets', 'total'],
          ]),
          h('tr', { class: 'section' }, h('td', { colspan: 6 }, 'Passif')),
          ...rowsOf([
            ['Capital', 'capital'],
            ['Résultats accumulés', 'retained'],
            ['Capitaux propres', 'equity', 'highlight'],
            ['Emprunts', 'debt'],
            ['Avances et comptes courants', 'shareholder'],
            ['Dettes fournisseurs', 'payables'],
            ['Dette de TVA', 'vatDebt'],
            ['Dette fiscale', 'taxDebt'],
            ['Total passif', 'totalLiabilities', 'total'],
          ]),
        ),
      ),
    ),
    h('div', { class: 'card-body' },
      r.balance.some((b) => b.equity < 0)
        ? h('div', { class: 'note danger' },
            h('div', { class: 'note-title' }, 'Capitaux propres négatifs'),
            "Vos pertes cumulées dépassent les apports. Juridiquement, les associés doivent se prononcer sur la poursuite de l'activité dès que les capitaux propres passent sous la moitié du capital social. Renforcez les apports ou accélérez le retour à l'équilibre.")
        : h('div', { class: 'note ok' },
            h('div', { class: 'note-title' }, 'Structure financière saine'),
            `Les capitaux propres restent positifs sur tout l'horizon, à ${euro(r.balance[4].equity)} en fin d'année 5, pour un total de bilan de ${euro(r.balance[4].totalAssets)}.`),
    ),
  )
}

function bfrView(r) {
  return h('div', {},
    h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Besoin en fonds de roulement'), helpButton('bfr')),
      h('div', { class: 'card-body' },
        areaChart({ values: r.bfr.total, startDate: r.startDate, color: PALETTE[2], markZero: false }),
        h('div', { class: 'note mt' },
          h('div', { class: 'note-title' }, `Pic de besoin : ${euro(r.kpis.peakBfr)}`),
          "C'est l'argent immobilisé en permanence dans le cycle d'exploitation. Il doit être financé par du capital ou du crédit — jamais par le découvert. Négocier un acompte client plus élevé ou un délai fournisseur plus long le réduit sans rien changer à votre rentabilité."),
      ),
    ),
    h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Composantes en fin de mois')),
      h('div', { class: 'card-body' },
        stackedBar({
          categories: YEAR_CATEGORIES,
          series: [
            { label: 'Créances clients', values: endOfYear(r.bfr.receivables), color: PALETTE[0] },
            { label: 'Stocks', values: endOfYear(r.bfr.stock), color: PALETTE[1] },
            { label: 'Créance de TVA', values: endOfYear(r.bfr.vatBalance).map((v) => Math.max(0, v)), color: PALETTE[3] },
          ],
        }),
        h('div', { class: 'table-wrap mt' },
          h('table', { class: 'data' },
            h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, yearLabel(i))))),
            h('tbody', {},
              h('tr', {}, h('td', {}, 'Créances clients'), ...endOfYear(r.bfr.receivables).map((v) => h('td', { class: 'num' }, euro(v)))),
              h('tr', {}, h('td', {}, 'Stocks'), ...endOfYear(r.bfr.stock).map((v) => h('td', { class: 'num' }, euro(v)))),
              h('tr', {}, h('td', {}, 'Dettes fournisseurs'), ...endOfYear(r.bfr.payables).map((v) => h('td', { class: 'num muted' }, euro(-v)))),
              h('tr', { class: 'total' }, h('td', {}, 'BFR'), ...endOfYear(r.bfr.total).map((v) => h('td', { class: 'num' }, euro(v)))),
              h('tr', {}, h('td', { class: 'muted small' }, 'en jours de chiffre d\'affaires'),
                ...endOfYear(r.bfr.total).map((v, i) => h('td', { class: 'num pct' }, r.pnl.revenue[i] > 0 ? `${num((v / r.pnl.revenue[i]) * 365)} j` : '—'))),
            ),
          ),
        ),
      ),
    ),
  )
}

function taxView(r) {
  return h('div', {},
    h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Impôt sur les sociétés'), helpButton('is')),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, yearLabel(i))))),
          h('tbody', {},
            h('tr', {}, h('td', {}, 'Résultat avant impôt'), ...r.pnl.preTax.map((v) => h('td', { class: 'num' }, euro(v)))),
            h('tr', {}, h('td', {}, 'Déficits imputés'), ...r.tax.map((t) => h('td', { class: 'num muted' }, t.used > 0 ? euro(-t.used) : '—'))),
            h('tr', {}, h('td', {}, 'Déficits reportables restants'), ...r.tax.map((t) => h('td', { class: 'num muted' }, t.carried > 0 ? euro(t.carried) : '—'))),
            h('tr', { class: 'highlight' }, h('td', {}, 'Bénéfice imposable'), ...r.tax.map((t) => h('td', { class: 'num' }, euro(t.taxable)))),
            h('tr', {}, h('td', {}, 'dont taxé à 15 %'), ...r.tax.map((t) => h('td', { class: 'num' }, euro(t.reducedPart)))),
            h('tr', {}, h('td', {}, 'dont taxé à 25 %'), ...r.tax.map((t) => h('td', { class: 'num' }, euro(t.normalPart)))),
            h('tr', { class: 'total' }, h('td', {}, 'Impôt dû'), ...r.tax.map((t) => h('td', { class: 'num' }, euro(t.tax)))),
          ),
        ),
      ),
    ),

    h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Impôts et taxes de production')),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, yearLabel(i))))),
          h('tbody', {},
            h('tr', {}, h('td', {}, "Taxe d'apprentissage"), ...r.duties.map((d) => h('td', { class: 'num' }, euro(d.apprenticeship)))),
            h('tr', {}, h('td', {}, 'Formation professionnelle'), ...r.duties.map((d) => h('td', { class: 'num' }, euro(d.training)))),
            h('tr', {}, h('td', {}, 'Cotisation foncière (CFE)'), ...r.duties.map((d) => h('td', { class: 'num' }, euro(d.cfe)))),
            ...(r.duties.some((d) => d.cvae > 0) ? [h('tr', {}, h('td', {}, 'CVAE'), ...r.duties.map((d) => h('td', { class: 'num' }, euro(d.cvae))))] : []),
            ...(r.duties.some((d) => d.c3s > 0) ? [h('tr', {}, h('td', {}, 'C3S'), ...r.duties.map((d) => h('td', { class: 'num' }, euro(d.c3s))))] : []),
            ...(r.duties.some((d) => d.construction > 0) ? [h('tr', {}, h('td', {}, "Effort de construction"), ...r.duties.map((d) => h('td', { class: 'num' }, euro(d.construction))))] : []),
            h('tr', { class: 'total' }, h('td', {}, 'Total'), ...r.pnl.duties.map((v) => h('td', { class: 'num' }, euro(v)))),
          ),
        ),
      ),
      h('div', { class: 'card-body' },
        h('div', { class: 'note plain' },
          "La CFE n'est pas due l'année de création et bénéficie d'un abattement de 50 % la première année d'imposition. La CVAE ne s'applique qu'au-delà de 500 000 € de chiffre d'affaires, la C3S au-delà de 19 M€.")),
    ),

    r.credits.some((c) => c.total > 0) && h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, "Crédits d'impôt recherche et innovation"), helpButton('cir')),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, yearLabel(i))))),
          h('tbody', {},
            h('tr', {}, h('td', {}, 'Salaires affectés à la recherche'), ...r.credits.map((c) => h('td', { class: 'num' }, euro(c.salaries)))),
            h('tr', {}, h('td', {}, 'Forfait de frais de fonctionnement (43 %)'), ...r.credits.map((c) => h('td', { class: 'num' }, euro(c.operating)))),
            h('tr', {}, h('td', {}, 'Amortissements de matériel de recherche'), ...r.credits.map((c) => h('td', { class: 'num' }, euro(c.equipment)))),
            ...(r.credits.some((c) => c.subcontracting > 0) ? [h('tr', {}, h('td', {}, 'Sous-traitance agréée'), ...r.credits.map((c) => h('td', { class: 'num' }, euro(c.subcontracting))))] : []),
            h('tr', { class: 'highlight' }, h('td', {}, 'Assiette éligible'), ...r.credits.map((c) => h('td', { class: 'num' }, euro(c.base)))),
            h('tr', {}, h('td', {}, 'CIR (30 %)'), ...r.credits.map((c) => h('td', { class: 'num pos' }, euro(c.cir)))),
            ...(r.credits.some((c) => c.cii > 0) ? [h('tr', {}, h('td', {}, h('span', { class: 'rowlabel' }, 'CII (20 %)', helpButton('cii'))), ...r.credits.map((c) => h('td', { class: 'num pos' }, euro(c.cii))))] : []),
            ...(r.credits.some((c) => c.deMinimisExcess > 0) ? [h('tr', {}, h('td', { class: 'muted small' }, 'écrêtement de minimis'), ...r.credits.map((c) => h('td', { class: 'num muted' }, c.deMinimisExcess > 0 ? euro(-c.deMinimisExcess) : '—')))] : []),
            h('tr', { class: 'total' }, h('td', {}, 'Total encaissable'), ...r.credits.map((c) => h('td', { class: 'num pos' }, euro(c.total)))),
          ),
        ),
      ),
      h('div', { class: 'card-body' },
        h('div', { class: 'note warn' },
          h('div', { class: 'note-title' }, 'Point de vigilance'),
          "La qualification de « recherche » au sens fiscal suppose une incertitude scientifique ou technique levée par des travaux méthodiques — pas un simple développement. Faites valider votre éligibilité par un conseil ou par un rescrit fiscal avant d'intégrer ces montants à un plan de financement présenté à un tiers.")),
    ),
  )
}

const yearly = (arr) => Array.from({ length: 5 }, (_, y) => arr.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0))
const endOfYear = (arr) => Array.from({ length: 5 }, (_, y) => arr[y * 12 + 11])
