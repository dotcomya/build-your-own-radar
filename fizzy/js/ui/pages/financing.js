/** Financement : capital, emprunts, subventions, avances. */

import { h, euro, num, pct, numberField, textField, monthField, helpButton, confirmDialog, monthLabel } from '../dom.js'
import { uid } from '../../state/schema.js'
import { areaChart, barChart, PALETTE, YEAR_CATEGORIES } from '../charts.js'
import store from '../../state/store.js'

export function renderFinancing(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const f = s.financing
  const level = store.level

  const push = (key, item, label) => { store.update((sc) => sc.financing[key].push(item), { label }); refresh() }
  const drop = (key, id) => { store.update((sc) => { sc.financing[key] = sc.financing[key].filter((x) => x.id !== id) }, { label: 'Suppression' }); refresh() }
  const setField = (key, id, patch, opts = {}) => store.update((sc) => Object.assign(sc.financing[key].find((x) => x.id === id), patch), { label: 'Financement', ...(opts || {}) })

  const totalRaised =
    sum(f.equityFounders) + sum(f.equityInvestors) + sum(f.loans) + sum(f.grants) + sum(f.advances) + sum(f.shareholderLoans)

  return h('div', { class: 'content' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'Financement'),
      h('p', {}, "Ce que vous mettez, ce que vous empruntez, ce qu'on vous donne. Le point bas de votre trésorerie indique le minimum à réunir avant de démarrer."),
    ),

    r && h('div', { class: 'grid grid-4 kpis mb' },
      tile('Financements réunis', euro(totalRaised, { compact: true }), 'Tous apports confondus'),
      tile('Besoin identifié', r.kpis.fundingNeed > 0 ? euro(r.kpis.fundingNeed, { compact: true }) : 'Couvert',
        r.kpis.fundingNeed > 0 ? `Point bas ${monthLabel(r.kpis.cashLow.month, r.startDate)}` : 'Trésorerie positive', 'tresorerie',
        r.kpis.fundingNeed > 0 ? 'neg' : 'pos'),
      tile('Trésorerie fin année 1', euro(r.cash.yearEnd[0], { compact: true }), 'Solde au 12ᵉ mois', null, r.cash.yearEnd[0] >= 0 ? 'pos' : 'neg'),
      tile('Autonomie', r.kpis.runwayMonths === null ? '—' : `${num(r.kpis.runwayMonths, 0)} mois`, 'Au rythme actuel', 'runway',
        r.kpis.runwayMonths !== null && r.kpis.runwayMonths < 6 ? 'neg' : ''),
    ),

    r && h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Trajectoire de trésorerie'), helpButton('tresorerie')),
      h('div', { class: 'card-body' },
        areaChart({ values: r.cash.balance, startDate: r.startDate, color: r.kpis.fundingNeed > 0 ? '#d97a06' : '#05a578' }),
        r.kpis.fundingNeed > 0 && h('div', { class: 'note warn mt' },
          h('div', { class: 'note-title' }, `Il manque ${euro(r.kpis.fundingNeed)}`),
          `Votre solde atteint son point bas en ${monthLabel(r.kpis.cashLow.month, r.startDate)}. Trois leviers : augmenter les apports ci-dessous, négocier des acomptes clients plus élevés dans l'onglet Offre, ou décaler des recrutements et investissements.`),
      ),
    ),

    h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Trésorerie de départ')),
      h('div', { class: 'card-body' },
        numberField({ label: 'Solde disponible au démarrage', field: 'amount', value: f.openingCash, suffix: '€',
          hint: "Argent déjà présent sur le compte avant tout apport modélisé ci-dessous.",
          onInput: (v) => store.update((sc) => { sc.financing.openingCash = v }, { label: 'Trésorerie initiale' }) }),
      ),
    ),

    block('Apports des fondateurs', "Capital versé par vous et vos associés.", f.equityFounders, 'equityFounders',
      (item, i) => h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end' } },
        numberField({ label: 'Montant', field: 'amount', value: item.amount, suffix: '€', onInput: (v) => updateAt('equityFounders', i, { amount: v }) }),
        monthField({ label: 'Mois', value: item.month, startDate: r?.startDate, onInput: (v) => updateAt('equityFounders', i, { month: v }) }),
        h('button', { class: 'btn btn-sm btn-danger', onClick: () => removeAt('equityFounders', i) }, 'Retirer'),
      ),
      () => pushAt('equityFounders', { month: 0, amount: 10000 })),

    level !== 'easy' && block('Levée de fonds', "Capital apporté par des investisseurs extérieurs.", f.equityInvestors, 'equityInvestors',
      (item, i) => h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end' } },
        numberField({ label: 'Montant', field: 'amount', value: item.amount, suffix: '€', onInput: (v) => updateAt('equityInvestors', i, { amount: v }) }),
        monthField({ label: 'Mois', value: item.month, startDate: r?.startDate, onInput: (v) => updateAt('equityInvestors', i, { month: v }) }),
        h('button', { class: 'btn btn-sm btn-danger', onClick: () => removeAt('equityInvestors', i) }, 'Retirer'),
      ),
      () => pushAt('equityInvestors', { month: 6, amount: 250000 })),

    level !== 'easy' && h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Emprunts bancaires'), h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-sm', onClick: () => push('loans', { id: uid('loan'), label: 'Prêt bancaire', amount: 50000, month: 0, rate: 0.04, months: 60, graceMonths: 0 }, 'Ajout emprunt') }, '＋ Emprunt')),
      h('div', { class: 'card-body' },
        f.loans.length === 0
          ? h('p', { class: 'muted small', style: { margin: 0 } }, "Aucun emprunt. Un prêt bancaire finance en général les investissements durables, rarement le besoin en fonds de roulement.")
          : h('div', {}, ...f.loans.map((l) => h('div', { class: 'card', style: { marginBottom: '9px', background: 'var(--ink-50)' } },
              h('div', { class: 'card-body tight' },
                h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(130px,1.4fr) repeat(4, minmax(96px,1fr)) auto', gap: '10px', alignItems: 'end' } },
                  textField({ label: 'Intitulé', value: l.label, onInput: (v, o) => setField('loans', l.id, { label: v }, o) }),
                  numberField({ label: 'Montant', field: 'amount', value: l.amount, suffix: '€', onInput: (v) => setField('loans', l.id, { amount: v }) }),
                  numberField({ label: "Taux annuel", field: 'rate', value: l.rate, percent: true, step: 0.1, onInput: (v) => setField('loans', l.id, { rate: v }) }),
                  numberField({ label: 'Durée', field: 'months', value: l.months, suffix: 'mois', onInput: (v) => setField('loans', l.id, { months: v }) }),
                  monthField({ label: 'Déblocage', value: l.month, startDate: r?.startDate, onInput: (v) => setField('loans', l.id, { month: v }) }),
                  h('button', { class: 'btn btn-sm btn-danger', onClick: () => drop('loans', l.id), style: { marginBottom: '1px' } }, 'Retirer'),
                ),
                h('div', { class: 'tiny muted', style: { marginTop: '8px' } }, loanSummary(l)),
              ),
            ))),
      ),
    ),

    level !== 'easy' && h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Subventions'), h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-sm', onClick: () => push('grants', { id: uid('grt'), label: 'Subvention', amount: 30000, month: 3, months: 6 }, 'Ajout subvention') }, '＋ Subvention')),
      h('div', { class: 'card-body' },
        f.grants.length === 0
          ? h('p', { class: 'muted small', style: { margin: 0 } }, "Les subventions sont un produit d'exploitation : elles améliorent le résultat et viennent en déduction de l'assiette du crédit d'impôt recherche.")
          : h('div', {}, ...f.grants.map((g) => h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(130px,1.5fr) repeat(3, minmax(100px,1fr)) auto', gap: '10px', alignItems: 'end', marginBottom: '10px' } },
              textField({ label: 'Intitulé', value: g.label, onInput: (v, o) => setField('grants', g.id, { label: v }, o) }),
              numberField({ label: 'Montant', field: 'amount', value: g.amount, suffix: '€', onInput: (v) => setField('grants', g.id, { amount: v }) }),
              monthField({ label: 'Premier versement', value: g.month, startDate: r?.startDate, onInput: (v) => setField('grants', g.id, { month: v }) }),
              numberField({ label: 'Étalé sur', field: 'months', value: g.months, suffix: 'mois', onInput: (v) => setField('grants', g.id, { months: v }) }),
              h('button', { class: 'btn btn-sm btn-danger', onClick: () => drop('grants', g.id), style: { marginBottom: '1px' } }, 'Retirer'),
            ))),
      ),
    ),

    level === 'advanced' && h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Avances remboursables et comptes courants'), h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-sm', onClick: () => push('advances', { id: uid('adv'), label: 'Avance remboursable', amount: 50000, month: 3, repayStartMonth: 30, repayMonths: 24 }, 'Ajout avance') }, '＋ Avance')),
      h('div', { class: 'card-body' },
        f.advances.length === 0
          ? h('p', { class: 'muted small', style: { margin: 0 } }, "Une avance remboursable est un prêt sans intérêt à rembourser en cas de succès. Elle vient en déduction de l'assiette du CIR, puis y est réintégrée au fil des remboursements.")
          : h('div', {}, ...f.advances.map((a) => h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(120px,1.4fr) repeat(4, minmax(95px,1fr)) auto', gap: '10px', alignItems: 'end', marginBottom: '10px' } },
              textField({ label: 'Intitulé', value: a.label, onInput: (v, o) => setField('advances', a.id, { label: v }, o) }),
              numberField({ label: 'Montant', field: 'amount', value: a.amount, suffix: '€', onInput: (v) => setField('advances', a.id, { amount: v }) }),
              monthField({ label: 'Versement', value: a.month, startDate: r?.startDate, onInput: (v) => setField('advances', a.id, { month: v }) }),
              monthField({ label: 'Début remboursement', value: a.repayStartMonth, startDate: r?.startDate, onInput: (v) => setField('advances', a.id, { repayStartMonth: v }) }),
              numberField({ label: 'Étalé sur', field: 'months', value: a.repayMonths, suffix: 'mois', onInput: (v) => setField('advances', a.id, { repayMonths: v }) }),
              h('button', { class: 'btn btn-sm btn-danger', onClick: () => drop('advances', a.id), style: { marginBottom: '1px' } }, 'Retirer'),
            ))),
      ),
    ),

    r && level === 'advanced' && h('div', { class: 'card mt' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Plan de financement'), helpButton('planFinancement')),
      h('div', { class: 'table-wrap' }, financingPlanTable(r)),
    ),
  )

  function pushAt(key, item) { store.update((sc) => sc.financing[key].push(item), { label: 'Apport' }); refresh() }
  function removeAt(key, i) { store.update((sc) => sc.financing[key].splice(i, 1), { label: 'Suppression' }); refresh() }
  function updateAt(key, i, patch) { store.update((sc) => Object.assign(sc.financing[key][i], patch), { label: 'Apport' }) }

  function block(title, hint, items, key, renderItem, onAdd) {
    return h('div', { class: 'card mb' },
      h('div', { class: 'card-head' }, h('h2', {}, title), h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-sm', onClick: onAdd }, '＋ Ajouter')),
      h('div', { class: 'card-body' },
        items.length === 0
          ? h('p', { class: 'muted small', style: { margin: 0 } }, hint)
          : h('div', { class: 'stack' }, ...items.map(renderItem)),
        items.length > 0 && h('div', { class: 'note plain mt' }, `Total : `, h('strong', {}, euro(sum(items)))),
      ),
    )
  }
}

