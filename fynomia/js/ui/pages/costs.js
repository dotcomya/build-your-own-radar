/** Charges externes et investissements. */

import { h, euro, pct, num, numberField, textField, selectField, switchField, monthField, helpButton, confirmDialog, tabs, pageBar } from '../dom.js'
import { newOpex, newCapex } from '../../state/schema.js'
import { OPEX_TEMPLATES } from '../../engine/engine.js'
import { donut, barChart, PALETTE, YEAR_CATEGORIES } from '../charts.js'
import { tutorial, stepBanner } from '../tutorial.js'
import { enableToggle } from '../dom.js'
import { journey } from '../../engine/journey.js'
import store from '../../state/store.js'

export function renderCosts(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const level = store.level

  const addFromTemplate = (tpl) => {
    store.update((sc) => sc.opex.push(newOpex({ label: tpl.label, mode: tpl.mode, monthlyAmount: tpl.monthlyAmount, perEmployee: tpl.perEmployee || 0, pctRevenue: tpl.pctRevenue || 0 })), { label: 'Ajout de charge' })
    refresh()
  }
  const addCustom = () => {
    store.update((sc) => sc.opex.push(newOpex()), { label: 'Ajout de charge' })
    refresh()
  }
  const addAllSuggested = () => {
    store.update((sc) => {
      for (const tpl of OPEX_TEMPLATES) {
        if (sc.opex.some((o) => o.label === tpl.label)) continue
        sc.opex.push(newOpex({ label: tpl.label, mode: tpl.mode, monthlyAmount: tpl.monthlyAmount, perEmployee: tpl.perEmployee || 0, pctRevenue: tpl.pctRevenue || 0 }))
      }
    }, { label: 'Charges courantes' })
    refresh()
  }

  const missing = OPEX_TEMPLATES.filter((t) => !s.opex.some((o) => o.label === t.label))

  const views = [
    { key: 'charges', label: 'Charges', count: s.opex.length },
    { key: 'invest', label: 'Investissements', count: s.capex.length },
    r && s.opex.length > 0 ? { key: 'repartition', label: 'Répartition' } : null,
  ]
  const view = views.some((v) => v && v.key === renderCosts.view) ? renderCosts.view : 'charges'
  renderCosts.view = view

  const addCapex = () => { store.update((sc) => sc.capex.push(newCapex()), { label: "Ajout d'investissement" }); refresh() }
  const monthlyTotal = s.opex.filter((o) => o.enabled !== false).reduce((a, o) => a + (Number(o.monthlyAmount) || 0), 0)

  return h('div', { class: 'content' },
    stepBanner('charges', journey(store.scenario, store.result), navigate, 'achats'),

    pageBar(
      view === 'invest' ? 'Investissements' : 'Charges de fonctionnement',
      view === 'invest'
        ? "Le matériel durable n'est pas une charge de l'année : son coût s'étale sur sa durée d'usage."
        : `${euro(monthlyTotal)} par mois, soit ${euro(monthlyTotal * 12)} par an`,
      view === 'charges' ? h('button', { class: 'btn btn-primary btn-sm', onClick: addCustom }, '＋ Ajouter une charge') : null,
      view === 'invest' ? h('button', { class: 'btn btn-primary btn-sm', onClick: addCapex }, '＋ Ajouter un investissement') : null,
    ),

    tabs(views, view, (k) => { renderCosts.view = k; refresh() }),

    view === 'charges' ? h('div', { class: 'view' },
      s.opex.length === 0
        ? h('div', { class: 'card' }, h('div', { class: 'empty' },
            h('div', { class: 'empty-icon' }, '▦'),
            h('h3', {}, 'Aucune charge saisie'),
            h('p', { class: 'muted', style: { maxWidth: '54ch', margin: '0 auto 4px' } },
              "Fynomia propose une liste de charges courantes calibrée sur des jeunes entreprises françaises. Ajoute-les d'un clic, puis ajustez les montants."),
            h('button', { class: 'btn btn-primary mt', onClick: addAllSuggested }, `Ajouter les ${OPEX_TEMPLATES.length} charges courantes`),
          ))
        : h('div', {}, ...s.opex.map((o) => opexRow(o, r, level, refresh))),

      missing.length > 0 ? h('div', { class: 'suggest' },
        h('span', { class: 'suggest-tag' }, 'Souvent oublié'),
        ...missing.slice(0, 6).map((t) => h('button', { class: 'suggest-chip', onClick: () => addFromTemplate(t) }, `＋ ${t.label}`)),
      ) : null,
    ) : null,

    view === 'invest' ? h('div', { class: 'view' }, capexSection(s, r, level, refresh)) : null,

    view === 'repartition' && r ? h('div', { class: 'view' },
      h('div', { class: 'board-pair' },
        h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h2', {}, 'Répartition des charges'), h('span', { class: 'spacer' }), h('span', { class: 'tiny muted' }, 'Année 1')),
          h('div', { class: 'card-body' },
            donut({ items: r.opex.perItem.map((i, idx) => ({ label: i.label, value: i.yearly[0], color: PALETTE[idx % PALETTE.length] })) }),
          ),
        ),
        h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h2', {}, 'Évolution')),
          h('div', { class: 'card-body' },
            barChart({ categories: YEAR_CATEGORIES, series: [{ label: 'Charges externes', values: r.opex.yearly, color: PALETTE[2] }] }),
            h('div', { class: 'note plain mt' },
              `Ces charges représentent ${pct(r.pnl.revenue[0] > 0 ? r.opex.yearly[0] / r.pnl.revenue[0] : 0, 0)} du chiffre d'affaires en année 1. Combinées à la masse salariale, elles fixent ton point mort à ${r.kpis.breakEven[0] ? euro(r.kpis.breakEven[0]) : '—'}.`),
          ),
        ),
      ),
    ) : null,

    tutorial('charges', navigate),
  )
}

