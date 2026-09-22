/**
 * Marketing : les campagnes produisent des clients, les clients produisent du
 * chiffre d'affaires. C'est le lien qui rend le plan cohérent — augmenter un
 * budget publicitaire déplace immédiatement le résultat et la trésorerie.
 */

import { h, euro, pct, num, numberField, textField, selectField, switchField, monthField, helpButton, confirmDialog, toast, tabs, pageBar, fold, foldSign } from '../dom.js'
import { newCampaign, CHANNELS } from '../../state/schema.js'
import { clientsFromBudget } from '../../engine/revenue.js'
import { barChart, donut, PALETTE, YEAR_CATEGORIES } from '../charts.js'
import { tutorial, stepBanner } from '../tutorial.js'
import { enableToggle, refine } from '../dom.js'
import { journey } from '../../engine/journey.js'
import store from '../../state/store.js'

/**
 * L'acquisition, en onglet de « Offre & revenus ».
 *
 * Elle n'est plus un module : ce qu'on dépense pour trouver des clients décide
 * des volumes vendus, donc du chiffre d'affaires. La ranger ailleurs revenait
 * à séparer la cause de son effet.
 */
export function renderAcquisition(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const level = store.level
  const open = renderAcquisition.open || (renderAcquisition.open = new Set())
  // La première ligne s'ouvre à l'arrivée, pas à chaque rendu.
  //
  // « Si rien n'est ouvert, ouvre la première » se rejouait à chaque passage :
  // refermer la seule ligne de la liste était donc impossible — elle se
  // rouvrait dans la foulée, et le chevron ne servait à rien. On ne l'amorce
  // qu'une fois par dossier ouvert.
  if (renderAcquisition.seeded !== store.currentId) {
    renderAcquisition.seeded = store.currentId
    if (s.marketing[0]) open.add(s.marketing[0].id)
  }

  // En mode simple, l'acquisition tient en deux nombres : ce que coûte un
  // client et combien on en veut par mois. L'entonnoir, les canaux et le
  // rapport LTV/CAC sont de vraies questions — mais pas les premières.

  const add = () => {
    const c = newCampaign({ name: `Campagne ${s.marketing.length + 1}`, activityId: s.activities[0]?.id || null, simple: false })
    store.update((sc) => sc.marketing.push(c), { label: "Ajout d'une campagne" })
    open.add(c.id)
    refresh()
  }

  const totalBudget = (r?.revenue.campaigns || []).reduce((a, c) => a + c.totalSpend, 0)
  const totalClients = (r?.revenue.campaigns || []).reduce((a, c) => a + c.totalClients, 0)

  // L'acquisition est déjà un onglet d'« Offre et revenus » : lui donner à son
  // tour trois sous-onglets, c'est demander de tenir trois niveaux de
  // navigation en tête pour lire deux graphiques. Les campagnes restent à
  // l'écran ; la répartition et la rentabilité descendent dans des volets, qu'on
  // ouvre quand on veut vérifier.
  return h('div', { class: 'content' },
    pageBar(
      s.marketing.length > 1 ? `${s.marketing.length} campagnes` : 'Acquisition de clients',
      r && totalClients > 0
        ? `${euro(totalBudget, { compact: true })} investis pour ${num(Math.round(totalClients))} clients · ${r.kpis.cac ? euro(r.kpis.cac) : '—'} par client`
        : 'Ce que tu dépenses pour trouver des clients, et ce que ça rapporte',
      h('button', { class: 'btn btn-primary btn-sm', onClick: add }, '＋ Ajouter une campagne'),
    ),

    h('div', { class: 'view', 'data-gap': 'campagnes' },
      // Le gros trait d'abord, le détail ensuite.
      //
      // On demandait d'emblée un canal, un coût par clic et trois taux de
      // conversion à quelqu'un qui n'a jamais fait de publicité. Or la
      // question de départ tient en deux nombres : combien coûte un client,
      // combien j'en veux par mois. Le budget s'en déduit, et le rapport avec
      // ce qu'un client rapporte se lit tout de suite. L'entonnoir complet
      // reste à un clic, pour qui a des chiffres à y mettre.
      macroAcquisition(s, r, refresh),

      detailFold(s, r, open, refresh, add),

      r && s.marketing.length > 0
        ? fold('Répartition du budget', 'Ce que chaque campagne coûte et rapporte', mixPanel(r), { id: 'acq-mix' })
        : null,
      r && s.marketing.length > 0
        ? fold('Rentabilité d’un client', 'Ce qu’il coûte à acquérir, ce qu’il rapporte ensuite', unitEconomicsPanel(r, s), { id: 'acq-unit' })
        : null,
    ),
  )
}

