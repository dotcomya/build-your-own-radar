/** Offre et clients : ce que tu vends, à qui, à quel rythme. */

import { h, euro, pct, num, numberField, textField, selectField, helpButton, toast, confirmDialog, monthLabel, tabs, pageBar, refine, moduleHead } from '../dom.js'
import { newActivity, BOUNDS } from '../../state/schema.js'
import { sparkline, areaChart, PALETTE, STATUS } from '../charts.js'
import { vocabulary, getSector } from '../../state/sectors.js'
import { tutorial, stepBanner } from '../tutorial.js'
import { journey } from '../../engine/journey.js'
import { renderAcquisition } from './marketing.js'
import { todoPanel } from '../todo.js'
import store from '../../state/store.js'

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
  const view = views.some((v) => v && v.key === renderOffer.view) ? renderOffer.view : 'offres'
  renderOffer.view = view

  return h('div', { class: 'content' },

    moduleHead('02', 'Offre et revenus', "Tes offres : leur prix, leurs volumes et leurs conditions de paiement."),

    stepBanner('clients', journey(store.scenario, store.result), navigate, 'offre'),

    pageBar(
      s.activities.length > 1 ? `${s.activities.length} offres` : 'Ton offre',
      total > 0 ? `${euro(total, { compact: true })} de chiffre d'affaires cumulé sur cinq ans` : 'Ce que tu vends, à quel prix, à combien de clients',
      view === 'offres' ? h('button', { class: 'btn btn-primary btn-sm', onClick: addActivity }, '＋ Ajouter une offre') : null,
    ),

    tabs(views, view, (k) => { renderOffer.view = k; refresh() }),

    view === 'offres'
      ? h('div', { class: 'view' }, ...s.activities.map((a, i) => activityCard(a, i, r, level, open, refresh, duplicate)))
      : view === 'acquisition'
        ? h('div', { class: 'view' }, renderAcquisition(navigate, refresh))
        : h('div', { class: 'view' }, comparisonCard(r)),

    todoPanel('offre', store.scenario, () => refresh()),

    tutorial('clients', navigate),
  )
}

