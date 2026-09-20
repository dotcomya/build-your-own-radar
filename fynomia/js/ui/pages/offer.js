/** Offre et clients : ce que tu vends, à qui, à quel rythme. */

import { h, euro, pct, num, numberField, textField, selectField, helpButton, toast, confirmDialog, monthLabel, tabs, refine, moduleShell, MINUS, CROSS, COPY } from '../dom.js'
import { newActivity, BOUNDS } from '../../state/schema.js'
import { sparkline, areaChart, PALETTE, STATUS } from '../charts.js'
import { vocabulary, getSector } from '../../state/sectors.js'
import { tutorial, stepGuide } from '../tutorial.js'
import { journey } from '../../engine/journey.js'
import { valueForYear } from '../../engine/revenue.js'
import { renderAcquisition } from './marketing.js'
import { todoPanel } from '../todo.js'
import { claim, goToGap } from '../spotlight.js'
import store from '../../state/store.js'
import { tradeSuggest } from '../trade-suggest.js'

export function renderOffer(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const level = store.level
  const open = renderOffer.open || (renderOffer.open = new Set())
  if (open.size === 0 && s.activities[0]) open.add(s.activities[0].id)

  // Ajouter une offre n'est pas une fonctionnalité avancée : vendre deux choses
  // différentes est le cas courant, pas l'exception. Aucun niveau ne le bloque.
  const addActivity = () => {
    if (s.activities.length >= 8) { toast('Huit offres au maximum.', 'err'); return }
    const a = newActivity({ name: `Offre ${s.activities.length + 1}` })
    store.update((sc) => sc.activities.push(a), { label: 'Ajout d\'une offre' })
    open.clear()
    open.add(a.id)
    refresh()
  }

  const duplicate = (src) => {
    if (s.activities.length >= 8) { toast('Huit offres au maximum.', 'err'); return }
    const copy = { ...JSON.parse(JSON.stringify(src)), id: newActivity().id, name: `${src.name} (copie)` }
    store.update((sc) => sc.activities.push(copy), { label: "Duplication de l'offre" })
    open.add(copy.id)
    refresh()
  }

  const total = (r?.revenue.perActivity || []).reduce((acc, x) => acc + x.total.reduce((p, q) => p + q, 0), 0)

  const views = [
    { key: 'offres', label: 'Offres', count: s.activities.length },
    // L'acquisition ne mérite pas un module à elle : ce qu'on dépense pour
    // trouver des clients décide des volumes, donc du chiffre d'affaires. Elle
    // vit là où elle agit.
    { key: 'acquisition', label: 'Acquisition', count: s.marketing.length },
    s.activities.length > 1 && r ? { key: 'compare', label: 'Comparaison' } : null,
  ]
  // Une intention posée par le panneau « à affiner » ouvre l'onglet, la carte
  // et la section où se trouve le champ manquant.
  const want = claim('offre')
  if (want) {
    if (want.view) renderOffer.view = want.view
    if (want.sec) activityCard.sec = want.sec
    if (want.openAll) s.activities.forEach((a) => open.add(a.id))
  }
  const view = views.some((v) => v && v.key === renderOffer.view) ? renderOffer.view : 'offres'
  renderOffer.view = view

  return h('div', { class: 'content' },

    moduleShell({
      no: '02', title: 'Offre et revenus',
      lede: "Tes offres : leur prix, leurs volumes et leurs conditions de paiement.",
      figure: revenueFigure(s, r),
      guide: stepGuide('clients', journey(store.scenario, store.result), 'offre'),
      views, view, onPick: (k) => { renderOffer.view = k; refresh() },
      actions: [view === 'offres' ? h('button', { class: 'btn btn-primary btn-sm', onClick: addActivity }, '＋ Ajouter une offre') : null],
    }),

    view === 'offres'
      ? h('div', { class: 'view' },
          ...s.activities.map((a, i) => activityCard(a, i, r, level, open, refresh, duplicate)),
          // Un restaurateur qui n'a saisi que ses couverts a oublié les
          // boissons — son poste le plus rentable. On le lui dit ici, avec le
          // mot qu'il emploie, pas dans un guide générique.
          tradeSuggest('offers', navigate, refresh),
        )
      : view === 'acquisition'
        ? h('div', { class: 'view' }, renderAcquisition(navigate, refresh))
        : h('div', { class: 'view' }, comparisonCard(r)),

    todoPanel('offre', store.scenario, navigate),

    tutorial('clients', navigate),
  )
}

const n = (v) => Number(v) || 0

/**
 * Les trois façons dont une offre rapporte.
 *
 * Elles ne sont pas trois calculs : ce sont trois questions. Ce que paie le
 * client une fois, ce qu'il paie tous les mois, ou la part qui te revient sur
 * une affaire que tu as amenée sans la porter. Le moteur, lui, ne connaît
 * qu'un prix et des volumes — la commission s'y ramène par une
 * multiplication, et c'est tant mieux : rien de nouveau à vérifier dans les
 * comptes.
 */
