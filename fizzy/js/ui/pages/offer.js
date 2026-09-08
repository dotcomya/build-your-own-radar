/** Offre et clients : ce que vous vendez, à qui, à quel rythme. */

import { h, euro, pct, num, numberField, textField, selectField, helpButton, toast, confirmDialog, monthLabel } from '../dom.js'
import { newActivity, BOUNDS } from '../../state/schema.js'
import { sparkline, PALETTE } from '../charts.js'
import { vocabulary, getSector } from '../../state/sectors.js'
import store from '../../state/store.js'

export function renderOffer(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const level = store.level
  const open = renderOffer.open || (renderOffer.open = new Set())
  if (open.size === 0 && s.activities[0]) open.add(s.activities[0].id)

  const addActivity = () => {
    if (level === 'easy' && s.activities.length >= 1) {
      toast('Passez en niveau Intermédiaire pour gérer plusieurs offres.', 'err'); return
    }
    if (s.activities.length >= 8) { toast('Huit offres au maximum.', 'err'); return }
    const a = newActivity({ name: `Offre ${s.activities.length + 1}` })
    store.update((sc) => sc.activities.push(a), { label: 'Ajout d\'une offre' })
    open.add(a.id)
    refresh()
  }

  return h('div', { class: 'content' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'Offre et clients'),
      h('p', {}, level === 'easy'
        ? "Décrivez ce que vous vendez et à combien de clients. Fizzy s'occupe de la TVA, des délais de paiement et de la saisonnalité avec des valeurs de marché."
        : "Chaque offre porte son prix, son coût de revient, ses conditions de paiement et sa trajectoire de volumes. Tout se répercute immédiatement sur le résultat et la trésorerie."),
    ),

    ...s.activities.map((a, i) => activityCard(a, i, r, level, open, refresh)),

    h('button', { class: 'btn btn-block mt', onClick: addActivity },
      '＋ Ajouter une offre',
      level === 'easy' && s.activities.length >= 1 ? h('span', { class: 'chip', style: { marginLeft: '6px' } }, 'Intermédiaire') : null),

    level !== 'easy' && s.activities.length > 1 && comparisonCard(r),
  )
}