function financingPlanTable(r) {
  const p = r.fundingPlan
  const row = (label, key, cls) => h('tr', { class: cls || '' },
    h('td', {}, label), ...p.map((y) => h('td', { class: 'num' }, euro(y[key]))))
  return h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, `Année ${i + 1}`)))),
    h('tbody', {},
      h('tr', { class: 'section' }, h('td', { colspan: 6 }, 'Emplois')),
      row('Variation du besoin en fonds de roulement', 'bfrChange'),
      row('Investissements', 'capex'),
      row('Remboursements', 'repayment'),
      row('Total des emplois', 'uses', 'total'),
      h('tr', { class: 'section' }, h('td', { colspan: 6 }, 'Ressources')),
      row('Apports en capital', 'equity'),
      row('Emprunts', 'loans'),
      row('Subventions', 'grants'),
      row("Crédits d'impôt", 'credits'),
      row("Capacité d'autofinancement", 'caf'),
      row('Total des ressources', 'resources', 'total'),
      h('tr', { class: 'highlight' }, h('td', {}, 'Excédent de la période'), ...p.map((y) => h('td', { class: `num ${y.surplus < 0 ? 'neg' : 'pos'}` }, euro(y.surplus)))),
      h('tr', { class: 'total' }, h('td', {}, 'Excédent cumulé'), ...p.map((y) => h('td', { class: `num ${y.cumulative < 0 ? 'neg' : ''}` }, euro(y.cumulative)))),
    ),
  )
}

function loanSummary(l) {
  const principal = Number(l.amount) || 0
  const n = Math.max(1, Number(l.months) || 1)
  const rate = (Number(l.rate) || 0) / 12
  const payment = rate > 0 ? (principal * rate) / (1 - Math.pow(1 + rate, -n)) : principal / n
  const totalInterest = payment * n - principal
  return `Mensualité de ${euro(payment)} pendant ${n} mois, soit ${euro(totalInterest)} d'intérêts au total.`
}

function tile(label, value, sub, glossaryKey, tone) {
  return h('div', { class: `kpi ${tone || ''}` },
    h('span', { class: 'kpi-accent' }),
    h('div', { class: 'kpi-label' }, label, glossaryKey && helpButton(glossaryKey)),
    h('div', { class: 'kpi-value' }, value),
    h('div', { class: 'kpi-sub' }, sub),
  )
}

const sum = (arr) => (arr || []).reduce((a, x) => a + (Number(x.amount) || 0), 0)