const MODES = [
  { key: 'unit', label: 'Vente unique', note: 'Le client paie une fois' },
  { key: 'recurring', label: 'Abonnement', note: 'Il paie tous les mois' },
  { key: 'commission', label: 'Commission', note: "Une part de l'affaire" },
]

/**
 * Le coût de revient hérité d'avant.
 *
 * Il ne se saisit plus ici — il vit dans les charges, où on le voit à côté
 * des autres. Mais un plan commencé avant ce déménagement en porte encore un,
 * et le moteur le compte toujours : le taire reviendrait à laisser un euro
 * sortir deux fois du résultat sans que personne ne puisse le voir.
 */
function legacyCost(a, voc, set) {
  if (!(n(a.unitCost) > 0)) return null
  return h('p', { class: 'cost-warn' },
    `Cette offre a un coût de revient de ${euro(a.unitCost)} par ${voc.one}. Il ne se saisit plus ici — il se règle en charge par vente, dans « Achats et coûts », où on le voit à côté des autres. Il reste compté : vérifie qu'il n'y figure pas aussi, sinon le même euro sort deux fois du résultat.`,
    h('button', {
      class: 'btn btn-quiet btn-sm', style: { marginLeft: '10px' },
      onClick: () => set({ unitCost: 0 }, 'Retrait du coût de revient'),
    }, 'L’enlever d’ici'))
}

/**
 * Ce que la commission donne, en clair.
 *
 * Deux pourcentages et un montant, c'est trois nombres à multiplier de tête.
 * La phrase le fait à sa place, et dit lequel des trois est celui qui entre
 * vraiment sur le compte.
 */
function commissionRead(a, voc) {
  const deal = n(a.dealValue), rate = n(a.commissionRate)
  const take = deal * rate
  if (!deal || !rate) {
    return h('p', { class: 'pmode-read is-empty' },
      "Pose le montant moyen d'une affaire et la part qui te revient : ton chiffre d'affaires sera cette part, pas l'affaire entière.")
  }
  return h('div', { class: 'pmode-read' },
    h('div', { class: 'pmode-read-line' },
      h('span', { class: 'num' }, euro(deal)),
      h('span', {}, "d'affaire"),
      h('span', { class: 'pmode-read-op' }, '×'),
      h('span', { class: 'num' }, pct(rate, 1)),
      h('span', { class: 'pmode-read-op' }, '='),
      h('strong', { class: 'num' }, euro(take)),
    ),
    h('p', {},
      `Tu encaisses ${euro(take)} par affaire apportée. C'est ce montant qui compte comme chiffre d'affaires — les ${euro(deal)} de l'affaire ne passent jamais par tes comptes. Les volumes se saisissent dans l'onglet voisin : une unité vaut une affaire.`),
  )
}

