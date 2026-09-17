/**
 * Marketing : les campagnes produisent des clients, les clients produisent du
 * chiffre d'affaires. C'est le lien qui rend le plan cohérent — augmenter un
 * budget publicitaire déplace immédiatement le résultat et la trésorerie.
 */

import { h, euro, pct, num, numberField, textField, selectField, switchField, monthField, helpButton, confirmDialog, toast, tabs, pageBar } from '../dom.js'
import { newCampaign, CHANNELS } from '../../state/schema.js'
import { clientsFromBudget } from '../../engine/revenue.js'
import { barChart, donut, PALETTE, YEAR_CATEGORIES } from '../charts.js'
import { tutorial, stepBanner } from '../tutorial.js'
import { enableToggle, levelBlock } from '../dom.js'
import { journey } from '../../engine/journey.js'
import store from '../../state/store.js'

export function renderMarketing(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const level = store.level
  const open = renderMarketing.open || (renderMarketing.open = new Set())
  if (open.size === 0 && s.marketing[0]) open.add(s.marketing[0].id)

  // En mode simple, l'acquisition tient en deux nombres : ce que coûte un
  // client et combien on en veut par mois. L'entonnoir, les canaux et le
  // rapport LTV/CAC sont de vraies questions — mais pas les premières.
  if (level === 'easy') return simpleAcquisition(s, r, navigate, refresh)

  const add = () => {
    const c = newCampaign({ name: `Campagne ${s.marketing.length + 1}`, activityId: s.activities[0]?.id || null })
    store.update((sc) => sc.marketing.push(c), { label: "Ajout d'une campagne" })
    open.add(c.id)
    refresh()
  }

  const totalBudget = (r?.revenue.campaigns || []).reduce((a, c) => a + c.totalSpend, 0)
  const totalClients = (r?.revenue.campaigns || []).reduce((a, c) => a + c.totalClients, 0)

  const views = [
    { key: 'campagnes', label: 'Campagnes', count: s.marketing.length },
    r && s.marketing.length > 0 ? { key: 'mix', label: 'Répartition' } : null,
    level === 'advanced' && r && s.marketing.length > 0 ? { key: 'rentabilite', label: 'Rentabilité' } : null,
  ]
  const view = views.some((v) => v && v.key === renderMarketing.view) ? renderMarketing.view : 'campagnes'
  renderMarketing.view = view

  return h('div', { class: 'content' },
    stepBanner('acquisition', journey(store.scenario, store.result), navigate),

    pageBar(
      s.marketing.length > 1 ? `${s.marketing.length} campagnes` : 'Acquisition de clients',
      r && totalClients > 0
        ? `${euro(totalBudget, { compact: true })} investis pour ${num(Math.round(totalClients))} clients · ${r.kpis.cac ? euro(r.kpis.cac) : '—'} par client`
        : 'Ce que vous dépensez pour trouver des clients, et ce que ça rapporte',
      view === 'campagnes' ? h('button', { class: 'btn btn-primary btn-sm', onClick: add }, '＋ Ajouter une campagne') : null,
    ),

    tabs(views, view, (k) => { renderMarketing.view = k; refresh() }),

    view === 'campagnes' ? h('div', { class: 'view' },
      r && s.marketing.length > 0 ? h('div', { class: 'grid grid-4 kpis mb' },
        tile('Budget total', euro(totalBudget, { compact: true }), 'Sur cinq ans'),
        tile('Clients acquis', num(Math.round(totalClients)), 'Toutes campagnes'),
        tile('CAC moyen', r.kpis.cac ? euro(r.kpis.cac) : '—', "Coût d'acquisition", 'cac'),
        tile('LTV / CAC', r.kpis.ltvCacRatio ? `${num(r.kpis.ltvCacRatio, 1)}×` : '—',
          r.kpis.ltvCacRatio ? (r.kpis.ltvCacRatio >= 3 ? 'Rentable' : r.kpis.ltvCacRatio >= 1 ? 'Juste' : 'Non rentable') : '—', 'ltv',
          r.kpis.ltvCacRatio ? (r.kpis.ltvCacRatio >= 3 ? 'pos' : r.kpis.ltvCacRatio >= 1 ? 'warn' : 'neg') : ''),
      ) : null,

      s.marketing.length === 0
        ? h('div', { class: 'card' }, h('div', { class: 'empty' },
            h('div', { class: 'empty-icon' }, '◎'),
            h('h3', {}, 'Aucune campagne'),
            h('p', { class: 'muted', style: { maxWidth: '52ch', margin: '0 auto' } },
              "Sans campagne, vos volumes de vente reposent uniquement sur la courbe de croissance saisie dans l'onglet Offre. Ajoutez une campagne pour relier un budget marketing à une acquisition de clients."),
            h('button', { class: 'btn btn-primary mt', onClick: add }, 'Créer une campagne'),
          ))
        : h('div', {}, ...s.marketing.map((c, i) => campaignCard(c, i, r, open, refresh))),
    ) : null,

    view === 'mix' && r ? h('div', { class: 'view' }, mixPanel(r)) : null,
    view === 'rentabilite' && r ? h('div', { class: 'view' }, unitEconomicsPanel(r, s)) : null,

    tutorial('acquisition', navigate),
  )
}