function activityCard(a, index, r, level, open, refresh) {
  const voc = vocabulary(store.scenario)
  const isOpen = open.has(a.id)
  const detail = r?.revenue.perActivity.find((x) => x.id === a.id)
  const totalRevenue = detail ? detail.total.reduce((x, y) => x + y, 0) : 0
  const set = (patch, label = "Modification de l'offre", opts = {}) =>
    store.update((sc) => Object.assign(sc.activities.find((x) => x.id === a.id), patch), { label, ...opts })
  const setVolumes = (patch) =>
    store.update((sc) => Object.assign(sc.activities.find((x) => x.id === a.id).volumes, patch), { label: 'Volumes' })

  const remove = async () => {
    if (store.scenario.activities.length <= 1) { toast('Gardez au moins une offre.', 'err'); return }
    if (await confirmDialog({ title: 'Supprimer cette offre ?', message: `« ${a.name} » et tout ce qui en dépend seront retirés du modèle.`, confirmLabel: 'Supprimer', danger: true })) {
      store.update((sc) => { sc.activities = sc.activities.filter((x) => x.id !== a.id) }, { label: 'Suppression' })
      refresh()
    }
  }

  const margin = (Number(a.unitPrice) || 0) > 0 ? 1 - (Number(a.unitCost) || 0) / (Number(a.unitPrice) || 1) : null

  return h('div', { class: `item ${isOpen ? 'open' : ''}` },
    h('div', { class: 'item-head', onClick: () => { isOpen ? open.delete(a.id) : open.add(a.id); refresh() } },
      h('span', { class: 'swatch', style: { background: PALETTE[index % PALETTE.length], width: '10px', height: '10px' } }),
      h('div', { class: 'spacer' },
        h('div', { class: 'item-title' }, a.name || 'Sans nom'),
        h('div', { class: 'item-meta' },
          [
            (Number(a.unitPrice) || 0) > 0 ? `${euro(a.unitPrice)} l'unité` : null,
            (Number(a.recurringPrice) || 0) > 0 ? `${euro(a.recurringPrice)}/mois pendant ${a.contractMonths} mois` : null,
            margin !== null ? `${pct(margin, 0)} de marge` : null,
          ].filter(Boolean).join(' · ')),
      ),
      detail && h('div', { class: 'right', style: { marginRight: '10px' } },
        h('div', { class: 'small num', style: { fontWeight: '640' } }, euro(totalRevenue, { compact: true })),
        h('div', { class: 'tiny muted' }, 'CA sur 5 ans')),
      detail && h('div', { style: { marginRight: '8px' } }, sparkline({ values: yearly(detail.total), color: PALETTE[index % PALETTE.length] })),
      h('span', { class: 'disclose' }, '›'),
    ),
    isOpen && h('div', { class: 'item-body' },
      h('div', { class: 'grid grid-2 mt' },
        textField({ label: "Nom de l'offre", value: a.name, onInput: (v, o) => set({ name: v }, undefined, o) }),
        level !== 'easy' && selectField({
          label: 'Taux de TVA', value: a.vatRateSales,
          options: [
            { value: 0.2, label: '20 % — taux normal' },
            { value: 0.1, label: '10 % — restauration, transport, travaux' },
            { value: 0.055, label: '5,5 % — alimentaire, livres, énergie' },
            { value: 0.021, label: '2,1 % — presse, médicaments' },
            { value: 0, label: '0 % — exonéré ou franchise en base' },
          ],
          help: 'tva',
          onInput: (v) => set({ vatRateSales: Number(v), vatRatePurchase: Number(v) === 0 ? 0.2 : Number(v) }),
        }),
      ),

      section('Prix et coût de revient'),
      h('div', { class: 'grid grid-4' },
        numberField({ label: `Prix par ${voc.one}`, field: 'unitPrice', value: a.unitPrice, suffix: '€ HT', hint: `Ce que paie un ${voc.client} pour une ${voc.one}.`, onInput: (v) => set({ unitPrice: v }) }),
        numberField({ label: `Coût de revient par ${voc.one}`, field: 'unitPrice', value: a.unitCost, suffix: '€ HT', hint: `Ce qu'une ${voc.one} vous coûte directement : achats, sous-traitance, consommables.`, onInput: (v) => set({ unitCost: v }) }),
        numberField({ label: 'Abonnement mensuel', field: 'recurringPrice', value: a.recurringPrice, suffix: '€ HT', hint: 'Laissez à 0 si vente ponctuelle.', onInput: (v) => set({ recurringPrice: v }) }),
        numberField({ label: 'Coût mensuel récurrent', field: 'recurringPrice', value: a.recurringCost, suffix: '€ HT', hint: 'Hébergement, licence, support.', onInput: (v) => set({ recurringCost: v }) }),
      ),
      margin !== null && h('div', { class: `note ${margin < 0 ? 'danger' : margin < 0.2 ? 'warn' : 'ok'}`, style: { marginTop: '12px' } },
        h('div', { class: 'note-title' }, `Marge unitaire : ${euro((Number(a.unitPrice) || 0) - (Number(a.unitCost) || 0))} par vente, soit ${pct(margin, 0)}`),
        marginAdvice(margin)),

      (Number(a.recurringPrice) || 0) > 0 && h('div', { class: 'grid grid-2 mt' },
        numberField({ label: 'Durée du contrat', field: 'contractMonths', value: a.contractMonths, suffix: 'mois', hint: "Durée pendant laquelle l'abonnement est facturé.", onInput: (v) => set({ contractMonths: v }) }),
        numberField({ label: 'Attrition mensuelle', field: 'churnMonthly', value: a.churnMonthly, percent: true, hint: 'Part des clients qui résilient chaque mois. 2 % par mois signifie perdre un quart de sa base en un an.', onInput: (v) => set({ churnMonthly: v }) }),
      ),

      section('Volumes de vente'),
      volumesEditor(a, setVolumes, level, detail),

      level !== 'easy' && [
        section('Conditions de paiement', 'Ces délais ne changent pas votre résultat, mais déterminent votre trésorerie et votre besoin en fonds de roulement.', 'bfr'),
        h('div', { class: 'grid grid-4' },
          numberField({ label: 'Délai de livraison', field: 'deliveryLag', value: a.deliveryLag, suffix: 'mois', hint: 'Entre la commande et la livraison.', onInput: (v) => set({ deliveryLag: v }) }),
          numberField({ label: 'Délai de paiement client', field: 'paymentLag', value: a.paymentLag, suffix: 'mois', hint: '0 = paiement comptant.', onInput: (v) => set({ paymentLag: v }) }),
          numberField({ label: 'Acompte à la commande', field: 'deposit', value: a.deposit, percent: true, hint: 'Réduit directement votre besoin de trésorerie.', onInput: (v) => set({ deposit: v }) }),
          numberField({ label: 'Solde intermédiaire', field: 'milestone', value: a.milestone, percent: true, hint: 'Versé à mi-livraison.', onInput: (v) => set({ milestone: v }) }),
        ),
        h('div', { class: 'note plain', style: { marginTop: '10px' } },
          `Répartition : ${pct(a.deposit || 0, 0)} à la commande, ${pct(a.milestone || 0, 0)} à mi-parcours, ${pct(Math.max(0, 1 - (a.deposit || 0) - (a.milestone || 0)), 0)} à la livraison.`),
        h('div', { class: 'grid grid-2 mt' },
          numberField({ label: 'Délai de paiement fournisseur', field: 'paymentLag', value: a.costPaymentLag, suffix: 'mois', hint: 'Un délai long finance votre activité.', onInput: (v) => set({ costPaymentLag: v }) }),
          numberField({ label: 'Acompte versé au fournisseur', field: 'deposit', value: a.costDeposit, percent: true, onInput: (v) => set({ costDeposit: v }) }),
        ),
      ],

      level === 'advanced' && priceEvolution(a, set),

      h('div', { class: 'row mt', style: { justifyContent: 'flex-end' } },
        h('button', { class: 'btn btn-sm btn-danger', onClick: remove }, 'Supprimer cette offre')),
    ),
  )
}