/* ──────────── Niveau macro : deux nombres avant tout entonnoir ──────────── */

/** Une campagne est-elle encore vierge de tout chiffre d'entonnoir ? */
function vierge(c) {
  return ['cpc', 'cpm', 'cpl', 'ctr', 'visitToLead', 'leadToClient'].every((k) => !(Number(c[k]) > 0))
}

/**
 * La ligne que pilote la carte du haut.
 *
 * Elle porte une marque, pour qu'on la retrouve d'une session à l'autre. Un
 * plan écrit avant cette marque en a peut-être une qui lui ressemble — une
 * campagne unique, en coût d'acquisition ou sans le moindre taux : on l'adopte
 * plutôt que d'en créer une deuxième qui dirait la même chose.
 */
function ligneSimple(camps) {
  return camps.find((c) => c.simple) ||
    // Une campagne qu'on a demandée explicitement porte `simple: false` : elle
    // reste dans le détail, même si elle est la seule et encore vide. Sans
    // cela, « Ajouter une campagne » aurait fabriqué une ligne qui disparaît
    // aussitôt du volet pour remonter dans la carte du haut.
    (camps.length === 1 && camps[0].simple === undefined &&
      (camps[0].model === 'cac' || vierge(camps[0])) ? camps[0] : null)
}

/**
 * « Combien coûte un client » : un champ, toujours saisissable.
 *
 * Il y a deux façons de chiffrer une acquisition, et elles ne s'excluent pas.
 * Celle qu'on a en tête quand une agence annonce un prix : cent cinquante
 * euros le client, trente clients par mois, quatre mille cinq cents euros de
 * budget. Et celle qu'on construit quand on pilote soi-même plusieurs canaux :
 * un coût par clic, des taux, un entonnoir.
 *
 * La carte tenait la première, mais se verrouillait dès qu'une campagne
 * détaillée existait — de peur d'écraser ce qui avait été saisi dessous. C'est
 * l'inverse qu'il fallait faire : lui donner sa propre ligne. Elle s'ajoute aux
 * campagnes au lieu de leur disputer la place, et le champ reste ouvert.
 */
function macroAcquisition(s, r, refresh) {
  const camps = s.marketing || []
  const simple = ligneSimple(camps)
  const autres = camps.filter((c) => c !== simple)

  const cac = simple ? Number(simple.cac) || 0 : 0
  const parMois = simple ? Number(simple.clientsPerMonth) || 0 : 0
  const budget = cac * parMois
  const ltv = Number(r?.kpis?.ltv) || 0

  // Ce que les campagnes détaillées ajoutent, dit sans qu'on ait à les ouvrir.
  const dets = (r?.revenue?.campaigns || []).filter((x) => autres.some((c) => c.id === x.id))
  const budgetAutres = dets.reduce((a, c) => a + (Number(c.totalSpend) || 0), 0) / 60
  const clientsAutres = dets.reduce((a, c) => a + (Number(c.totalClients) || 0), 0) / 60

  const pose = (patch) => {
    store.update((sc) => {
      let c = ligneSimple(sc.marketing)
      if (!c) {
        c = newCampaign({ name: 'Acquisition de clients', activityId: sc.activities[0]?.id || null, channel: 'ads' })
        sc.marketing.push(c)
      }
      c.simple = true
      c.model = 'cac'
      c.durationMonths = 60
      Object.assign(c, patch)
      c.monthlyBudget = (Number(c.cac) || 0) * (Number(c.clientsPerMonth) || 0)
    }, { label: 'Acquisition de clients' })
    refresh()
  }

  return h('section', { class: 'card acq-macro', 'data-gap': 'acquisition' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, 'Ce que te coûte un client'),
        h('div', { class: 'tiny muted' }, 'Deux nombres suffisent à chiffrer ton acquisition. Le budget s’en déduit.'),
      ),
    ),
    h('div', { class: 'card-body' },
      h('div', { class: 'grid grid-2 grid-fields' },
        numberField({
          label: 'Coût moyen pour gagner un client', field: 'cac', value: cac, suffix: '€', help: 'cac',
          hint: "Tout ce que tu dépenses pour qu'un client signe, divisé par le nombre de clients : publicité, commissions, salons, échantillons. Si une agence t'annonce un prix, c'est celui-là.",
          onInput: (v) => pose({ cac: v }),
        }),
        numberField({
          label: 'Nouveaux clients visés par mois', field: 'count', value: parMois, suffix: 'clients',
          hint: 'En plus de ceux qui viennent seuls. Laisse à zéro si tu ne dépenses rien pour en trouver.',
          onInput: (v) => pose({ clientsPerMonth: v }),
        }),
      ),
      h('div', { class: 'acq-sum' },
        h('div', { class: 'acq-sum-cell' },
          h('div', { class: 'acq-sum-label' }, 'Budget mensuel'),
          h('div', { class: 'acq-sum-value num' }, euro(budget))),
        h('div', { class: 'acq-sum-cell' },
          h('div', { class: 'acq-sum-label' }, 'Sur un an'),
          h('div', { class: 'acq-sum-value num' }, euro(budget * 12))),
        h('div', { class: 'acq-sum-cell' },
          h('div', { class: 'acq-sum-label' }, 'Clients gagnés en un an'),
          h('div', { class: 'acq-sum-value num' }, num(parMois * 12))),
      ),
      autres.length ? h('p', { class: 'acq-plus' },
        `Plus ${autres.length} campagne${autres.length > 1 ? 's' : ''} détaillée${autres.length > 1 ? 's' : ''} ci-dessous : `,
        h('strong', { class: 'num' }, euro(budgetAutres)),
        ' par mois pour ',
        h('strong', { class: 'num' }, num(clientsAutres, 1)),
        ` client${clientsAutres >= 2 ? 's' : ''} de plus. Les deux s’additionnent dans le modèle.`,
      ) : null,
      balance(cac > 0 ? cac : Number(r?.kpis?.cac) || 0, ltv),
    ),
  )
}

