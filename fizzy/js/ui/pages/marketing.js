/**
 * Marketing : les campagnes produisent des clients, les clients produisent du
 * chiffre d'affaires. C'est le lien qui rend le plan cohérent — augmenter un
 * budget publicitaire déplace immédiatement le résultat et la trésorerie.
 */

import { h, euro, pct, num, numberField, textField, selectField, switchField, monthField, helpButton, confirmDialog, toast } from '../dom.js'
import { newCampaign, CHANNELS } from '../../state/schema.js'
import { clientsFromBudget } from '../../engine/revenue.js'
import { barChart, donut, PALETTE, YEAR_CATEGORIES } from '../charts.js'
import store from '../../state/store.js'

export function renderMarketing(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const open = renderMarketing.open || (renderMarketing.open = new Set())

  const add = () => {
    const c = newCampaign({ name: `Campagne ${s.marketing.length + 1}`, activityId: s.activities[0]?.id || null })
    store.update((sc) => sc.marketing.push(c), { label: "Ajout d'une campagne" })
    open.add(c.id)
    refresh()
  }

  const totalBudget = (r?.revenue.campaigns || []).reduce((a, c) => a + c.totalSpend, 0)
  const totalClients = (r?.revenue.campaigns || []).reduce((a, c) => a + c.totalClients, 0)

  return h('div', { class: 'content' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'Marketing et acquisition'),
      h('p', {}, "Chaque campagne convertit un budget en clients, et ces clients alimentent directement le chiffre d'affaires de l'offre à laquelle vous la rattachez. Modifiez un budget : le résultat et la trésorerie suivent."),
    ),

    r && s.marketing.length > 0 && h('div', { class: 'grid grid-4 kpis mb' },
      tile('Budget total', euro(totalBudget, { compact: true }), 'Sur cinq ans'),
      tile('Clients acquis', num(Math.round(totalClients)), 'Toutes campagnes'),
      tile('CAC moyen', r.kpis.cac ? euro(r.kpis.cac) : '—', "Coût d'acquisition", 'cac'),
      tile('LTV / CAC', r.kpis.ltvCacRatio ? `${num(r.kpis.ltvCacRatio, 1)}×` : '—',
        r.kpis.ltvCacRatio ? (r.kpis.ltvCacRatio >= 3 ? 'Rentable' : r.kpis.ltvCacRatio >= 1 ? 'Juste' : 'Non rentable') : '—', 'ltv',
        r.kpis.ltvCacRatio ? (r.kpis.ltvCacRatio >= 3 ? 'pos' : r.kpis.ltvCacRatio >= 1 ? 'warn' : 'neg') : ''),
    ),

    s.marketing.length === 0
      ? h('div', { class: 'card' }, h('div', { class: 'empty' },
          h('div', { class: 'empty-icon' }, '◎'),
          h('h3', {}, 'Aucune campagne'),
          h('p', { class: 'muted', style: { maxWidth: '52ch', margin: '0 auto' } },
            "Sans campagne, vos volumes de vente reposent uniquement sur la courbe de croissance saisie dans l'onglet Offre. Ajoutez une campagne pour relier un budget marketing à une acquisition de clients."),
          h('button', { class: 'btn btn-primary mt', onClick: add }, 'Créer une campagne'),
        ))
      : h('div', {}, ...s.marketing.map((c, i) => campaignCard(c, i, r, open, refresh))),

    s.marketing.length > 0 && h('button', { class: 'btn btn-block mt', onClick: add }, '＋ Ajouter une campagne'),

    r && s.marketing.length > 0 && mixPanel(r),
  )
}