function volumesEditor(a, setVolumes, level, detail) {
  const v = a.volumes || {}
  const voc = vocabulary(store.scenario)
  const isManual = v.mode === 'manual'
  return h('div', {},
    level !== 'easy' && h('div', { class: 'row mb' },
      h('div', { class: 'levels' },
        h('button', { class: `level-btn ${!isManual ? 'active' : ''}`, onClick: () => setVolumes({ mode: 'growth' }) }, 'Courbe de croissance'),
        h('button', { class: `level-btn ${isManual ? 'active' : ''}`, onClick: () => setVolumes({ mode: 'manual', manual: v.manual?.length ? v.manual : buildManual(a) }) }, 'Saisie mois par mois'),
      ),
    ),
    isManual
      ? manualGrid(a, setVolumes)
      : h('div', {},
          h('div', { class: 'grid grid-4' },
            numberField({ label: 'Premier mois de vente', field: 'month', value: v.launchMonth, suffix: 'M', hint: 'Mois 0 = démarrage.', onInput: (x) => setVolumes({ launchMonth: x }) }),
            numberField({ label: `${voc.many[0].toUpperCase()}${voc.many.slice(1)} le premier mois`, field: 'startUnits', value: v.startUnits, suffix: voc.many, onInput: (x) => setVolumes({ startUnits: x }) }),
            numberField({ label: 'Croissance mensuelle', field: 'monthlyGrowth', value: v.monthlyGrowth, percent: true, hint: '10 % par mois triple le volume en un an.', onInput: (x) => setVolumes({ monthlyGrowth: x }) }),
            numberField({ label: 'Plafond de capacité', field: 'startUnits', value: v.cap, suffix: voc.many, hint: "Ce que vous ne pouvez physiquement pas dépasser. Vide = pas de limite.", onInput: (x) => setVolumes({ cap: x }) }),
          ),
          level === 'advanced' && h('div', { class: 'grid grid-2 mt' },
            numberField({
              label: 'Décélération de la croissance', field: 'growthDecay', value: v.growthDecay ?? 0.96,
              step: 0.01, hint: "Aucune croissance ne se maintient cinq ans au même rythme. À 0,96, le taux perd 4 % de sa valeur chaque mois, produisant une courbe en S. Mettez 1 pour une exponentielle pure.",
              onInput: (x) => setVolumes({ growthDecay: x }),
            }),
          ),
          detail && h('div', { class: 'note plain mt' },
            `Projection : ${num(sumRange(detail.volumes, 0, 12))} ${voc.many} ${voc.verb} en année 1, ${num(sumRange(detail.volumes, 12, 24))} en année 2, ${num(sumRange(detail.volumes, 48, 60))} en année 5.`),
        ),
  )
}

