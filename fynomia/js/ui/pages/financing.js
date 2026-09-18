/** Financement : capital, emprunts, subventions, avances. */

import { h, euro, num, pct, numberField, textField, monthField, helpButton, confirmDialog, monthLabel, tabs, pageBar, moduleHead } from '../dom.js'
import { uid } from '../../state/schema.js'
import { areaChart, barChart, PALETTE, YEAR_CATEGORIES, STATUS } from '../charts.js'
import { tutorial, stepBanner } from '../tutorial.js'
import { journey } from '../../engine/journey.js'
import { todoPanel } from '../todo.js'
import { claim } from '../spotlight.js'
import store from '../../state/store.js'

/**
 * Les sources de financement.
 *
 * Chaque source avait sa carte, empilée sous la précédente : six blocs, la
 * plupart vides, et il fallait dérouler la page entière pour voir ce qu'on
 * avait réuni. Elles tiennent désormais dans une grille de tuiles — une par
 * source, avec son montant — et le détail s'ouvre sous celle qu'on choisit.
 */
const SOURCES = [
  {
    key: 'equityFounders', label: 'Apport des fondateurs', glyph: '\u25c8', level: 'easy',
    hint: "Ce que toi et tes associ\u00e9s mettez au capital. C'est l'apport que toute banque regarde en premier.",
    make: () => ({ id: uid('eqf'), month: 0, amount: 10000 }),
    fields: [
      { k: 'amount', label: 'Montant', suffix: '\u20ac', type: 'number' },
      { k: 'month', label: 'Mois', type: 'month' },
    ],
  },
  {
    key: 'loans', label: 'Emprunt bancaire', glyph: '\u25ce', level: 'easy',
    hint: "Un pr\u00eat finance en g\u00e9n\u00e9ral les investissements durables, rarement le besoin en fonds de roulement.",
    make: () => ({ id: uid('loan'), label: 'Pr\u00eat bancaire', amount: 50000, month: 0, rate: 0.04, months: 60, graceMonths: 0 }),
    fields: [
      { k: 'label', label: 'Intitul\u00e9', type: 'text' },
      { k: 'amount', label: 'Montant', suffix: '\u20ac', type: 'number' },
      { k: 'rate', label: 'Taux annuel', type: 'percent', step: 0.1 },
      { k: 'months', label: 'Dur\u00e9e', suffix: 'mois', type: 'number' },
      { k: 'month', label: 'D\u00e9blocage', type: 'month' },
    ],
    note: (l) => loanSummary(l),
  },
  {
    key: 'grants', label: 'Subvention', glyph: '\u25c7', level: 'easy',
    hint: "Une subvention est un produit d'exploitation : elle am\u00e9liore le r\u00e9sultat et vient en d\u00e9duction de l'assiette du cr\u00e9dit d'imp\u00f4t recherche.",
    make: () => ({ id: uid('grt'), label: 'Subvention', amount: 30000, month: 3, months: 6 }),
    fields: [
      { k: 'label', label: 'Intitul\u00e9', type: 'text' },
      { k: 'amount', label: 'Montant', suffix: '\u20ac', type: 'number' },
      { k: 'month', label: 'Premier versement', type: 'month' },
      { k: 'months', label: '\u00c9tal\u00e9 sur', suffix: 'mois', type: 'number' },
    ],
  },
  {
    key: 'equityInvestors', label: 'Lev\u00e9e de fonds', glyph: '\u25b3', level: 'intermediate',
    hint: "Capital apport\u00e9 par des investisseurs ext\u00e9rieurs, en \u00e9change de parts.",
    make: () => ({ id: uid('eqi'), month: 6, amount: 250000 }),
    fields: [
      { k: 'amount', label: 'Montant', suffix: '\u20ac', type: 'number' },
      { k: 'month', label: 'Mois', type: 'month' },
    ],
  },
  {
    key: 'shareholderLoans', label: "Compte courant d'associ\u00e9", glyph: '\u25a1', level: 'intermediate',
    hint: "De l'argent que tu pr\u00eates \u00e0 ta soci\u00e9t\u00e9 et qui te sera rendu. Ce n'est pas du capital : \u00e7a n'entre pas dans les fonds propres.",
    make: () => ({ id: uid('cca'), label: 'Compte courant', amount: 20000, month: 0, repayMonth: '' }),
    fields: [
      { k: 'label', label: 'Intitul\u00e9', type: 'text' },
      { k: 'amount', label: 'Montant', suffix: '\u20ac', type: 'number' },
      { k: 'month', label: 'Versement', type: 'month' },
      { k: 'repayMonth', label: 'Remboursement', type: 'month', allowEmpty: true },
    ],
  },
  {
    key: 'advances', label: 'Avance remboursable', glyph: '\u25b7', level: 'advanced',
    hint: "Un pr\u00eat sans int\u00e9r\u00eat \u00e0 rembourser en cas de succ\u00e8s. Elle vient en d\u00e9duction de l'assiette du CIR, puis y est r\u00e9int\u00e9gr\u00e9e au fil des remboursements.",
    make: () => ({ id: uid('adv'), label: 'Avance remboursable', amount: 50000, month: 3, repayStartMonth: 30, repayMonths: 24 }),
    fields: [
      { k: 'label', label: 'Intitul\u00e9', type: 'text' },
      { k: 'amount', label: 'Montant', suffix: '\u20ac', type: 'number' },
      { k: 'month', label: 'Versement', type: 'month' },
      { k: 'repayStartMonth', label: 'D\u00e9but du remboursement', type: 'month' },
      { k: 'repayMonths', label: '\u00c9tal\u00e9 sur', suffix: 'mois', type: 'number' },
    ],
  },
]