function campaignCard(c, index, r, open, refresh) {
  const isOpen = open.has(c.id)
  const s = store.scenario
  const set = (patch, label = 'Modification de campagne', opts = {}) =>
    store.update((sc) => Object.assign(sc.marketing.find((x) => x.id === c.id), patch), { label, ...opts })
  const detail = r?.revenue.campaigns.find((x) => x.id === c.id)
  const perMonth = clientsFromBudget(c, Number(c.monthlyBudget) || 0)

  const remove = async () => {
    if (await confirmDialog({ title: 'Supprimer cette campagne ?', message: `« ${c.name} » et les clients qu'elle génère seront retirés du modèle.`, confirmLabel: 'Supprimer', danger: true })) {
      store.update((sc) => { sc.marketing = sc.marketing.filter((x) => x.id !== c.id) }, { label: 'Suppression de campagne' })
      refresh()
    }
  }

  const applyChannel = (key) => {
    const defaults = CHANNELS[key]?.defaults || {}
    set({ channel: key, ...defaults }, 'Changement de canal')
  }

  return h('div', { class: `item ${isOpen ? 'open' : ''} ${c.enabled ? '' : 'muted'}`, style: c.enabled ? {} : { opacity: '.6' } },
    h('div', { class: 'item-head', onClick: () => { isOpen ? open.delete(c.id) : open.add(c.id); refresh() } },
      h('span', { class: 'swatch', style: { background: PALETTE[index % PALETTE.length], width: '10px', height: '10px' } }),
      h('div', { class: 'spacer' },
        h('div', { class: 'item-title' }, c.name),
        h('div', { class: 'item-meta' },
          `${CHANNELS[c.channel]?.label || c.channel} · ${euro(c.monthlyBudget)}/mois · ${num(perMonth, 1)} clients/mois`),
      ),
      detail && h('div', { class: 'right', style: { marginRight: '10px' } },
        h('div', { class: 'small num', style: { fontWeight: '650' } }, detail.cac ? euro(detail.cac) : '—'),
        h('div', { class: 'tiny muted' }, 'CAC'),
      ),
      h('span', { class: 'disclose' }, '›'),
    ),
    isOpen && h('div', { class: 'item-body' },
      h('div', { class: 'grid grid-3 mt' },
        textField({ label: 'Nom de la campagne', value: c.name, onInput: (v, o) => set({ name: v }, undefined, o) }),
        selectField({
          label: 'Canal', value: c.channel,
          options: Object.entries(CHANNELS).map(([k, v]) => ({ value: k, label: v.label })),
          hint: 'Le choix du canal ajuste les paramètres par défaut.',
          onInput: applyChannel,
        }),
        selectField({
          label: 'Offre alimentée', value: c.activityId || '',
          options: [{ value: '', label: '— Aucune —' }, ...s.activities.map((a) => ({ value: a.id, label: a.name }))],
          hint: "Les clients acquis achètent cette offre.",
          onInput: (v) => set({ activityId: v || null }),
        }),
      ),

      h('div', { class: 'grid grid-3 mt' },
        numberField({ label: 'Budget mensuel', field: 'monthlyBudget', value: c.monthlyBudget, suffix: '€ HT', onInput: (v) => set({ monthlyBudget: v }) }),
        monthField({ label: 'Mois de démarrage', value: c.startMonth, startDate: r?.startDate, onInput: (v) => set({ startMonth: v }) }),
        numberField({ label: 'Durée', field: 'months', value: c.durationMonths, suffix: 'mois', max: 60, onInput: (v) => set({ durationMonths: v }) }),
      ),

      h('h4', { style: { margin: '18px 0 8px' } }, "Entonnoir de conversion"),
      selectField({
        label: "Mode de calcul", value: c.model,
        options: [
          { value: 'cpc', label: 'Coût par clic (CPC)' },
          { value: 'cpm', label: 'Coût pour mille impressions (CPM)' },
          { value: 'cpl', label: 'Coût par contact (CPL)' },
          { value: 'cac', label: "Coût d'acquisition client connu" },
          { value: 'fixed', label: 'Nombre de clients saisi directement' },
        ],
        onInput: (v) => set({ model: v }),
      }),
      h('div', { class: 'grid grid-3 mt' }, ...funnelFields(c, set)),

      funnelExplainer(c, perMonth),

      h('div', { class: 'row mt' },
        h('label', { class: 'switch' },
          (() => { const i = h('input', { type: 'checkbox', checked: c.enabled !== false }); i.addEventListener('change', () => set({ enabled: i.checked })); return i })(),
          h('span', { class: 'track' }), h('span', { class: 'small' }, 'Campagne active')),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-sm btn-danger', onClick: remove }, 'Supprimer'),
      ),
    ),
  )
}

