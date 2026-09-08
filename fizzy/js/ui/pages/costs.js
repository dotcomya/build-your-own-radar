/** Charges externes et investissements. */

import { h, euro, pct, num, numberField, textField, selectField, switchField, monthField, helpButton, confirmDialog } from '../dom.js'
import { newOpex, newCapex } from '../../state/schema.js'
import { OPEX_TEMPLATES } from '../../engine/engine.js'
import { donut, barChart, PALETTE, YEAR_CATEGORIES } from '../charts.js'
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

  return h('div', { class: 'content' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'Charges de fonctionnement'),
      h('p', {}, "Tout ce que vous payez indépendamment du volume vendu : loyer, assurances, logiciels, honoraires. Ces charges déterminent votre point mort."),
    ),

    s.opex.length === 0 && h('div', { class: 'card mb' },
      h('div', { class: 'empty' },
        h('div', { class: 'empty-icon' }, '▦'),
        h('h3', {}, 'Aucune charge saisie'),
        h('p', { class: 'muted', style: { maxWidth: '54ch', margin: '0 auto 4px' } },
          "Fizzy propose une liste de charges courantes calibrée sur des jeunes entreprises françaises. Ajoutez-les d'un clic, puis ajustez les montants."),
        h('button', { class: 'btn btn-primary mt', onClick: addAllSuggested }, `Ajouter les ${OPEX_TEMPLATES.length} charges courantes`),
      ),
    ),

    ...s.opex.map((o) => opexRow(o, r, level, refresh)),

    h('div', { class: 'row-wrap mt' },
      h('button', { class: 'btn', onClick: addCustom }, '＋ Charge sur mesure'),
      ...missing.slice(0, 5).map((t) => h('button', { class: 'btn btn-sm btn-ghost', onClick: () => addFromTemplate(t) }, `+ ${t.label}`)),
    ),

    r && s.opex.length > 0 && h('div', { class: 'grid grid-2 mt' },
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', {}, 'Répartition des charges'), h('span', { class: 'tiny muted' }, 'Année 1')),
        h('div', { class: 'card-body' },
          donut({ items: r.opex.perItem.map((i, idx) => ({ label: i.label, value: i.yearly[0], color: PALETTE[idx % PALETTE.length] })) }),
        ),
      ),
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', {}, 'Évolution')),
        h('div', { class: 'card-body' },
          barChart({ categories: YEAR_CATEGORIES, series: [{ label: 'Charges externes', values: r.opex.yearly, color: PALETTE[2] }] }),
          h('div', { class: 'note plain mt' },
            `Ces charges représentent ${pct(r.pnl.revenue[0] > 0 ? r.opex.yearly[0] / r.pnl.revenue[0] : 0, 0)} du chiffre d'affaires en année 1. Combinées à la masse salariale, elles fixent votre point mort à ${r.kpis.breakEven[0] ? euro(r.kpis.breakEven[0]) : '—'}.`),
        ),
      ),
    ),

    capexSection(s, r, level, refresh),
  )
}

function opexRow(o, r, level, refresh) {
  const set = (patch, opts = {}) => store.update((sc) => Object.assign(sc.opex.find((x) => x.id === o.id), patch), { label: 'Modification de charge', ...opts })
  const detail = r?.opex.perItem.find((x) => x.id === o.id)
  const remove = async () => {
    if (await confirmDialog({ title: 'Supprimer cette charge ?', message: `« ${o.label} » sera retirée.`, confirmLabel: 'Supprimer', danger: true })) {
      store.update((sc) => { sc.opex = sc.opex.filter((x) => x.id !== o.id) }, { label: 'Suppression de charge' })
      refresh()
    }
  }
  return h('div', { class: 'card', style: { marginBottom: '9px' } },
    h('div', { class: 'card-body tight' },
      h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(150px,2fr) minmax(130px,1.3fr) minmax(120px,1fr) auto', alignItems: 'end', gap: '10px' } },
        textField({ label: 'Poste', value: o.label, onInput: (v, opt) => set({ label: v }, opt) }),
        selectField({
          label: 'Mode de calcul', value: o.mode,
          options: [
            { value: 'fixed', label: 'Montant fixe mensuel' },
            { value: 'perEmployee', label: 'Fixe + par salarié' },
            { value: 'pctRevenue', label: 'Fixe + % du CA' },
          ],
          onInput: (v) => set({ mode: v }),
        }),
        numberField({ label: 'Montant fixe', field: 'monthlyAmount', value: o.monthlyAmount, suffix: '€/mois', onInput: (v) => set({ monthlyAmount: v }) }),
        h('button', { class: 'btn btn-sm btn-danger', onClick: remove, style: { marginBottom: '1px' } }, 'Retirer'),
      ),
      (o.mode === 'perEmployee' || o.mode === 'pctRevenue' || level === 'advanced') && h('div', { class: 'grid grid-3 mt' },
        o.mode === 'perEmployee' && numberField({ label: 'Par salarié', field: 'perEmployee', value: o.perEmployee, suffix: '€/mois', onInput: (v) => set({ perEmployee: v }) }),
        o.mode === 'pctRevenue' && numberField({ label: "Part du chiffre d'affaires", field: 'pctRevenue', value: o.pctRevenue, percent: true, onInput: (v) => set({ pctRevenue: v }) }),
        level === 'advanced' && monthField({ label: 'À partir de', value: o.startMonth, startDate: r?.startDate, onInput: (v) => set({ startMonth: v }) }),
        level === 'advanced' && monthField({ label: "Jusqu'à", value: o.endMonth, startDate: r?.startDate, allowEmpty: true, onInput: (v) => set({ endMonth: v }) }),
      ),
      detail && h('div', { class: 'row', style: { marginTop: '9px', fontSize: '12.5px', color: 'var(--ink-500)' } },
        h('span', {}, `Année 1 : `, h('strong', { class: 'num' }, euro(detail.yearly[0]))),
        h('span', {}, `· Année 5 : `, h('strong', { class: 'num' }, euro(detail.yearly[4]))),
        h('span', { class: 'spacer' }),
        level === 'advanced' && h('label', { class: 'switch' },
          (() => { const i = h('input', { type: 'checkbox', checked: !!o.rdApproved }); i.addEventListener('change', () => set({ rdApproved: i.checked })); return i })(),
          h('span', { class: 'track' }), h('span', { class: 'tiny' }, 'Sous-traitance R&D agréée')),
      ),
    ),
  )
}

function capexSection(s, r, level, refresh) {
  if (level === 'easy' && s.capex.length === 0) {
    return h('div', { class: 'note plain mt' },
      h('div', { class: 'note-title' }, 'Investissements'),
      "Passez en niveau Intermédiaire pour ajouter du matériel, des aménagements ou du crédit-bail, et suivre leur amortissement.")
  }
  const add = () => { store.update((sc) => sc.capex.push(newCapex()), { label: 'Ajout d\'investissement' }); refresh() }

  return h('div', { style: { marginTop: '32px' } },
    h('div', { class: 'page-head' },
      h('h2', { style: { fontSize: '21px' } }, 'Investissements'),
      h('p', {}, "Le matériel durable n'est pas une charge de l'année : son coût est étalé sur sa durée d'usage. La trésorerie sort en une fois, le résultat est impacté progressivement."),
    ),
    ...s.capex.map((c) => capexRow(c, r, level, refresh)),
    h('button', { class: 'btn btn-block mt', onClick: add }, '＋ Ajouter un investissement'),

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