/* ─────────────────── Mode simple : deux nombres, une réponse ─────────────── */

/**
 * Combien coûte un client, combien j'en veux.
 *
 * Un fondateur qui démarre ne connaît ni son taux de clic ni son coût pour
 * mille impressions ; il a en revanche une idée de ce qu'il est prêt à
 * dépenser pour gagner un client. C'est la seule question posée ici : le
 * budget s'en déduit, et la comparaison avec ce que rapporte un client dit
 * immédiatement si le compte y est.
 */
function simpleAcquisition(s, r, navigate, refresh) {
  const camp = s.marketing[0]
  const cac = camp ? Number(camp.cac) || 0 : 0
  const perMonth = camp ? Number(camp.clientsPerMonth) || 0 : 0
  const budget = cac * perMonth

  const setSimple = (patch) => {
    store.update((sc) => {
      let c = sc.marketing[0]
      if (!c) {
        c = newCampaign({ name: 'Acquisition de clients', activityId: sc.activities[0]?.id || null, channel: 'ads' })
        sc.marketing.push(c)
      }
      c.model = 'cac'
      c.durationMonths = 60
      c.startMonth = 0
      Object.assign(c, patch)
      c.monthlyBudget = (Number(c.cac) || 0) * (Number(c.clientsPerMonth) || 0)
    }, { label: 'Acquisition de clients' })
  }

  const ltv = r?.kpis?.ltv || 0
  const ratio = cac > 0 && ltv > 0 ? ltv / cac : null

  return h('div', { class: 'content' },
    stepBanner('acquisition', journey(store.scenario, store.result), navigate),

    h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        h('div', {},
          h('h2', {}, 'Ce que vous coûte un client'),
          h('div', { class: 'tiny muted' }, "Deux nombres suffisent à chiffrer votre acquisition."),
        ),
      ),
      h('div', { class: 'card-body' },
        h('div', { class: 'grid grid-2' },
          numberField({
            label: "Coût moyen pour gagner un client", field: 'cac', value: cac, suffix: '€',
            help: 'cac',
            hint: "Tout ce que vous dépensez pour qu'un client signe, divisé par le nombre de clients : publicité, commissions, salons, échantillons.",
            onInput: (v) => setSimple({ cac: v }),
          }),
          numberField({
            label: 'Nouveaux clients visés par mois', field: 'count', value: perMonth, suffix: 'clients',
            hint: "En plus de ceux qui viennent seuls. Laissez à zéro si vous ne dépensez rien pour en trouver.",
            onInput: (v) => setSimple({ clientsPerMonth: v }),
          }),
        ),

        h('div', { class: 'acq-sum' },
          h('div', { class: 'acq-sum-cell' },
            h('div', { class: 'acq-sum-label' }, 'Budget mensuel'),
            h('div', { class: 'acq-sum-value num' }, euro(budget)),
          ),
          h('div', { class: 'acq-sum-cell' },
            h('div', { class: 'acq-sum-label' }, 'Sur un an'),
            h('div', { class: 'acq-sum-value num' }, euro(budget * 12)),
          ),
          h('div', { class: 'acq-sum-cell' },
            h('div', { class: 'acq-sum-label' }, 'Clients gagnés en un an'),
            h('div', { class: 'acq-sum-value num' }, num(perMonth * 12)),
          ),
        ),

        cac > 0 && ltv > 0 && h('div', { class: 'acq-scale' },
          h('div', { class: 'acq-scale-head' },
            h('span', {}, 'Ce qu’un client vous rapporte, face à ce qu’il vous coûte'),
          ),
          h('div', { class: 'acq-scale-row' },
            h('span', { class: 'acq-scale-tag' }, 'Rapporte'),
            h('span', { class: 'acq-scale-bar' },
              h('i', { class: 'gain', style: { width: `${(ltv / Math.max(ltv, cac)) * 100}%` } })),
            h('span', { class: 'acq-scale-num num' }, euro(ltv)),
          ),
          h('div', { class: 'acq-scale-row' },
            h('span', { class: 'acq-scale-tag' }, 'Coûte'),
            h('span', { class: 'acq-scale-bar' },
              h('i', { class: 'loss', style: { width: `${(cac / Math.max(ltv, cac)) * 100}%` } })),
            h('span', { class: 'acq-scale-num num' }, euro(cac)),
          ),
          h('p', { class: 'acq-scale-note' }, ratioAdvice(ratio)),
        ),

        cac > 0 && ltv <= 0 && h('div', { class: 'note mt' },
          h('div', { class: 'note-title' }, 'Il manque un prix de vente'),
          "Renseignez le prix et le coût de revient de votre offre pour que Fynomia puisse comparer ce qu'un client vous rapporte à ce qu'il vous coûte."),
      ),
    ),

    h('div', { class: 'note plain mt' },
      h('div', { class: 'note-title' }, 'Et si je veux détailler ?'),
      "Passez en niveau Intermédiaire ou Expert pour décomposer votre acquisition en campagnes, choisir un canal par campagne et chiffrer un entonnoir complet — impressions, clics, contacts, clients — avec le rapport entre ce qu'un client coûte et ce qu'il rapporte sur toute sa durée de vie."),

    tutorial('acquisition', navigate),
  )
}