function funnelFields(c, set) {
  const fields = []
  if (c.model === 'cpc') {
    fields.push(numberField({ label: 'Coût par clic', field: 'cpc', value: c.cpc, suffix: '€', onInput: (v) => set({ cpc: v }) }))
    fields.push(numberField({ label: 'Clic → contact', field: 'visitToLead', value: c.visitToLead, percent: true, hint: 'Part des visiteurs qui laissent leurs coordonnées.', onInput: (v) => set({ visitToLead: v }) }))
    fields.push(numberField({ label: 'Contact → client', field: 'leadToClient', value: c.leadToClient, percent: true, onInput: (v) => set({ leadToClient: v }) }))
  } else if (c.model === 'cpm') {
    fields.push(numberField({ label: 'Coût pour mille', field: 'cpm', value: c.cpm, suffix: '€', onInput: (v) => set({ cpm: v }) }))
    fields.push(numberField({ label: "Taux de clic", field: 'ctr', value: c.ctr, percent: true, onInput: (v) => set({ ctr: v }) }))
    fields.push(numberField({ label: 'Clic → contact', field: 'visitToLead', value: c.visitToLead, percent: true, onInput: (v) => set({ visitToLead: v }) }))
    fields.push(numberField({ label: 'Contact → client', field: 'leadToClient', value: c.leadToClient, percent: true, onInput: (v) => set({ leadToClient: v }) }))
  } else if (c.model === 'cpl') {
    fields.push(numberField({ label: 'Coût par contact', field: 'cpl', value: c.cpl, suffix: '€', onInput: (v) => set({ cpl: v }) }))
    fields.push(numberField({ label: 'Contact → client', field: 'leadToClient', value: c.leadToClient, percent: true, onInput: (v) => set({ leadToClient: v }) }))
  } else if (c.model === 'cac') {
    fields.push(numberField({ label: "Coût d'acquisition", field: 'cac', value: c.cac, suffix: '€', hint: 'Si vous connaissez déjà votre CAC réel.', onInput: (v) => set({ cac: v }) }))
  } else {
    fields.push(numberField({ label: 'Clients par mois', field: 'count', value: c.clientsPerMonth, suffix: 'clients', onInput: (v) => set({ clientsPerMonth: v }) }))
  }
  return fields
}

function funnelExplainer(c, perMonth) {
  const budget = Number(c.monthlyBudget) || 0
  const steps = []
  if (c.model === 'cpc') {
    const clicks = budget / (Number(c.cpc) || 1)
    steps.push([`${num(clicks)} clics`, `${euro(budget)} ÷ ${euro(c.cpc)} par clic`])
    steps.push([`${num(clicks * (c.visitToLead || 0), 1)} contacts`, `${pct(c.visitToLead || 0, 1)} des clics`])
    steps.push([`${num(perMonth, 1)} clients`, `${pct(c.leadToClient || 0, 0)} des contacts`])
  } else if (c.model === 'cpm') {
    const impressions = (budget / (Number(c.cpm) || 1)) * 1000
    steps.push([`${num(impressions)} impressions`, `${euro(budget)} au CPM de ${euro(c.cpm)}`])
    steps.push([`${num(impressions * (c.ctr || 0))} clics`, `${pct(c.ctr || 0, 2)} de taux de clic`])
    steps.push([`${num(perMonth, 1)} clients`, 'après double conversion'])
  } else if (c.model === 'cpl') {
    const leads = budget / (Number(c.cpl) || 1)
    steps.push([`${num(leads, 1)} contacts`, `${euro(budget)} ÷ ${euro(c.cpl)} par contact`])
    steps.push([`${num(perMonth, 1)} clients`, `${pct(c.leadToClient || 0, 0)} de conversion`])
  } else if (c.model === 'cac') {
    steps.push([`${num(perMonth, 1)} clients`, `${euro(budget)} ÷ ${euro(c.cac)} par client`])
  } else {
    steps.push([`${num(perMonth, 1)} clients`, 'saisie directe'])
  }
  const cac = perMonth > 0 ? budget / perMonth : null
  return h('div', { class: 'note mt' },
    h('div', { class: 'note-title' }, 'Ce que produit ce budget, chaque mois'),
    h('div', { class: 'row-wrap', style: { marginTop: '8px', gap: '6px' } },
      ...steps.flatMap(([main, sub], i) => [
        i > 0 ? h('span', { class: 'muted' }, '→') : null,
        h('span', { class: 'chip chip-brand', title: sub }, main),
      ].filter(Boolean)),
    ),
    cac && h('div', { style: { marginTop: '9px' } }, `Soit un coût d'acquisition de `, h('strong', {}, euro(cac)), ` par client.`),
  )
}