function activityCard(a, index, r, level, open, refresh, duplicate) {
  const voc = vocabulary(store.scenario)
  const isOpen = open.has(a.id)
  const detail = r?.revenue.perActivity.find((x) => x.id === a.id)
  const totalRevenue = detail ? detail.total.reduce((x, y) => x + y, 0) : 0
  const set = (patch, label = "Modification de l'offre", opts = {}) =>
    store.update((sc) => Object.assign(sc.activities.find((x) => x.id === a.id), patch), { label, ...opts })
  const setVolumes = (patch) =>
    store.update((sc) => Object.assign(sc.activities.find((x) => x.id === a.id).volumes, patch), { label: 'Volumes' })

  // Supprimer la dernière offre est légitime : on se trompe de modèle, on
  // recommence. La page sait se présenter vide, et le modèle aussi.
  const remove = async () => {
    if (await confirmDialog({ title: 'Supprimer cette offre ?', message: `« ${a.name} » et tout ce qui en dépend seront retirés du modèle.`, confirmLabel: 'Supprimer', danger: true })) {
      store.update((sc) => { sc.activities = sc.activities.filter((x) => x.id !== a.id) }, { label: 'Suppression' })
      refresh()
    }
  }

  const margin = (Number(a.unitPrice) || 0) > 0 ? 1 - (Number(a.unitCost) || 0) / (Number(a.unitPrice) || 1) : null

  const secs = [
    { key: 'offre', label: "L'offre" },
    { key: 'prix', label: 'Prix et marge' },
    { key: 'volumes', label: 'Volumes' },
    { key: 'paiement', label: 'Paiement' },
    { key: 'evolution', label: 'Prix par ann\u00e9e' },
  ]
  const sec = secs.some((x) => x && x.key === activityCard.sec) ? activityCard.sec : 'offre'

  // Comment cette offre rapporte : trois modes, un seul à la fois.
  //
  // C'était auparavant deux blocs qu'on ajoutait ou retirait, et qui
  // pouvaient coexister : l'écran ne disait plus quel modèle était le sien.
  // Un onglet le dit en un mot, et la commission d'apport d'affaires — qui
  // n'existait nulle part — y a sa place.
  //
  // Le mode déclaré ne l'emporte que s'il ne contredit pas les chiffres. Un
  // plan écrit avant que ce réglage n'existe — un modèle de métier, une
  // sauvegarde — porte le mode par défaut sans le savoir : si son prix est un
  // abonnement, c'est l'abonnement qui s'affiche, pas un champ vide.
  const stored = MODES.some((m) => m.key === a.priceMode) ? a.priceMode : null
  // Le mode déclaré ne cède que s'il ne sait pas montrer ce que l'offre porte.
  // Un abonnement sait afficher un montant à la signature en plus ; une vente
  // unique ne sait rien faire d'un prix mensuel, et le taire reviendrait à le
  // laisser peser sur le chiffre d'affaires depuis un champ invisible.
  const SHOWS = {
    unit: () => !(n(a.recurringPrice) > 0) && !(n(a.commissionRate) > 0),
    recurring: () => !(n(a.commissionRate) > 0),
    commission: () => !(n(a.recurringPrice) > 0),
  }
  const seen = n(a.commissionRate) > 0 ? 'commission'
    : n(a.recurringPrice) > 0 ? 'recurring'
    : n(a.unitPrice) > 0 ? 'unit' : null
  const mode = stored && SHOWS[stored]() ? stored : (seen || stored || 'unit')

  // Changer de mode remet à zéro le prix des autres : sans ça, un abonnement
  // saisi puis abandonné continuait d'alimenter le chiffre d'affaires depuis
  // un onglet qu'on ne regardait plus. L'annulation reste à un clic.
  const setMode = (k) => {
    const patch = { priceMode: k }
    if (k !== 'unit' && k !== 'commission') patch.unitPrice = 0
    if (k !== 'recurring') { patch.recurringPrice = 0; patch.recurringCost = 0 }
    if (k !== 'commission') { patch.dealValue = 0; patch.commissionRate = 0 }
    if (k === 'commission') patch.unitPrice = (Number(a.dealValue) || 0) * (Number(a.commissionRate) || 0)
    set(patch, 'Mode de revenu')
    refresh()
  }

  // La commission n'est pas un calcul à part : le prix de vente est le
  // montant de l'affaire multiplié par le pourcentage retenu. On le réécrit
  // à chaque frappe pour que le moteur, qui ne connaît que des prix, tombe
  // juste sans rien savoir de l'apport d'affaires.
  const setCommission = (patch, opts = {}) => {
    const next = { ...a, ...patch }
    set({ ...patch, unitPrice: (Number(next.dealValue) || 0) * (Number(next.commissionRate) || 0) },
      'Commission', opts)
  }

  return h('div', { class: `item ${isOpen ? 'open' : ''}` },
    h('div', { class: 'item-head', onClick: () => { isOpen ? open.delete(a.id) : open.add(a.id); refresh() } },
      h('span', { class: 'swatch', style: { background: PALETTE[index % PALETTE.length], width: '10px', height: '10px' } }),
      h('div', { class: 'spacer' },
        h('div', { class: 'item-title' }, a.name || 'Sans nom'),
        h('div', { class: 'item-meta' },
          [
            mode === 'commission' && n(a.commissionRate) > 0
              ? `${pct(a.commissionRate, 1)} de ${euro(a.dealValue)}, soit ${euro(a.unitPrice)} par affaire`
              : mode === 'recurring' && n(a.recurringPrice) > 0
                ? `${euro(a.recurringPrice)}/mois pendant ${a.contractMonths} mois`
                : n(a.unitPrice) > 0 ? `${euro(a.unitPrice)} l'unité` : null,
            margin !== null && n(a.unitCost) > 0 ? `${pct(margin, 0)} de marge` : null,
          ].filter(Boolean).join(' · ')),
      ),
      detail && h('div', { class: 'right', style: { marginRight: '10px' } },
        h('div', { class: 'small num', style: { fontWeight: '640' } }, euro(totalRevenue, { compact: true })),
        h('div', { class: 'tiny muted' }, 'CA sur 5 ans')),
      detail && h('div', { style: { marginRight: '8px' } }, sparkline({ values: yearly(detail.total), color: PALETTE[index % PALETTE.length] })),
      duplicate && h('button', {
        class: 'item-act', title: 'Dupliquer cette offre',
        onClick: (e) => { e.stopPropagation(); duplicate(a) },
        html: COPY,
      }),
      h('button', {
        class: 'item-act is-drop', title: 'Supprimer cette offre',
        onClick: (e) => { e.stopPropagation(); remove() },
        html: MINUS,
      }),
      h('span', { class: 'disclose' }, '›'),
    ),
    isOpen && h('div', { class: 'item-body' },
      tabs(secs, sec, (k) => { activityCard.sec = k; refresh() }),

      sec === 'offre' ? h('div', { class: 'view', 'data-gap': 'abonnement' },

        h('div', { class: 'grid grid-2' },
          textField({ label: "Nom de l'offre", value: a.name, onInput: (v, o) => set({ name: v }, undefined, o) }),
          selectField({
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
        )
      ) : null,

      sec === 'prix' ? h('div', { class: 'view', 'data-gap': 'prix' },

        // Le mode d'abord, le prix ensuite. Dans cet ordre, parce qu'un prix
        // ne veut rien dire tant qu'on ne sait pas s'il est encaissé une fois,
        // tous les mois, ou en pourcentage d'une affaire qu'on amène.
        h('div', { class: 'pmode' },
          ...MODES.map((m) => h('button', {
            class: `pmode-tab ${m.key === mode ? 'is-on' : ''}`,
            'aria-pressed': String(m.key === mode),
            onClick: () => m.key === mode || setMode(m.key),
          },
            h('span', { class: 'pmode-label' }, m.label),
            h('span', { class: 'pmode-note' }, m.note),
          )),
        ),

        mode === 'unit' ? h('section', { class: 'part' },
          h('div', {},
            numberField({
              label: `Prix par ${voc.one}`, field: 'unitPrice', value: a.unitPrice, suffix: '€ HT',
              hint: 'Ce que paie le client, une fois, hors taxes.',
              onInput: (v) => set({ unitPrice: v }),
            }),
          ),
          // Le coût de revient a quitté cette section : saisi ici, il était
          // recompté dans « Achats et coûts » neuf fois sur dix — le même euro
          // sorti deux fois du résultat. Il vit désormais à un seul endroit,
          // en charge par vente, où on le voit à côté des autres coûts.
          legacyCost(a, voc, set),
          margin !== null && n(a.unitCost) > 0
            ? h('div', { class: `note ${margin < 0 ? 'danger' : margin < 0.2 ? 'warn' : 'ok'}`, style: { marginTop: '12px' } },
                h('div', { class: 'note-title' }, `Marge unitaire : ${euro(n(a.unitPrice) - n(a.unitCost))} par vente, soit ${pct(margin, 0)}`),
                marginAdvice(margin))
            : null,
        ) : null,

        mode === 'recurring' ? h('section', { class: 'part' },
          h('div', { class: 'grid grid-2' },
            numberField({ label: 'Abonnement mensuel', field: 'recurringPrice', value: a.recurringPrice, suffix: '\u20ac HT', onInput: (v) => set({ recurringPrice: v }) }),
            numberField({ label: 'Co\u00fbt mensuel r\u00e9current', field: 'recurringPrice', value: a.recurringCost, suffix: '\u20ac HT', hint: 'H\u00e9bergement, licence, support.', onInput: (v) => set({ recurringCost: v }) }),
          ),
          // \u00ab Les deux \u00bb n'est pas un quatri\u00e8me mode : c'est un abonnement qui
          // porte en plus un montant encaiss\u00e9 \u00e0 la signature. Un plan qui en a un
          // doit pouvoir le voir \u2014 sinon il compte dans le chiffre d'affaires
          // depuis un champ que plus personne n'affiche.
          h('div', { class: 'grid grid-2' },
            numberField({
              label: '\u00c0 la signature', field: 'unitPrice', value: a.unitPrice, suffix: '\u20ac HT',
              hint: 'Frais de mise en route, encaiss\u00e9s une fois. Laisse \u00e0 z\u00e9ro s\u2019il n\u2019y en a pas.',
              onInput: (v) => set({ unitPrice: v }),
            }),
          ),
          unitEconomics("Un mois d'abonnement", a.recurringPrice, a.recurringCost),
          refine(`${a.id}-abo`, 'Affiner : dur\u00e9e de contrat, attrition, valeur vie client',
            h('div', { class: 'grid grid-2' },
              numberField({ label: 'Dur\u00e9e du contrat', field: 'contractMonths', value: a.contractMonths, suffix: 'mois', onInput: (v) => set({ contractMonths: v }) }),
              numberField({ label: 'Attrition mensuelle', field: 'churnMonthly', value: a.churnMonthly, percent: true, hint: '2 % par mois, c\u2019est un quart de la base perdu en un an.', onInput: (v) => set({ churnMonthly: v }) }),
            ),
            lifetimeValue(a),
          ),
        ) : null,

        mode === 'commission' ? h('section', { class: 'part' },
          h('div', { class: 'grid grid-2' },
            numberField({
              label: "Montant moyen de l'affaire", field: 'dealValue', value: a.dealValue, suffix: '\u20ac HT',
              hint: "Ce que paie le client final \u2014 tu n'encaisses pas cette somme, tu en prends une part.",
              onInput: (v, o) => setCommission({ dealValue: v }, o),
            }),
            numberField({
              label: 'Ta commission', field: 'commissionRate', value: a.commissionRate, percent: true,
              hint: "La part de l'affaire qui te revient.",
              onInput: (v, o) => setCommission({ commissionRate: v }, o),
            }),
          ),
          commissionRead(a, voc),
          legacyCost(a, voc, set),
        ) : null,
      ) : null,

      sec === 'volumes' ? h('div', { class: 'view', 'data-gap': 'volumes' },

        volumesEditor(a, setVolumes, level, detail, refresh)
      ) : null,

      sec === 'paiement' ? h('div', { class: 'view', 'data-gap': 'paiement' },

        h('div', { class: 'grid grid-2' },
          numberField({ label: 'Délai de livraison', field: 'deliveryLag', value: a.deliveryLag, suffix: 'mois', onInput: (v) => set({ deliveryLag: v }) }),
          numberField({ label: 'Délai de paiement client', field: 'paymentLag', value: a.paymentLag, suffix: 'mois', hint: '0 = comptant.', onInput: (v) => set({ paymentLag: v }) }),
          numberField({ label: 'Acompte à la commande', field: 'deposit', value: a.deposit, percent: true, hint: 'Réduit directement ton besoin de trésorerie.', onInput: (v) => set({ deposit: v }) }),
          numberField({ label: 'Solde intermédiaire', field: 'milestone', value: a.milestone, percent: true, onInput: (v) => set({ milestone: v }) }),
        ),
        paymentTimeline(a),
        h('div', { class: 'grid grid-2 mt' },
          numberField({ label: 'Délai de paiement fournisseur', field: 'paymentLag', value: a.costPaymentLag, suffix: 'mois', hint: 'Un délai long finance ton activité.', onInput: (v) => set({ costPaymentLag: v }) }),
          numberField({ label: 'Acompte versé au fournisseur', field: 'deposit', value: a.costDeposit, percent: true, onInput: (v) => set({ costDeposit: v }) }),
        )
      ) : null,

      sec === 'evolution' ? h('div', { class: 'view', 'data-gap': 'evolution' }, priceEvolutionFields(a, set)) : null,

      h('div', { class: 'view-foot' },
        h('button', { class: 'btn btn-sm btn-danger', onClick: remove }, 'Supprimer cette offre')),
    ),
  )
}

/**
 * L'économie d'une vente, en une barre.
 *
 * Un prix et un coût de revient côte à côte dans deux champs ne disent pas
 * grand-chose ; la même chose en proportions se lit d'un coup d'œil, et rend
 * visible le moment où le coût dépasse le prix.
 */
function unitEconomics(title, price, cost) {
  const p = Math.max(0, Number(price) || 0)
  const c = Math.max(0, Number(cost) || 0)
  const margin = p - c
  const span = Math.max(p, c) || 1
  const rate = p > 0 ? margin / p : null
  const tone = margin < 0 ? 'bad' : rate !== null && rate < 0.2 ? 'thin' : 'ok'
  return h('div', { class: `ueco ueco-${tone}` },
    h('div', { class: 'ueco-head' },
      h('span', { class: 'ueco-title' }, title),
      h('span', { class: 'spacer' }),
      h('span', { class: 'ueco-price num' }, euro(p)),
    ),
    h('div', { class: 'ueco-bar' },
      h('span', { class: 'ueco-cost', style: { width: `${(Math.min(c, span) / span) * 100}%` } }),
      h('span', { class: 'ueco-margin', style: { width: `${(Math.max(0, margin) / span) * 100}%` } }),
      margin < 0 && h('span', { class: 'ueco-loss', style: { width: `${(Math.min(-margin, span) / span) * 100}%` } }),
    ),
    h('div', { class: 'ueco-legend' },
      h('span', {}, h('i', { class: 'ueco-dot cost' }), 'Coût de revient ', h('b', { class: 'num' }, euro(c))),
      h('span', {}, h('i', { class: `ueco-dot ${margin < 0 ? 'loss' : 'margin'}` }),
        margin < 0 ? 'Perte ' : 'Marge ', h('b', { class: 'num' }, euro(margin)),
        rate !== null ? h('span', { class: 'muted' }, ` · ${pct(rate, 0)}`) : null),
    ),
  )
}

/**
 * Ce que rapporte un abonné sur toute sa durée de vie.
 *
 * C'est le chiffre qui décide de ce qu'on peut dépenser pour l'acquérir ;
 * il n'a pas à être calculé à la main.
 */
function lifetimeValue(a) {
  const price = Number(a.recurringPrice) || 0
  const cost = Number(a.recurringCost) || 0
  const churn = Number(a.churnMonthly) || 0
  const contract = Number(a.contractMonths) || 0
  const life = churn > 0 ? Math.min(1 / churn, contract || Infinity) : contract || 24
  const ltv = (price - cost) * life
  return h('div', { class: 'ueco-sum' },
    h('div', {},
      h('div', { class: 'ueco-sum-label' }, 'Durée de vie moyenne'),
      h('div', { class: 'ueco-sum-value num' }, `${num(life, 0)} mois`),
    ),
    h('div', {},
      h('div', { class: 'ueco-sum-label' }, 'Marge cumulée par client'),
      h('div', { class: 'ueco-sum-value num' }, euro(ltv)),
    ),
    h('p', { class: 'ueco-sum-note' },
      `C'est le plafond de ce que tu peux dépenser pour gagner un client. Au-delà de ${euro(ltv / 3)} par client acquis, l'acquisition coûte plus qu'elle ne rapporte à court terme.`),
  )
}

/**
 * Qui paie quoi, et quand.
 *
 * Quatre pourcentages et deux délais dans des champs ne laissent pas voir le
 * trou de trésorerie qu'ils décrivent. La frise le montre : chaque versement
 * à sa place sur l'axe du temps, et l'écart entre la livraison et l'encaissement
 * matérialisé en clair.
 */
function paymentTimeline(a) {
  const deposit = Math.max(0, Number(a.deposit) || 0)
  const milestone = Math.max(0, Number(a.milestone) || 0)
  const balance = Math.max(0, 1 - deposit - milestone)
  const delivery = Math.max(0, Number(a.deliveryLag) || 0)
  const pay = Math.max(0, Number(a.paymentLag) || 0)
  const last = delivery + pay

  const steps = [
    { month: 0, share: deposit, label: 'Acompte à la commande' },
    { month: delivery / 2, share: milestone, label: 'Solde intermédiaire' },
    { month: last, share: balance, label: 'Solde à la livraison' },
  ].filter((st) => st.share > 0)

  // Tout encaisser le jour de la commande est un cas fréquent — et une frise
  // dont tous les points se superposent ne montre rien. On dit alors la chose
  // en clair plutôt que de dessiner un axe de longueur nulle.
  if (last === 0) {
    return h('div', { class: 'tline-flat' },
      h('span', { class: 'tline-flat-dot' }),
      h('div', {},
        h('div', { class: 'tline-flat-title' }, 'Payé comptant, le jour de la commande'),
        h('div', { class: 'tline-flat-note' },
          "Aucun délai entre la vente et l'encaissement : cette offre ne crée aucun besoin en fonds de roulement."),
      ),
    )
  }

  const at = (m) => (m / last) * 100
  return h('div', { class: 'tline' },
    h('div', { class: 'tline-track' },
      h('span', { class: 'tline-rule' }),
      h('span', {
        class: 'tline-gap',
        style: { left: `${at(delivery)}%`, width: `${Math.max(0, at(last) - at(delivery))}%` },
        title: "Entre la livraison et l'encaissement, c'est toi qui finances",
      }),
      // Sous chaque point, la part et la date seulement : le nom du versement
      // tiendrait rarement sans chevaucher le suivant, il se lit en dessous.
      ...steps.map((st, i) => h('span', {
        class: 'tline-point paid',
        style: { left: `${at(st.month)}%` },
        'data-side': i === 0 ? 'start' : i === steps.length - 1 ? 'end' : 'mid',
        title: st.label,
      },
        h('i'),
        h('span', { class: 'tline-label' },
          h('b', {}, pct(st.share, 0)),
          h('span', {}, st.month === 0 ? 'jour J' : `M+${num(st.month, st.month % 1 ? 1 : 0)}`),
        ),
      )),
    ),
    h('p', { class: 'tline-note' },
      h('span', { class: 'tline-split' }, steps.map((st) => `${pct(st.share, 0)} ${st.label.toLowerCase()}`).join(' · ')),
      `Entre la commande et l'encaissement du solde, ${pct(balance, 0)} du prix reste à ton charge pendant ${num(last, 0)} mois. C'est ce délai, et non ta rentabilité, qui crée le besoin en fonds de roulement.`),
  )
}

function volumesEditor(a, setVolumes, level, detail, refresh = () => {}) {
  const v = a.volumes || {}
  const voc = vocabulary(store.scenario)
  const isManual = v.mode === 'manual'
  return h('div', {},
    h('div', { class: 'row mb' },
      h('div', { class: 'seg' },
        h('button', { class: `seg-btn ${!isManual ? 'active' : ''}`, onClick: () => setVolumes({ mode: 'growth' }) }, 'Courbe de croissance'),
        h('button', { class: `seg-btn ${isManual ? 'active' : ''}`, onClick: () => setVolumes({ mode: 'manual', manual: v.manual?.length ? v.manual : buildManual(a) }) }, 'Saisie mois par mois'),
      ),
    ),
    isManual
      ? manualGrid(a, setVolumes)
      : h('div', {},
          h('div', { class: 'grid grid-4' },
            numberField({ label: 'Premier mois de vente', field: 'month', value: v.launchMonth, suffix: 'M', hint: 'Mois 0 = démarrage.', onInput: (x) => setVolumes({ launchMonth: x }) }),
            numberField({ label: `${voc.many[0].toUpperCase()}${voc.many.slice(1)} le premier mois`, field: 'startUnits', value: v.startUnits, suffix: voc.many, onInput: (x) => setVolumes({ startUnits: x }) }),
            numberField({ label: 'Croissance mensuelle', field: 'monthlyGrowth', value: v.monthlyGrowth, percent: true, hint: '10 % par mois triple le volume en un an.', onInput: (x) => setVolumes({ monthlyGrowth: x }) }),
            numberField({ label: 'Plafond de capacité', field: 'startUnits', value: v.cap, suffix: voc.many, hint: "Ce que tu ne peux physiquement pas dépasser. Vide = pas de limite.", onInput: (x) => setVolumes({ cap: x }) }),
          ),
          h('div', { class: 'grid grid-2 mt' },
            numberField({
              label: 'Décélération de la croissance', field: 'growthDecay',
              // Le champ dit un freinage — 0 % veut dire « le taux que j'ai
              // saisi tient ». Le modèle, lui, garde un coefficient : 4 % de
              // freinage, c'est 0,96 par mois.
              value: Math.round((1 - (v.growthDecay ?? 1)) * 100) / 100, percent: true,
              hint: "0 % : le taux saisi s’applique tous les mois, cinq ans durant. Au-delà, il perd cette part de sa valeur chaque mois et la courbe s’aplatit en S.",
              onInput: (x) => setVolumes({ growthDecay: Math.min(1, Math.max(0, 1 - (Number(x) || 0))) }),
            }),
            // Freiner la croissance est une manière de dire qu'on perd des
            // clients. Mieux vaut le dire à l'endroit prévu pour ça.
            h('div', { class: 'note plain' },
              h('div', { class: 'note-title' }, 'Ou bien c’est de l’attrition'),
              h('p', { style: { margin: '0 0 8px' } },
                "Si ta croissance ralentit, c’est souvent que des clients partent. L’attrition le dit mieux qu’un freinage : elle enlève des clients tous les mois, et le modèle recalcule ce qu’il faut en gagner rien que pour rester au même niveau."),
              h('button', {
                class: 'btn btn-quiet btn-sm',
                onClick: () => goToGap({ route: 'offre', view: 'offres', sec: 'offre', openAll: true, anchor: 'abonnement' }, () => refresh()),
              }, 'Poser mon attrition →'),
            ),
          ),
          detail && volumeVisual(detail, voc),
        ),
  )
}

/**
 * La courbe des volumes, et ce qu'elle donne chaque année.
 *
 * Une phrase de projection ne montre ni la forme de la courbe, ni le moment où
 * elle décolle, ni le plafond qu'elle atteint. Le dessin le fait, et le
 * tableau donne les nombres à recopier dans un dossier.
 */
function volumeVisual(detail, voc) {
  const units = yearly(detail.volumes)
  const revenue = yearly(detail.total)
  const total = units.reduce((a, b) => a + b, 0)
  if (total <= 0) {
    return h('div', { class: 'note plain mt' },
      `Aucun volume projeté pour l'instant : renseigne le premier mois de vente et le nombre de ${voc.many} pour voir la courbe apparaître.`)
  }
  const peak = Math.max(...detail.volumes)
  const peakMonth = detail.volumes.indexOf(peak)

  return h('div', { class: 'vol' },
    h('div', { class: 'vol-head' },
      h('span', {}, `${voc.many[0].toUpperCase()}${voc.many.slice(1)} ${voc.verb}, mois par mois`),
      h('span', { class: 'spacer' }),
      h('span', { class: 'tiny muted' }, `sommet à ${num(peak)} en ${monthLabel(peakMonth, store.result?.startDate)}`),
    ),
    areaChart({
      values: detail.volumes, startDate: store.result?.startDate, height: 170,
      color: PALETTE[2], markZero: false, formatter: (v) => num(v, 0),
    }),
    h('div', { class: 'vol-years' },
      ...units.map((u, y) => h('div', { class: 'vol-year' },
        h('div', { class: 'vol-year-tag' }, `A${y + 1}`),
        h('div', { class: 'vol-year-bar' },
          h('i', { style: { height: `${Math.max(3, (u / Math.max(...units, 1)) * 100)}%` } })),
        h('div', { class: 'vol-year-units num' }, num(u)),
        h('div', { class: 'vol-year-rev num' }, euro(revenue[y], { compact: true })),
      )),
    ),
    h('p', { class: 'vol-note' },
      `${num(units[0])} ${voc.many} en année 1, ${num(units[4])} en année 5 — soit ${units[0] > 0 ? `× ${num(units[4] / units[0], 1)}` : 'un démarrage'} en cinq ans.`),
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
            const input = h('input', { type: 'number', min: 0, value: manual[i] || 0, style: { width: '52px', border: '1px solid var(--rule)', borderRadius: '5px', padding: '3px 5px', textAlign: 'right', fontSize: '12px' } })
            input.addEventListener('change', () => commit(i, input.value))
            return h('td', { style: { padding: '3px' } }, input)
          }),
          h('td', { class: 'num', style: { fontWeight: '640' } }, num(sumRange(manual, y * 12, y * 12 + 12))),
        )),
      ),
    ),
  )
}