function activityCard(a, index, r, level, open, refresh, duplicate) {
  // Quelles parts de prix sont à l'écran : celles qui portent déjà un chiffre,
  // plus celles que l'utilisateur vient d'ouvrir. Retirer une part remet son
  // prix à zéro — c'est ce qui la fait disparaître du calcul comme de l'écran.
  const parts = activityCard.parts || (activityCard.parts = new Set())
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

  const key = (kind) => `${a.id}:${kind}`
  const hasUnit = (Number(a.unitPrice) || 0) > 0 || (Number(a.unitCost) || 0) > 0 || parts.has(key('unit'))
  const hasRecurring = (Number(a.recurringPrice) || 0) > 0 || (Number(a.recurringCost) || 0) > 0 || parts.has(key('recurring'))
  const addPart = (kind) => { parts.add(key(kind)); refresh() }
  const dropPart = (kind) => {
    parts.delete(key(kind))
    set(kind === 'unit' ? { unitPrice: 0, unitCost: 0 } : { recurringPrice: 0, recurringCost: 0 }, 'Retrait d\'une part de prix')
    refresh()
  }

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
      duplicate && h('button', {
        class: 'item-act', title: 'Dupliquer cette offre',
        onClick: (e) => { e.stopPropagation(); duplicate(a) },
      }, '⧉'),
      h('button', {
        class: 'item-act is-drop', title: 'Supprimer cette offre',
        onClick: (e) => { e.stopPropagation(); remove() },
      }, '−'),
      h('span', { class: 'disclose' }, '›'),
    ),
    isOpen && h('div', { class: 'item-body' },
      tabs(secs, sec, (k) => { activityCard.sec = k; refresh() }),

      sec === 'offre' ? h('div', { class: 'view' },

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

      sec === 'prix' ? h('div', { class: 'view' },

        // Vente à l'unité et abonnement ne s'excluent pas : une offre peut
        // être l'une, l'autre, ou les deux. Chaque part apparaît dès qu'elle
        // porte un prix, et s'ajoute d'un clic quand elle n'en a pas encore.
        hasUnit
          ? h('section', { class: 'part' },
              h('div', { class: 'part-head' },
                h('h5', {}, "Vente \u00e0 l'unit\u00e9"),
                h('span', { class: 'spacer' }),
                h('button', { class: 'part-drop', title: 'Retirer cette part', onClick: () => dropPart('unit') }, '\u00d7'),
              ),
              unitEconomics(`Une vente \u00e0 l'unit\u00e9`, a.unitPrice, a.unitCost),
              h('div', { class: 'grid grid-2' },
                numberField({ label: `Prix par ${voc.one}`, field: 'unitPrice', value: a.unitPrice, suffix: '\u20ac HT', onInput: (v) => set({ unitPrice: v }) }),
                numberField({ label: `Co\u00fbt de revient par ${voc.one}`, field: 'unitPrice', value: a.unitCost, suffix: '\u20ac HT', hint: 'Achats, sous-traitance, consommables. Ni loyer ni salaires.', onInput: (v) => set({ unitCost: v }) }),
              ),
              margin !== null && h('div', { class: `note ${margin < 0 ? 'danger' : margin < 0.2 ? 'warn' : 'ok'}`, style: { marginTop: '12px' } },
                h('div', { class: 'note-title' }, `Marge unitaire : ${euro((Number(a.unitPrice) || 0) - (Number(a.unitCost) || 0))} par vente, soit ${pct(margin, 0)}`),
                marginAdvice(margin)),
            )
          : h('button', { class: 'part-add', onClick: () => addPart('unit') }, '\uFF0B', h('span', {}, "Une vente \u00e0 l'unit\u00e9")),

        hasRecurring
          ? h('section', { class: 'part' },
              h('div', { class: 'part-head' },
                h('h5', {}, 'Abonnement'),
                h('span', { class: 'spacer' }),
                h('button', { class: 'part-drop', title: 'Retirer cette part', onClick: () => dropPart('recurring') }, '\u00d7'),
              ),
              unitEconomics("Un mois d'abonnement", a.recurringPrice, a.recurringCost),
              h('div', { class: 'grid grid-2' },
                numberField({ label: 'Abonnement mensuel', field: 'recurringPrice', value: a.recurringPrice, suffix: '\u20ac HT', onInput: (v) => set({ recurringPrice: v }) }),
                numberField({ label: 'Co\u00fbt mensuel r\u00e9current', field: 'recurringPrice', value: a.recurringCost, suffix: '\u20ac HT', hint: 'H\u00e9bergement, licence, support.', onInput: (v) => set({ recurringCost: v }) }),
              ),
              refine(`${a.id}-abo`, 'Affiner : dur\u00e9e de contrat, attrition, valeur vie client',
                h('div', { class: 'grid grid-2' },
                numberField({ label: 'Dur\u00e9e du contrat', field: 'contractMonths', value: a.contractMonths, suffix: 'mois', onInput: (v) => set({ contractMonths: v }) }),
                numberField({ label: 'Attrition mensuelle', field: 'churnMonthly', value: a.churnMonthly, percent: true, hint: '2 % par mois, c\u2019est un quart de la base perdu en un an.', onInput: (v) => set({ churnMonthly: v }) }),
                ),
                lifetimeValue(a),
              ),
            )
          : h('button', { class: 'part-add', onClick: () => addPart('recurring') }, '\uFF0B', h('span', {}, 'Un abonnement mensuel'))
      ) : null,

      sec === 'volumes' ? h('div', { class: 'view' },

        volumesEditor(a, setVolumes, level, detail)
      ) : null,

      sec === 'paiement' ? h('div', { class: 'view' },

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

      sec === 'evolution' ? h('div', { class: 'view' }, priceEvolutionFields(a, set)) : null,

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

function volumesEditor(a, setVolumes, level, detail) {
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
          level === 'advanced' && h('div', { class: 'grid grid-2 mt' },
            numberField({
              label: 'Décélération de la croissance', field: 'growthDecay', value: v.growthDecay ?? 0.96,
              step: 0.01, hint: "Aucune croissance ne se maintient cinq ans au même rythme. À 0,96, le taux perd 4 % de sa valeur chaque mois, produisant une courbe en S. Mets 1 pour une exponentielle pure.",
              onInput: (x) => setVolumes({ growthDecay: x }),
            }),
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

function priceEvolutionFields(a, set) {
  const years = [1, 2, 3, 4]
  return h('div', {},
    h('p', { class: 'view-intro' },
      "Par défaut, le prix d'une année reconduit celui de l'année précédente. Renseigne une case pour appliquer une hausse à partir de cette année."),
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