function mixPanel(r) {
  const campaigns = r.revenue.campaigns
  return h('div', { class: 'card mt' },
    h('div', { class: 'card-head' }, h('h2', {}, "Répartition de l'acquisition")),
    h('div', { class: 'card-body' },
      h('div', { class: 'grid grid-2' },
        h('div', {},
          h('h4', { class: 'mb' }, 'Clients acquis par campagne'),
          donut({ items: campaigns.map((c, i) => ({ label: c.name, value: c.totalClients, color: PALETTE[i % PALETTE.length] })), formatter: (v) => `${num(v)} clients` }),
        ),
        h('div', {},
          h('h4', { class: 'mb' }, 'Budget marketing par exercice'),
          barChart({
            categories: YEAR_CATEGORIES,
            series: campaigns.map((c, i) => ({
              label: c.name, color: PALETTE[i % PALETTE.length],
              values: Array.from({ length: 5 }, (_, y) => {
                const start = Number(store.scenario.marketing.find((m) => m.id === c.id)?.startMonth) || 0
                const dur = Number(store.scenario.marketing.find((m) => m.id === c.id)?.durationMonths) || 0
                const budget = Number(store.scenario.marketing.find((m) => m.id === c.id)?.monthlyBudget) || 0
                let months = 0
                for (let k = 0; k < 12; k++) { const m = y * 12 + k; if (m >= start && m < start + dur) months++ }
                return months * budget
              }),
            })),
          }),
        ),
      ),
      h('div', { class: 'note plain mt' },
        h('div', { class: 'note-title' }, 'Comment lire ces chiffres'),
        r.kpis.ltvCacRatio
          ? `Chaque client vous coûte ${euro(r.kpis.cac)} à acquérir et vous rapporte ${euro(r.kpis.ltv)} de marge. Le rapport est de ${num(r.kpis.ltvCacRatio, 1)}, ${r.kpis.ltvCacRatio >= 3 ? "au-dessus du seuil de 3 généralement retenu comme sain : votre acquisition est rentable et peut être accélérée." : r.kpis.ltvCacRatio >= 1 ? "au-dessus de 1 mais en dessous de 3 : l'acquisition est rentable mais le retour est lent. Améliorez la conversion ou la valeur client avant d'augmenter les budgets." : "en dessous de 1 : chaque client acquis vous coûte plus qu'il ne rapporte. Augmenter le budget aggraverait les pertes."}`
          : "Renseignez un prix de vente et un coût de revient dans l'onglet Offre pour que Fizzy calcule la rentabilité de votre acquisition.",
      ),
    ),
  )
}

function tile(label, value, sub, glossaryKey, tone) {
  return h('div', { class: `kpi ${tone || ''}` },
    h('span', { class: 'kpi-accent' }),
    h('div', { class: 'kpi-label' }, label, glossaryKey && helpButton(glossaryKey)),
    h('div', { class: 'kpi-value' }, value),
    h('div', { class: 'kpi-sub' }, sub),
  )
}