/**
 * Le prix des années suivantes.
 *
 * Les quatre cases étaient vides, sans dire ce qui s'appliquait quand même.
 * On lisait donc « rien » là où le moteur lisait « le prix de l'année
 * précédente », et rien ne signalait qu'une année avait été forcée.
 *
 * Chaque case porte maintenant en gris le prix effectivement retenu : tant
 * qu'on n'écrit pas, l'année reconduit la précédente et la case le montre.
 * Dès qu'on écrit, la valeur passe en noir et un « × » permet de revenir à
 * l'héritage.
 */
function priceEvolutionFields(a, set) {
  const years = [1, 2, 3, 4]
  const hasUnit = (Number(a.unitPrice) || 0) > 0
  const hasRec = (Number(a.recurringPrice) || 0) > 0

  const row = (title, baseKey, arrKey, suffix) => {
    const arr = a[arrKey] || []
    return h('div', { class: 'byyear' },
      h('div', { class: 'byyear-head' },
        h('span', { class: 'byyear-title' }, title),
        h('span', { class: 'byyear-base num' }, `${euro(a[baseKey])} en année 1`),
      ),
      h('div', { class: 'byyear-cells' },
        ...years.map((y) => {
          const own = arr[y - 1]
          const forced = own !== undefined && own !== null && own !== ''
          const inherited = valueForYear(a[baseKey], arr, y)
          return h('div', { class: `byyear-cell ${forced ? 'is-forced' : ''}` },
            numberField({
              label: `Année ${y + 1}`, field: baseKey,
              value: forced ? own : '', suffix,
              placeholder: Math.round(inherited),
              muted: !forced,
              onInput: (v) => { const next = arr.slice(); next[y - 1] = v; set({ [arrKey]: next }) },
            }),
            forced ? h('button', {
              class: 'byyear-clear', title: 'Revenir au prix de l’année précédente',
              onClick: () => { const next = arr.slice(); next[y - 1] = ''; set({ [arrKey]: next }) },
              html: CROSS,
            }) : null,
          )
        }),
      ),
    )
  }

  return h('div', {},
    h('p', { class: 'view-intro' },
      "Une année vide reconduit le prix de la précédente : le montant en gris est celui qui s’applique. Écris dans une case pour forcer une hausse à partir de cette année-là."),
    // En commission, le prix unitaire est ce que tu encaisses par affaire :
    // l'appeler « prix unitaire » ferait croire qu'on parle de l'affaire entière.
    hasUnit
      ? row(n(a.commissionRate) > 0 ? 'Ta commission par affaire' : 'Prix unitaire', 'unitPrice', 'priceByYear', '€ HT')
      : null,
    hasRec ? row('Abonnement mensuel', 'recurringPrice', 'recurringPriceByYear', '€ HT/mois') : null,
    !hasUnit && !hasRec
      ? h('p', { class: 'muted small' }, 'Renseigne d’abord un prix dans l’onglet « Prix et marge ».')
      : null,
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
  if (margin < 0) return "Tu vends à perte : chaque vente supplémentaire aggrave le résultat. Revois le prix ou le coût de revient."
  if (margin < 0.2) return "Marge faible : il faudra un volume important pour couvrir tes frais fixes. Vérifie que tes volumes projetés sont atteignables."
  if (margin < 0.5) return "Marge correcte, typique du négoce et de la production. Ton point mort dépendra surtout de tes frais fixes."
  return "Marge élevée, caractéristique des services et du logiciel. Chaque nouveau client contribue fortement à couvrir tes frais fixes."
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

/** Le chiffre du module : ce que les offres saisies rapportent la première année. */
function revenueFigure(s, r) {
  if (!r || !s.activities.length) return null
  const y1 = (r.revenue?.total || []).slice(0, 12).reduce((a, v) => a + v, 0)
  return y1 > 0 ? { value: euro(y1), note: 'de chiffre d’affaires la première année' } : null
}