function manualGrid(a, setVolumes) {
  const manual = a.volumes.manual?.length === 60 ? a.volumes.manual : buildManual(a)
  const commit = (i, val) => {
    const next = manual.slice()
    next[i] = Math.max(0, Number(val) || 0)
    setVolumes({ manual: next })
  }
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Année'), ...Array.from({ length: 12 }, (_, m) => h('th', {}, ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][m])), h('th', {}, 'Total'))),
      h('tbody', {},
        ...Array.from({ length: 5 }, (_, y) => h('tr', {},
          h('td', {}, `A${y + 1}`),
          ...Array.from({ length: 12 }, (_, m) => {
            const i = y * 12 + m
            const input = h('input', { type: 'number', min: 0, value: manual[i] || 0, style: { width: '52px', border: '1px solid var(--ink-200)', borderRadius: '5px', padding: '3px 5px', textAlign: 'right', fontSize: '12px' } })
            input.addEventListener('change', () => commit(i, input.value))
            return h('td', { style: { padding: '3px' } }, input)
          }),
          h('td', { class: 'num', style: { fontWeight: '640' } }, num(sumRange(manual, y * 12, y * 12 + 12))),
        )),
      ),
    ),
  )
}

function priceEvolution(a, set) {
  const years = [1, 2, 3, 4]
  return h('div', {},
    section('Évolution des prix', "Par défaut, le prix d'une année reconduit celui de l'année précédente. Renseignez une case pour appliquer une hausse à partir de cette année."),
    h('div', { class: 'grid grid-4' },
      ...years.map((y) => numberField({
        label: `Prix unitaire — année ${y + 1}`, field: 'unitPrice',
        value: a.priceByYear?.[y - 1] ?? '', suffix: '€ HT',
        onInput: (v) => { const arr = (a.priceByYear || []).slice(); arr[y - 1] = v; set({ priceByYear: arr }) },
      })),
    ),
  )
}

function comparisonCard(r) {
  const rows = r.revenue.perActivity.map((a, i) => {
    const revenue = a.total.reduce((x, y) => x + y, 0)
    const cost = a.variableCost.reduce((x, y) => x + y, 0)
    return { name: a.name, revenue, cost, margin: revenue - cost, rate: revenue > 0 ? (revenue - cost) / revenue : 0, color: PALETTE[i % PALETTE.length] }
  })
  const total = rows.reduce((a, r) => a + r.revenue, 0)
  return h('div', { class: 'card mt' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Comparaison des offres'), h('span', { class: 'tiny muted' }, 'Cumul sur cinq ans')),
    h('div', { class: 'table-wrap' },
      h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Offre'), h('th', {}, "Chiffre d'affaires"), h('th', {}, 'Part du CA'), h('th', {}, 'Coûts variables'), h('th', {}, 'Marge brute'), h('th', {}, 'Taux'))),
        h('tbody', {},
          ...rows.map((row) => h('tr', {},
            h('td', {}, h('span', { class: 'rowlabel' }, h('span', { class: 'swatch', style: { background: row.color } }), row.name)),
            h('td', { class: 'num' }, euro(row.revenue)),
            h('td', { class: 'num pct' }, total > 0 ? pct(row.revenue / total, 0) : '—'),
            h('td', { class: 'num muted' }, euro(-row.cost)),
            h('td', { class: 'num' }, euro(row.margin)),
            h('td', { class: 'num' }, h('span', { class: `chip ${row.rate >= 0.5 ? 'chip-pos' : row.rate >= 0.2 ? 'chip-warn' : 'chip-neg'}` }, pct(row.rate, 0))),
          )),
        ),
      ),
    ),
  )
}

function marginAdvice(margin) {
  if (margin < 0) return "Vous vendez à perte : chaque vente supplémentaire aggrave le résultat. Revoyez le prix ou le coût de revient."
  if (margin < 0.2) return "Marge faible : il faudra un volume important pour couvrir vos frais fixes. Vérifiez que vos volumes projetés sont atteignables."
  if (margin < 0.5) return "Marge correcte, typique du négoce et de la production. Votre point mort dépendra surtout de vos frais fixes."
  return "Marge élevée, caractéristique des services et du logiciel. Chaque nouveau client contribue fortement à couvrir vos frais fixes."
}

function section(title, hint, glossaryKey) {
  return h('div', { style: { margin: '20px 0 10px' } },
    h('h4', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, title, glossaryKey && helpButton(glossaryKey)),
    hint && h('div', { class: 'field-hint', style: { marginTop: '3px', maxWidth: '70ch' } }, hint),
  )
}

const sumRange = (arr, a, b) => arr.slice(a, b).reduce((x, y) => x + y, 0)
const yearly = (arr) => Array.from({ length: 5 }, (_, y) => sumRange(arr, y * 12, y * 12 + 12))
function buildManual(a) {
  const out = new Array(60).fill(0)
  const v = a.volumes || {}
  let level = Number(v.startUnits) || 0
  for (let m = Number(v.launchMonth) || 0; m < 60; m++) { out[m] = Math.round(level); level *= 1 + (Number(v.monthlyGrowth) || 0) }
  return out
}