/** Ce qu'un client rapporte, face à ce qu'il coûte. Deux barres, une phrase. */
function balance(cac, ltv) {
  if (!(cac > 0)) return null
  if (!(ltv > 0)) {
    return h('div', { class: 'note mt' },
      h('div', { class: 'note-title' }, 'Il manque un prix de vente'),
      "Renseigne le prix et le coût de revient de ton offre pour que Fynomia puisse comparer ce qu'un client te rapporte à ce qu'il te coûte.")
  }
  const haut = Math.max(ltv, cac)
  return h('div', { class: 'acq-scale' },
    h('div', { class: 'acq-scale-head' }, h('span', {}, 'Ce qu’un client te rapporte, face à ce qu’il te coûte')),
    h('div', { class: 'acq-scale-row' },
      h('span', { class: 'acq-scale-tag' }, 'Rapporte'),
      h('span', { class: 'acq-scale-bar' }, h('i', { class: 'gain', style: { width: `${(ltv / haut) * 100}%` } })),
      h('span', { class: 'acq-scale-num num' }, euro(ltv)),
    ),
    h('div', { class: 'acq-scale-row' },
      h('span', { class: 'acq-scale-tag' }, 'Coûte'),
      h('span', { class: 'acq-scale-bar' }, h('i', { class: 'loss', style: { width: `${(cac / haut) * 100}%` } })),
      h('span', { class: 'acq-scale-num num' }, euro(cac)),
    ),
    h('p', { class: 'acq-scale-note' }, ratioAdvice(ltv / cac)),
  )
}