/**
 * Une charge, sur une ligne.
 *
 * Chaque poste occupait une carte entière avec quatre champs déployés : dix
 * charges, et la page devenait un rouleau. Une charge, c'est un nom et un
 * montant — le reste (mode de calcul, dates, R&D) se déplie à la demande, et
 * la plupart du temps on n'en a pas besoin.
 */
function opexRow(o, r, level, refresh) {
  const set = (patch, opts = {}) => store.update((sc) => Object.assign(sc.opex.find((x) => x.id === o.id), patch), { label: 'Modification de charge', ...opts })
  const detail = r?.opex.perItem.find((x) => x.id === o.id)
  const on = o.enabled !== false
  const open = opexRow.open || (opexRow.open = new Set())
  const isOpen = open.has(o.id)
  const annual = opexRow.annual || (opexRow.annual = new Set())
  const yearly = annual.has(o.id)

  const remove = async () => {
    if (await confirmDialog({ title: 'Supprimer cette charge ?', message: `« ${o.label} » sera retirée.`, confirmLabel: 'Supprimer', danger: true })) {
      store.update((sc) => { sc.opex = sc.opex.filter((x) => x.id !== o.id) }, { label: 'Suppression de charge' })
      refresh()
    }
  }

  return h('div', { class: `cost-row ${on ? '' : 'is-off'} ${isOpen ? 'open' : ''}` },
    h('div', { class: 'cost-line' },
      enableToggle(on, (v) => { set({ enabled: v }, { label: v ? 'Charge réactivée' : 'Charge en pause' }); refresh() }),

      h('input', {
        class: 'cost-label', value: o.label, 'aria-label': 'Nom de la charge',
        onInput: (e) => set({ label: e.target.value }, { silent: true }),
      }),

      // Le montant et son unité se lisent et se changent sur la ligne. Cacher
      // « par an » ou « % du CA » derrière trois points obligeait à ouvrir
      // chaque charge pour savoir ce qu'on regardait.
      h('div', { class: 'cost-amount' },
        h('input', {
          class: 'num', inputmode: 'decimal',
          value: yearly ? String(Math.round((Number(o.monthlyAmount) || 0) * 12) || '') : String(o.monthlyAmount ?? ''),
          'aria-label': yearly ? 'Montant annuel' : 'Montant mensuel',
          onInput: (e) => {
            const v = Number(e.target.value.replace(',', '.')) || 0
            set({ monthlyAmount: yearly ? v / 12 : v }, { silent: true })
          },
        }),
        h('button', {
          class: 'cost-unit', title: yearly ? 'Saisir un montant mensuel' : 'Saisir un montant annuel',
          onClick: () => { yearly ? annual.delete(o.id) : annual.add(o.id); refresh() },
        }, yearly ? '€/an' : '€/mois'),
      ),

      h('div', { class: 'cost-mode' },
        (() => {
          const sel = h('select', { 'aria-label': 'Mode de calcul' },
            ...[
              { value: 'fixed', label: 'montant fixe' },
              { value: 'perEmployee', label: '+ par salarié' },
              { value: 'pctRevenue', label: "+ % du CA" },
            ].map((opt) => h('option', { value: opt.value, selected: o.mode === opt.value || null }, opt.label)),
          )
          sel.addEventListener('change', () => { set({ mode: sel.value }); refresh() })
          return sel
        })(),
      ),

      o.mode === 'perEmployee' ? h('div', { class: 'cost-extra' },
        h('input', {
          class: 'num', inputmode: 'decimal', value: String(o.perEmployee ?? ''), 'aria-label': 'Montant par salarié',
          onInput: (e) => set({ perEmployee: Number(e.target.value.replace(',', '.')) || 0 }, { silent: true }),
        }),
        h('span', {}, '€/sal.'),
      ) : null,

      o.mode === 'pctRevenue' ? h('div', { class: 'cost-extra' },
        h('input', {
          class: 'num', inputmode: 'decimal', value: String(Math.round((Number(o.pctRevenue) || 0) * 1000) / 10), 'aria-label': 'Part du chiffre d\'affaires',
          onInput: (e) => set({ pctRevenue: (Number(e.target.value.replace(',', '.')) || 0) / 100 }, { silent: true }),
        }),
        h('span', {}, '% du CA'),
      ) : null,

      detail ? h('span', { class: 'cost-year num' }, `${euro(detail.yearly[0], { compact: true })}/an`) : null,

      h('button', {
        class: 'cost-more', title: 'Dates et recherche',
        onClick: () => { isOpen ? open.delete(o.id) : open.add(o.id); refresh() },
      }, '\u22EF'),
      h('button', {
        class: 'cost-more cost-drop', title: 'Supprimer cette charge', onClick: remove,
      }, '\u00d7'),
    ),

    isOpen && h('div', { class: 'cost-detail' },
      h('div', { class: 'grid grid-3' },
        monthField({ label: 'À partir de', value: o.startMonth, startDate: r?.startDate, onInput: (v) => set({ startMonth: v }) }),
        monthField({ label: "Jusqu'à", value: o.endMonth, startDate: r?.startDate, allowEmpty: true, onInput: (v) => set({ endMonth: v }) }),
      ),
      h('div', { class: 'row-wrap mt' },
        level === 'advanced' && h('label', { class: 'switch' },
          (() => { const i = h('input', { type: 'checkbox', checked: !!o.rdApproved }); i.addEventListener('change', () => set({ rdApproved: i.checked })); return i })(),
          h('span', { class: 'track' }),
          h('span', { class: 'small' }, 'Dépense de recherche (CIR)'),
        ),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-sm btn-danger', onClick: remove }, 'Supprimer'),
      ),
    ),
  )
}