function ratioAdvice(ratio) {
  if (ratio === null) return ''
  if (ratio >= 3) return `Un client rapporte ${num(ratio, 1)} fois ce qu'il coûte. Au-delà de trois, l'acquisition est saine : vous pouvez dépenser davantage sans fragiliser le modèle.`
  if (ratio >= 1) return `Un client rapporte ${num(ratio, 1)} fois ce qu'il coûte. C'est positif mais court : le retour est lent et laisse peu de marge d'erreur. Travaillez la conversion ou la valeur client avant d'augmenter le budget.`
  return `Un client vous coûte plus qu'il ne vous rapporte. En l'état, chaque client gagné creuse la perte : baissez le coût d'acquisition ou augmentez le prix avant de dépenser.`
}

/* ───────────────── Mode expert : la rentabilité, en détail ──────────────── */

/**
 * LTV, CAC, et le temps qu'il faut pour rembourser l'acquisition.
 *
 * Le rapport LTV/CAC dit si l'acquisition est rentable ; le délai de retour dit
 * si la trésorerie le supporte. Les deux sont nécessaires : une acquisition
 * rentable sur trois ans peut tuer une entreprise en six mois.
 */
function unitEconomicsPanel(r, s) {
  const k = r.kpis
  const cac = k.cac || 0
  const ltv = k.ltv || 0
  const ratio = k.ltvCacRatio
  const arpu = k.arpu || 0
  const payback = arpu > 0 && cac > 0 ? cac / arpu : null

  const rows = [
    { label: "Coût d'acquisition (CAC)", value: cac > 0 ? euro(cac) : '—', note: 'Budget marketing divisé par les clients acquis', key: 'cac' },
    { label: 'Valeur vie client (LTV)', value: ltv > 0 ? euro(ltv) : '—', note: "Marge cumulée sur toute la relation", key: 'ltv' },
    { label: 'Rapport LTV / CAC', value: ratio ? `${num(ratio, 1)}×` : '—', note: '3 ou plus : sain. Sous 1 : chaque client coûte plus qu’il ne rapporte',
      tone: ratio ? (ratio >= 3 ? 'pos' : ratio >= 1 ? 'warn' : 'neg') : '' },
    { label: 'Délai de retour', value: payback ? `${num(payback, 1)} mois` : '—', note: "Temps pour que la marge d'un client rembourse son acquisition",
      tone: payback ? (payback <= 12 ? 'pos' : payback <= 24 ? 'warn' : 'neg') : '' },
    { label: 'Revenu moyen par client', value: arpu > 0 ? `${euro(arpu)} / mois` : '—', note: 'Toutes offres confondues' },
  ]

  return h('div', { class: 'card' },
    h('div', { class: 'table-wrap' },
      h('table', { class: 'data' },
        h('tbody', {},
          ...rows.map((row) => h('tr', {},
            h('td', {},
              h('div', { class: 'rowlabel' }, row.label, row.key && helpButton(row.key)),
              h('div', { class: 'tiny muted', style: { whiteSpace: 'normal', maxWidth: '56ch' } }, row.note),
            ),
            h('td', { class: `num ${row.tone === 'pos' ? 'pos' : row.tone === 'neg' ? 'neg' : ''}`, style: { fontSize: '16px', fontWeight: '650' } }, row.value),
          )),
        ),
      ),
    ),
    payback !== null && h('div', { class: 'card-body', style: { paddingTop: '0' } },
      h('p', { class: 'tiny muted', style: { margin: 0, maxWidth: '78ch' } },
        payback <= 12
          ? `Vous récupérez ce que coûte un client en ${num(payback, 1)} mois. Sous douze mois, l'acquisition s'autofinance presque : accelérer ne crée pas de trou de trésorerie durable.`
          : `Il faut ${num(payback, 1)} mois pour récupérer ce que coûte un client. Chaque client supplémentaire creuse d'abord la trésorerie avant de la remplir : c'est ce délai, plus que la rentabilité, qui fixe le rythme auquel vous pouvez croître.`),
    ),
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

  const on = c.enabled !== false
  return h('div', { class: `item ${isOpen ? 'open' : ''} ${on ? '' : 'is-off'}` },
    h('div', { class: 'item-head', onClick: () => { isOpen ? open.delete(c.id) : open.add(c.id); refresh() } },
      enableToggle(on, (v) => {
        store.update((sc) => { const x = sc.marketing.find((y) => y.id === c.id); if (x) x.enabled = v },
          { label: v ? 'Campagne réactivée' : 'Campagne en pause' })
        refresh()
      }),
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
          : "Renseignez un prix de vente et un coût de revient dans l'onglet Offre pour que Fynomia calcule la rentabilité de votre acquisition.",
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