/** Le détail par campagne : canal, entonnoir, dates. À un clic, pas avant. */
function detailFold(s, r, open, refresh, add) {
  const simple = ligneSimple(s.marketing)
  const autres = s.marketing.filter((c) => c !== simple)
  const chiffre = autres.some((c) => !vierge(c))
  return fold(
    autres.length > 1 ? `Détailler par campagne — ${autres.length} campagnes` : 'Détailler par campagne',
    autres.length ? 'Canal, budget, entonnoir de conversion' : 'Un canal à la fois, avec son entonnoir',
    h('div', {},
      ...autres.map((c, i) => campaignCard(c, i, r, open, refresh)),
      autres.length ? null : h('p', { class: 'tiny muted' },
        'Aucune campagne détaillée. Le coût par client saisi au-dessus suffit à chiffrer ton acquisition ; une campagne sert à décomposer un canal — coût par clic, taux de conversion — et vient s’ajouter.'),
      h('div', { class: 'row mt' },
        h('span', { class: 'tiny muted' }, 'Une campagne par canal, ou par offre : les budgets et les clients s’additionnent.'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-sm', onClick: add }, 'Ajouter une campagne'),
      ),
    ),
    { id: 'acq-detail', open: chiffre },
  )
}

function ratioAdvice(ratio) {
  if (ratio === null) return ''
  if (ratio >= 3) return `Un client rapporte ${num(ratio, 1)} fois ce qu'il coûte. Au-delà de trois, l'acquisition est saine : tu peux dépenser davantage sans fragiliser le modèle.`
  if (ratio >= 1) return `Un client rapporte ${num(ratio, 1)} fois ce qu'il coûte. C'est positif mais court : le retour est lent et laisse peu de marge d'erreur. Travaille la conversion ou la valeur client avant d'augmenter le budget.`
  return `Un client te coûte plus qu'il ne te rapporte. En l'état, chaque client gagné creuse la perte : baisse le coût d'acquisition ou augmente le prix avant de dépenser.`
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
          ? `Tu récupères ce que coûte un client en ${num(payback, 1)} mois. Sous douze mois, l'acquisition s'autofinance presque : accélérer ne crée pas de trou de trésorerie durable.`
          : `Il faut ${num(payback, 1)} mois pour récupérer ce que coûte un client. Chaque client supplémentaire creuse d'abord la trésorerie avant de la remplir : c'est ce délai, plus que la rentabilité, qui fixe le rythme auquel tu peux croître.`),
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

  // Changer de canal ne réécrit rien.
  //
  // Il écrasait auparavant le coût par clic, les taux et le modèle d'achat
  // avec les ordres de grandeur du canal choisi : trois chiffres que le
  // fondateur venait de saisir disparaissaient sans qu'on le lui dise. Le
  // canal ne change désormais que le canal ; les ordres de grandeur restent
  // disponibles, mais il faut les demander — c'est le bouton juste en dessous.
  const applyChannel = (key) => set({ channel: key }, 'Changement de canal')

  const hints = CHANNELS[c.channel]?.defaults || {}
  const untouched = Object.keys(hints).every((k) => k === 'model' || !(Number(c[k]) > 0))
  const seed = () => { set(hints, 'Ordres de grandeur du canal'); refresh() }

  const on = c.enabled !== false
  return h('div', { class: `item ${isOpen ? 'open' : ''} ${on ? '' : 'is-off'}` },
    h('div', { class: 'item-head', onClick: () => { const etait = isOpen; open.clear(); if (!etait) open.add(c.id); refresh() } },
      enableToggle(on, (v) => {
        store.update((sc) => { const x = sc.marketing.find((y) => y.id === c.id); if (x) x.enabled = v },
          { label: v ? 'Campagne réactivée' : 'Campagne en pause' })
        refresh()
      }, `canal-${c.id}`),
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
      foldSign(),
    ),
    isOpen && h('div', { class: 'item-body' },
      // Une campagne naît à zéro : aucun taux inventé ne vient gonfler le
      // chiffre d'affaires à son insu. Les ordres de grandeur du canal sont
      // là pour qui n'a aucune idée par où commencer — mais c'est lui qui les
      // demande. Cette proposition se lisait sous trois grilles de champs,
      // c'est-à-dire après le moment où elle servait : elle ouvre la carte,
      // sur une ligne, et disparaît dès qu'un chiffre est posé.
      untouched && Object.keys(hints).length
        ? h('div', { class: 'seed-row' },
            h('p', {}, `Rien n'est chiffré — on peut partir des ordres de grandeur observés en ${(CHANNELS[c.channel]?.label || '').toLowerCase()}.`),
            h('button', { class: 'btn btn-sm', onClick: seed }, 'Les utiliser'),
          )
        : null,
      h('div', { class: 'grid grid-3 mt' },
        textField({ label: 'Nom de la campagne', value: c.name, onInput: (v, o) => set({ name: v }, undefined, o) }),
        selectField({
          label: 'Canal', value: c.channel,
          options: Object.entries(CHANNELS).map(([k, v]) => ({ value: k, label: v.label })),
          hint: 'Le canal décrit où tu dépenses. Il ne touche pas à tes chiffres.',
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
    fields.push(numberField({ label: "Coût d'acquisition", field: 'cac', value: c.cac, suffix: '€', hint: 'Si tu connais déjà ton CAC réel.', onInput: (v) => set({ cac: v }) }))
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
          ? `Chaque client te coûte ${euro(r.kpis.cac)} à acquérir et te rapporte ${euro(r.kpis.ltv)} de marge. Le rapport est de ${num(r.kpis.ltvCacRatio, 1)}, ${r.kpis.ltvCacRatio >= 3 ? "au-dessus du seuil de 3 généralement retenu comme sain : ton acquisition est rentable et peut être accélérée." : r.kpis.ltvCacRatio >= 1 ? "au-dessus de 1 mais en dessous de 3 : l'acquisition est rentable mais le retour est lent. Améliore la conversion ou la valeur client avant d'augmenter les budgets." : "en dessous de 1 : chaque client acquis toi coûte plus qu'il ne rapporte. Augmenter le budget aggraverait les pertes."}`
          : "Renseigne un prix de vente et un coût de revient dans l'onglet Offre pour que Fynomia calcule la rentabilité de ton acquisition.",
      ),
    ),
  )
}