const LEVEL_RANK = { easy: 0, intermediate: 1, advanced: 2 }

export function renderFinancing(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const f = s.financing
  const level = store.level

  const visible = SOURCES.filter((src) => LEVEL_RANK[src.level] <= LEVEL_RANK[level])
  const picked = renderFinancing.picked && visible.some((x) => x.key === renderFinancing.picked)
    ? renderFinancing.picked
    : (visible.find((src) => (f[src.key] || []).length > 0) || visible[0]).key
  renderFinancing.picked = picked
  const source = visible.find((x) => x.key === picked)

  const totalRaised = SOURCES.reduce((acc, src) => acc + sum(f[src.key]), 0)

  const add = (src) => {
    store.update((sc) => { (sc.financing[src.key] = sc.financing[src.key] || []).push(src.make()) }, { label: `Ajout : ${src.label}` })
    renderFinancing.picked = src.key
    refresh()
  }
  const drop = (key, id) => {
    store.update((sc) => { sc.financing[key] = sc.financing[key].filter((x) => x.id !== id) }, { label: 'Suppression' })
    refresh()
  }

  /**
   * Activer ou désactiver une source.
   *
   * La tuile est un interrupteur : une source sert, ou elle ne sert pas.
   * Désactiver ne jette rien — les lignes sont mises de côté dans le scénario
   * et reviennent telles quelles à la réactivation. Un emprunt qu'on éteint
   * pour voir l'effet sur la trésorerie ne doit pas coûter sa ressaisie.
   */
  const toggle = (src) => {
    const on = (f[src.key] || []).length > 0
    store.update((sc) => {
      const paused = (sc.financing.paused = sc.financing.paused || {})
      if (on) {
        paused[src.key] = sc.financing[src.key]
        sc.financing[src.key] = []
      } else {
        sc.financing[src.key] = (paused[src.key] || []).length ? paused[src.key] : [src.make()]
        delete paused[src.key]
      }
    }, { label: on ? `Sans ${src.label.toLowerCase()}` : `Avec ${src.label.toLowerCase()}` })
    if (!on) renderFinancing.picked = src.key
    refresh()
  }
  const setField = (key, id, patch, opts = {}) =>
    store.update((sc) => Object.assign(sc.financing[key].find((x) => x.id === id), patch), { label: 'Financement', ...(opts || {}) })

  const views = [
    { key: 'sources', label: 'Sources', count: SOURCES.reduce((a, src) => a + ((f[src.key] || []).length), 0) },
    r ? { key: 'tresorerie', label: 'Trésorerie' } : null,
    r ? { key: 'plan', label: 'Plan de financement' } : null,
  ]
  const want = claim('financement')
  if (want && want.view) renderFinancing.view = want.view
  const view = views.some((v) => v && v.key === renderFinancing.view) ? renderFinancing.view : 'sources'
  renderFinancing.view = view

  return h('div', { class: 'content' },

    moduleHead('05', 'Financement', "Ce que tu r\u00e9unis, et ce qu\u2019il manque au point bas de tr\u00e9sorerie."),

    stepBanner('financement', journey(store.scenario, store.result), navigate, 'financement'),

    pageBar(
      'Financement',
      r && r.kpis.fundingNeed > 0
        ? `${euro(totalRaised, { compact: true })} réunis · il manque ${euro(r.kpis.fundingNeed)} avant ${monthLabel(r.kpis.cashLow.month, r.startDate)}`
        : `${euro(totalRaised, { compact: true })} réunis · trésorerie couverte`,
      view === 'sources' && source && (f[source.key] || []).length
        ? h('button', { class: 'btn btn-primary btn-sm', onClick: () => add(source) }, `＋ Une ligne de plus`) : null,
    ),

    tabs(views, view, (k) => { renderFinancing.view = k; refresh() }),

    view === 'sources' ? h('div', { class: 'view' },
      h('div', { class: 'sources', 'data-gap': 'sources' },
        h('div', { class: 'source source-cash' },
          h('span', { class: 'source-glyph' }, '●'),
          h('span', { class: 'source-name' }, 'Déjà en caisse'),
          (() => {
            const input = h('input', {
              class: 'num source-input', inputmode: 'decimal', value: String(f.openingCash ?? 0),
              'aria-label': 'Trésorerie de départ',
              onInput: (e) => store.update((sc) => { sc.financing.openingCash = Number(e.target.value.replace(',', '.')) || 0 }, { label: 'Trésorerie initiale', silent: true }),
            })
            return h('label', { class: 'source-money' }, input, h('span', {}, '€'))
          })(),
        ),
        // Chaque source s'ajoute et se retire depuis sa tuile : ouvrir le détail
        // pour supprimer une ligne obligeait à dérouler la page à chaque essai.
        ...visible.map((src) => {
          const items = f[src.key] || []
          const total = sum(items)
          const on = items.length > 0
          return h('div', {
            class: `source ${picked === src.key ? 'is-open' : ''} ${on ? 'is-on' : ''}`,
            role: 'button', tabindex: '0',
            onClick: () => { if (on) { renderFinancing.picked = src.key; refresh() } else toggle(src) },
            onKeydown: (e) => { if (e.key === 'Enter') { if (on) { renderFinancing.picked = src.key; refresh() } else toggle(src) } },
          },
            h('span', { class: 'source-glyph' }, src.glyph),
            h('span', { class: 'source-name' }, src.label),
            h('span', { class: 'source-value num' }, on ? euro(total, { compact: true }) : '—'),
            items.length > 1 ? h('span', { class: 'source-count' }, `${items.length} lignes`) : null,
            // Un seul bouton : « + » quand la source est éteinte, « − » quand
            // elle sert. Deux boutons demandaient de comprendre la différence
            // entre « ajouter une ligne » et « utiliser cette source ».
            h('span', { class: 'source-acts' },
              h('button', {
                class: `source-act ${on ? 'is-off' : 'is-on'}`,
                title: on ? `Ne pas utiliser : ${src.label.toLowerCase()}` : `Utiliser : ${src.label.toLowerCase()}`,
                'aria-label': on ? `Désactiver ${src.label}` : `Activer ${src.label}`,
                onClick: (e) => { e.stopPropagation(); toggle(src) },
              }, on ? '−' : '＋'),
            ),
          )
        }),
      ),
      source && (f[source.key] || []).length ? sourceDetail(source, f[source.key], r, { add, drop, setField }) : null,
    ) : null,

    view === 'tresorerie' && r ? h('div', { class: 'view' },
      h('div', { class: 'grid grid-4 kpis mb' },
        tile('Financements réunis', euro(totalRaised, { compact: true }), 'Tous apports confondus'),
        tile('Besoin identifié', r.kpis.fundingNeed > 0 ? euro(r.kpis.fundingNeed, { compact: true }) : 'Couvert',
          r.kpis.fundingNeed > 0 ? `Point bas ${monthLabel(r.kpis.cashLow.month, r.startDate)}` : 'Trésorerie positive', 'tresorerie',
          r.kpis.fundingNeed > 0 ? 'neg' : 'pos'),
        tile('Fin année 1', euro(r.cash.yearEnd[0], { compact: true }), 'Solde au 12ᵉ mois', null, r.cash.yearEnd[0] >= 0 ? 'pos' : 'neg'),
        tile('Autonomie', r.kpis.runwayMonths === null ? '—' : `${num(r.kpis.runwayMonths, 0)} mois`, 'Au rythme actuel', 'runway',
          r.kpis.runwayMonths !== null && r.kpis.runwayMonths < 6 ? 'neg' : ''),
      ),
      h('div', { class: 'card' },
        h('div', { class: 'card-body' },
          areaChart({ values: r.cash.balance, startDate: r.startDate, color: r.kpis.fundingNeed > 0 ? STATUS.warn : STATUS.gain }),
          r.kpis.fundingNeed > 0 ? h('div', { class: 'note warn mt' },
            h('div', { class: 'note-title' }, `Il manque ${euro(r.kpis.fundingNeed)}`),
            `Ton solde atteint son point bas en ${monthLabel(r.kpis.cashLow.month, r.startDate)}. Trois leviers : ajouter une source, négocier des acomptes clients plus élevés dans l'onglet Offre, ou décaler des recrutements et investissements.`) : null,
        ),
      ),
    ) : null,

    view === 'plan' && r ? h('div', { class: 'view' },
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', {}, 'Plan de financement'), helpButton('planFinancement')),
        h('div', { class: 'table-wrap' }, financingPlanTable(r)),
      ),
    ) : null,

    todoPanel('financement', store.scenario, navigate),

    tutorial('financement', navigate),
  )
}