function capexSection(s, r, level, refresh) {
  if (level === 'easy' && s.capex.length === 0) {
    return h('div', { class: 'note plain mt' },
      h('div', { class: 'note-title' }, 'Investissements'),
      "Passe en niveau Intermédiaire pour ajouter du matériel, des aménagements ou du crédit-bail, et suivre leur amortissement.")
  }
  return h('div', {},
    s.capex.length === 0
      ? h('p', { class: 'view-intro' }, "Aucun investissement. La trésorerie sort en une fois, le résultat est impacté progressivement par l'amortissement.")
      : null,
    ...s.capex.map((c) => capexRow(c, r, level, refresh)),

    r && s.capex.length > 0 && h('div', { class: 'card mt' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Amortissements'), helpButton('ebit')),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Investissement'), h('th', {}, 'Montant'), h('th', {}, 'Acquisition'), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, `A${i + 1}`)))),
          h('tbody', {},
            ...r.capex.perItem.filter((i) => i.amount > 0).map((i) => h('tr', {},
              h('td', {}, i.label),
              h('td', { class: 'num' }, euro(i.amount)),
              h('td', { class: 'num muted' }, `M${i.month + 1}`),
              ...i.yearly.map((v) => h('td', { class: 'num' }, v > 0 ? euro(v) : '—')),
            )),
            h('tr', { class: 'total' },
              h('td', {}, 'Dotation totale'), h('td', {}, ''), h('td', {}, ''),
              ...r.capex.yearly.map((v) => h('td', { class: 'num' }, euro(v))),
            ),
          ),
        ),
      ),
    ),
  )
}