/** Le d\u00e9tail d'une source : ses lignes, et rien d'autre \u00e0 l'\u00e9cran. */
function sourceDetail(src, items, r, { add, drop, setField }) {
  return h('div', { class: 'card mb' },
    h('div', { class: 'card-head' },
      h('h2', {}, src.label),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn-sm', onClick: () => add(src) }, '\uff0b Ajouter'),
    ),
    h('div', { class: 'card-body' },
      h('p', { class: 'muted small', style: { margin: '0 0 12px', maxWidth: '78ch' } }, src.hint),
      items.length === 0
        ? h('p', { class: 'muted small', style: { margin: 0 } }, 'Aucune ligne pour cette source.')
        : h('div', { class: 'stack' }, ...items.map((item) => h('div', { class: 'source-line' },
            h('div', { class: 'source-fields' },
              ...src.fields.map((fd) => {
                const common = { label: fd.label, value: item[fd.k] }
                if (fd.type === 'text') return textField({ ...common, onInput: (v, o) => setField(src.key, item.id, { [fd.k]: v }, o) })
                if (fd.type === 'month') return monthField({ ...common, startDate: r?.startDate, allowEmpty: !!fd.allowEmpty, onInput: (v) => setField(src.key, item.id, { [fd.k]: v }) })
                if (fd.type === 'percent') return numberField({ ...common, field: 'rate', percent: true, step: fd.step, onInput: (v) => setField(src.key, item.id, { [fd.k]: v }) })
                return numberField({ ...common, field: 'amount', suffix: fd.suffix, onInput: (v) => setField(src.key, item.id, { [fd.k]: v }) })
              }),
              h('button', { class: 'btn btn-sm btn-danger', title: 'Retirer cette ligne', onClick: () => drop(src.key, item.id) }, '\u2212'),
            ),
            src.note && h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, src.note(item)),
          ))),
      items.length > 0 && h('div', { class: 'note plain mt' }, 'Total : ', h('strong', {}, euro(sum(items)))),
    ),
  )
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