function capexRow(c, r, level, refresh) {
  const set = (patch, opts = {}) => store.update((sc) => Object.assign(sc.capex.find((x) => x.id === c.id), patch), { label: 'Modification investissement', ...opts })
  const remove = async () => {
    if (await confirmDialog({ title: 'Supprimer cet investissement ?', message: `« ${c.label} » sera retiré.`, confirmLabel: 'Supprimer', danger: true })) {
      store.update((sc) => { sc.capex = sc.capex.filter((x) => x.id !== c.id) }, { label: 'Suppression' })
      refresh()
    }
  }
  return h('div', { class: 'card', style: { marginBottom: '9px' } },
    h('div', { class: 'card-body tight' },
      h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(150px,2fr) repeat(3, minmax(110px,1fr)) auto', alignItems: 'end', gap: '10px' } },
        textField({ label: 'Intitulé', value: c.label, onInput: (v, opt) => set({ label: v }, opt) }),
        numberField({ label: 'Montant', field: 'amount', value: c.amount, suffix: '€ HT', onInput: (v) => set({ amount: v }) }),
        monthField({ label: "Mois d'achat", value: c.month, startDate: r?.startDate, onInput: (v) => set({ month: v }) }),
        numberField({ label: 'Amortissement', field: 'amortYears', value: c.amortYears, suffix: 'ans', hint: '0 = non amortissable', onInput: (v) => set({ amortYears: v }) }),
        h('button', { class: 'btn btn-sm btn-danger', onClick: remove, style: { marginBottom: '1px' } }, 'Retirer'),
      ),
      level === 'advanced' && h('div', { class: 'grid grid-4 mt' },
        switchField({ label: 'Crédit-bail', checked: c.leasing, hint: "Loyer en charges plutôt qu'immobilisation.", onInput: (v) => set({ leasing: v }) }),
        c.leasing && numberField({ label: 'Loyer mensuel', field: 'monthlyAmount', value: c.leaseMonthly, suffix: '€/mois', onInput: (v) => set({ leaseMonthly: v }) }),
        c.leasing && numberField({ label: 'Durée du bail', field: 'months', value: c.leaseMonths, suffix: 'mois', onInput: (v) => set({ leaseMonths: v }) }),
        !c.leasing && numberField({ label: 'Usage en recherche', field: 'rdShare', value: c.rdShare, percent: true, hint: "Compte dans l'assiette du CIR.", onInput: (v) => set({ rdShare: v }) }),
        !c.leasing && switchField({ label: 'Apport en nature', checked: c.contribution, hint: 'Apporté au capital, sans sortie de trésorerie.', onInput: (v) => set({ contribution: v }) }),
      ),
      c.amortYears > 0 && !c.leasing && h('div', { class: 'tiny muted', style: { marginTop: '8px' } },
        `Soit ${euro((Number(c.amount) || 0) / (Number(c.amortYears) * 12))} de charge par mois pendant ${c.amortYears} an${c.amortYears > 1 ? 's' : ''}, alors que la trésorerie sort intégralement au mois ${(Number(c.month) || 0) + 1}.`),
    ),
  )
}
