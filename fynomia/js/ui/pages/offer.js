/** Offre et clients : ce que tu vends, à qui, à quel rythme. */

/**
 * Mensuel ou hebdomadaire : une conversion, pas un second modèle.
 *
 * Le montant stocké reste mensuel — c'est l'unité de tout le moteur. Seule la
 * saisie change d'échelle, et l'offre retient laquelle, pour que la carte, la
 * marge unitaire et le résumé parlent la même langue que le champ.
 */
const SEMAINES_PAR_MOIS = 52 / 12

const ABO_UNITS = [
  { key: 'mois', label: '€ / mois', title: 'Un prix par mois' },
  {
    key: 'semaine', label: '€ / sem.', title: 'Un prix par semaine',
    toDisplay: (v) => (Number(v) || 0) / SEMAINES_PAR_MOIS,
    fromDisplay: (v) => (Number(v) || 0) * SEMAINES_PAR_MOIS,
  },
]

const perKey = (a) => (a.recurringPeriod === 'semaine' ? 'semaine' : 'mois')
const perLabel = (a) => (perKey(a) === 'semaine' ? 'hebdomadaire' : 'mensuel')
const perOf = (a, v) => (perKey(a) === 'semaine' ? (Number(v) || 0) / SEMAINES_PAR_MOIS : Number(v) || 0)


import { h, euro, pct, num, numberField, textField, selectField, helpButton, toast, confirmDialog, monthLabel, tabs, refine, moduleShell, unitAmount, MINUS, CROSS, COPY, foldSign } from '../dom.js'
import { newActivity, BOUNDS } from '../../state/schema.js'
import { sparkline, areaChart, PALETTE, STATUS } from '../charts.js'
import { vocabulary, getSector } from '../../state/sectors.js'
import { tutorial, stepGuide } from '../tutorial.js'
import { journey } from '../../engine/journey.js'
import { valueForYear } from '../../engine/revenue.js'
import { enableToggle } from '../dom.js'
import { renderAcquisition } from './marketing.js'
import { todoPanel } from '../todo.js'
import { claim, goToGap } from '../spotlight.js'
import store from '../../state/store.js'
import { celebrate } from '../burst.js'
import { gardePage } from '../garde.js'
import { chiffresDePage } from '../chiffres-pages.js'
import { gardePrix, gardeAbonnement, gardeCroissance } from '../../engine/plausible.js'
import { tradeSuggest } from '../trade-suggest.js'

export function renderOffer(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const level = store.level
  const open = renderOffer.open || (renderOffer.open = new Set())
  // La première ligne s'ouvre à l'arrivée, pas à chaque rendu.
  //
  // « Si rien n'est ouvert, ouvre la première » se rejouait à chaque passage :
  // refermer la seule ligne de la liste était donc impossible — elle se
  // rouvrait dans la foulée, et le chevron ne servait à rien. On ne l'amorce
  // qu'une fois par dossier ouvert.
  if (renderOffer.seeded !== store.currentId) {
    renderOffer.seeded = store.currentId
    if (s.activities[0]) open.add(s.activities[0].id)
  }

  // Ajouter une offre n'est pas une fonctionnalité avancée : vendre deux choses
  // différentes est le cas courant, pas l'exception. Aucun niveau ne le bloque.
  const addActivity = (e) => {
    if (s.activities.length >= 8) { toast('Huit offres au maximum.', 'err'); return }
    let depuis = null
    try { depuis = e?.currentTarget?.getBoundingClientRect() || null } catch { depuis = null }
    const a = newActivity({ name: `Offre ${s.activities.length + 1}` })
    store.update((sc) => sc.activities.push(a), { label: 'Ajout d\'une offre' })
    focusOffer(a.id)
    refresh()
    if (depuis) celebrate(depuis, { kind: 'offers', label: a.name, cible: `[data-row="${a.id}"]` })
  }

  const duplicate = (src) => {
    if (s.activities.length >= 8) { toast('Huit offres au maximum.', 'err'); return }
    const copy = { ...JSON.parse(JSON.stringify(src)), id: newActivity().id, name: `${src.name} (copie)` }
    store.update((sc) => sc.activities.push(copy), { label: "Duplication de l'offre" })
    focusOffer(copy.id)
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

  // Les chiffres de la page d'abord, en une ligne ; la zone de travail ensuite.
  const chiffres = chiffresDePage('offre', refresh, navigate)

  return h('div', { class: 'content' },

    moduleShell({
      no: '02', title: 'Offre et revenus',
      lede: "Tes offres : leur prix, leurs volumes et leurs conditions de paiement.",
      figure: chiffres ? null : revenueFigure(s, r),
      guide: stepGuide('clients', journey(store.scenario, store.result), 'offre'),
      views, view, onPick: (k) => { renderOffer.view = k; refresh() },
      actions: [view === 'offres' ? h('button', { class: 'btn btn-primary btn-sm', 'data-gap': 'ajout-offre', onClick: addActivity }, '＋ Ajouter une offre') : null],
    }),
    chiffres || gardePage('offre', navigate),

    view === 'offres'
      ? h('div', { class: 'view' },
          // Les suggestions du métier ouvrent la page au lieu de la fermer.
          //
          // Un restaurateur qui n'a saisi que ses couverts a oublié les
          // boissons — son poste le plus rentable. Sous la liste, il ne le
          // lisait qu'après avoir déroulé tout ce qu'il avait déjà posé ; en
          // tête, c'est une rangée de pastilles qu'on prend ou qu'on laisse
          // avant même de commencer.
          tradeSuggest('offers', navigate, refresh),
          ...s.activities.map((a, i) => activityCard(a, i, r, level, open, refresh, duplicate, navigate)),
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
 * Le coût de revient ne se saisit pas ici.
 *
 * C'était un pavé ambre de quatre lignes qui expliquait où il était passé,
 * pourquoi, et ce qu'il ne fallait surtout pas faire — posé en plein milieu
 * de l'écran du prix, pour dire qu'il n'y était plus. Un lien suffit : ce que
 * coûte une vente vit dans les charges, on y va d'un clic, et le chiffre en
 * cours s'affiche dessus pour qu'on sache de quoi on parle.
 */
function costLink(a, voc, navigate) {
  const has = n(a.unitCost) > 0
  return h('button', {
    class: 'costlink',
    onClick: () => goToGap({ route: 'achats', view: 'charges', anchor: 'charges' }, navigate),
  },
    h('span', { class: 'costlink-text' },
      h('b', {}, has ? `Co\u00fbt de revient : ${euro(a.unitCost)} par unit\u00e9 vendue` : 'Ce que te co\u00fbte une vente'),
      h('span', {}, has
        ? 'Il est compt\u00e9 dans le r\u00e9sultat. Se modifie dans les charges par vente.'
        : 'Se saisit en charge par vente, avec les autres co\u00fbts.'),
    ),
    h('span', { class: 'costlink-go' }, 'Achats et co\u00fbts \u2192'),
  )
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
  if (!deal || !rate) return null

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

/**
 * Ouvrir une offre neuve, sur son premier onglet.
 *
 * L'onglet retenu est partagé par toutes les offres — c'est voulu : on compare
 * deux prix en passant de l'une à l'autre. Mais une offre qu'on vient de créer
 * n'a ni prix ni nom, et s'ouvrir sur « Volumes » revient à demander combien
 * on en vend avant d'avoir dit ce que c'est. Accepter une idée proposée doit
 * donc ouvrir cette offre-là, là où on la décrit.
 */
export function focusOffer(id) {
  activityCard.sec = 'offre'
  const open = renderOffer.open || (renderOffer.open = new Set())
  open.clear()
  if (id) open.add(id)
}

function activityCard(a, index, r, level, open, refresh, duplicate, navigate) {
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

  // « L'offre » et « Prix et marge » étaient deux onglets pour une seule
  // question : ce que tu vends, et combien. On saisissait un nom d'un côté,
  // son prix de l'autre, et il fallait faire l'aller-retour pour vérifier
  // qu'on parlait bien de la même chose. Ils n'en font plus qu'un.
  const secs = [
    { key: 'offre', label: 'Paramètres de base' },
    { key: 'volumes', label: 'Volumes' },
    { key: 'affiner', label: 'Hypothèses avancées' },
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

  return h('div', { class: `item ${isOpen ? 'open' : ''}`, 'data-row': a.id },
    // Une seule offre ouverte à la fois.
    //
    // Plusieurs cartes dépliées s'allumaient ensemble, et la couleur ne
    // désignait plus rien : elle disait « ouvert » là où on attendait « c'est
    // ici que je travaille ». Ouvrir referme donc les autres.
    h('div', { class: 'item-head', onClick: () => { const etait = isOpen; open.clear(); if (!etait) open.add(a.id); refresh() } },
      h('span', { class: 'swatch', style: { background: PALETTE[index % PALETTE.length], width: '10px', height: '10px' } }),
      h('div', { class: 'spacer' },
        h('div', { class: 'item-title' }, a.name || 'Sans nom'),
        h('div', { class: 'item-meta' },
          [
            mode === 'commission' && n(a.commissionRate) > 0
              ? `${pct(a.commissionRate, 1)} de ${euro(a.dealValue)}, soit ${euro(a.unitPrice)} par affaire`
              : mode === 'recurring' && n(a.recurringPrice) > 0
                ? `${euro(perOf(a, a.recurringPrice))}/${perKey(a) === 'semaine' ? 'sem.' : 'mois'} pendant ${a.contractMonths} mois`
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
      foldSign(),
    ),
    isOpen && h('div', { class: 'item-body' },
      tabs(secs, sec, (k) => { activityCard.sec = k; refresh() }),

      // Une ligne, quatre cases, rien d'autre.
      //
      // L'onglet empilait l'identite, le prix, le cout recurrent, les frais de
      // mise en route, une barre de marge et un volet « affiner » : six sujets
      // pour une offre qui tient en une phrase. Ce qui permet de decider — le
      // nom, la facon dont elle rapporte, son prix, sa TVA — occupe la ligne.
      // Tout le reste descend dans « Affiner », ou chaque bloc s'allume.
      sec === 'offre' ? h('div', { class: 'view', 'data-gap': 'prix' },
        h('div', { class: 'grid grid-4 offerline', 'data-gap': 'abonnement' },
          textField({ label: "Nom de l'offre", value: a.name, onInput: (v, o) => set({ name: v }, undefined, o) }),
          selectField({
            label: 'Type de vente', value: mode,
            options: MODES.map((m) => ({ value: m.key, label: m.label })),
            onInput: (v) => v === mode || setMode(v),
          }),
          mode === 'recurring'
            ? unitAmount({
                label: `Abonnement ${perLabel(a)}`, value: a.recurringPrice,
                units: ABO_UNITS, unit: perKey(a),
                onUnit: (k) => set({ recurringPeriod: k }),
                onInput: (v) => set({ recurringPrice: v }),
                garde: (v) => gardeAbonnement(store.scenario, v),
              })
            : mode === 'commission'
              ? numberField({
                  label: 'Ta commission', field: 'commissionRate', value: a.commissionRate, percent: true,
                  onInput: (v, o) => setCommission({ commissionRate: v }, o),
                })
              : numberField({
                  // Le mot du métier ne convient pas à toutes les offres d'un
                  // même plan : « prix par nuitée » sur un ménage de fin de
                  // séjour ne veut rien dire. « Prix » convient partout, et le
                  // nom de l'offre est juste à côté pour dire de quoi il s'agit.
                  label: 'Prix', field: 'unitPrice', value: a.unitPrice, suffix: '\u20ac HT',
                  onInput: (v) => set({ unitPrice: v }),
                  garde: (v) => gardePrix(store.scenario, v, { principale: (store.scenario.activities || []).findIndex((x) => x.id === a.id) <= 0 }),
                }),
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
        ),

        // La commission a besoin d'un second nombre pour que le premier veuille
        // dire quelque chose : c'est le montant de l'affaire, pas un reglage.
        mode === 'commission' ? h('div', { class: 'grid grid-2 mt' },
          numberField({
            label: "Montant moyen de l'affaire", field: 'dealValue', value: a.dealValue, suffix: '\u20ac HT',
            hint: "Ce que paie le client final — tu n'encaisses pas cette somme, tu en prends une part.",
            onInput: (v, o) => setCommission({ dealValue: v }, o),
          }),
          commissionRead(a, voc),
        ) : null,

        // Les couts ne se saisissent pas ici : ils vivent tous au meme endroit,
        // avec le loyer et les salaires. Le bouton y emmene.
        costLink(a, voc, navigate),
      ) : null,

      sec === 'volumes' ? h('div', { class: 'view', 'data-gap': 'volumes' },

        volumesEditor(a, setVolumes, level, detail, refresh)
      ) : null,

      // Un seul onglet pour tout ce qui affine.
      //
      // « Paiement » et « Prix par année » occupaient deux onglets de la
      // barre, à égalité avec le prix et les volumes — alors qu'on n'y va
      // qu'une fois le modèle posé. Ils descendent d'un cran : un onglet
      // « Affiner », et dedans deux volets qu'on ouvre s'il y a lieu.
      // Un affinement s'allume, et seulement alors il compte.
      //
      // Ces blocs etaient de simples volets : replies, leurs valeurs pesaient
      // quand meme sur le calcul, et personne ne pouvait savoir qu'un delai de
      // paiement a soixante jours dormait la. Chacun porte maintenant un
      // interrupteur : eteint, ses valeurs sont mises de cote et remplacees par
      // le cas neutre — comptant, sans attrition, prix constant. Rallume, elles
      // reviennent telles quelles.
      sec === 'affiner' ? h('div', { class: 'view', 'data-gap': 'paiement' },
        h('p', { class: 'view-intro' },
          'Des réglages plus fins pour cette offre. Chacun ne compte dans le calcul que s’il est activé ; désactivé, on prend l’hypothèse la plus simple, écrite sous son titre.'),

        mode === 'recurring' ? switchBlock({
          a, cle: 'signature', refresh,
          titre: 'Frais de mise en service',
          sous: 'Un montant payé une seule fois par le client, en plus de l’abonnement.',
          eteint: 'Désactivé : aucun frais au départ.',
          neutre: { unitPrice: 0 },
          corps: () => h('div', { class: 'grid grid-2' },
            numberField({
              label: 'À la signature', field: 'unitPrice', value: a.unitPrice, suffix: '€ HT',
              hint: 'Frais de mise en route, encaissés une fois.',
              onInput: (v) => set({ unitPrice: v }),
            }),
          ),
        }) : null,

        mode === 'recurring' ? switchBlock({
          a, cle: 'contrat', refresh,
          titre: 'Durée d’engagement et clients qui partent',
          sous: 'Combien de mois un client s’engage, et quelle part de tes abonnés arrête chaque mois.',
          eteint: 'Désactivé : contrats d’un an, et personne ne résilie.',
          neutre: { contractMonths: 12, churnMonthly: 0 },
          corps: () => h('div', {},
            h('div', { class: 'grid grid-2' },
              numberField({ label: 'Durée du contrat', field: 'contractMonths', value: a.contractMonths, suffix: 'mois', onInput: (v) => set({ contractMonths: v }) }),
              numberField({ label: 'Attrition mensuelle', field: 'churnMonthly', value: a.churnMonthly, percent: true, hint: '2 % par mois, c’est un quart de la base perdu en un an.', onInput: (v) => set({ churnMonthly: v }) }),
            ),
            lifetimeValue(a),
          ),
        }) : null,

        switchBlock({
          a, cle: 'paiement', refresh,
          titre: 'Délais de paiement et acomptes',
          sous: 'Combien de temps tes clients mettent à te payer, et toi à payer tes fournisseurs.',
          eteint: 'Désactivé : tout le monde paie comptant, le jour de la vente.',
          neutre: { deliveryLag: 0, paymentLag: 0, deposit: 0, milestone: 0, costPaymentLag: 0, costDeposit: 0 },
          corps: () => h('div', {},
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
            ),
          ),
        }),

        switchBlock({
          a, cle: 'evolution', refresh,
          titre: 'Hausse des prix d’une année à l’autre',
          sous: 'Pour prévoir une augmentation (ou une baisse) de prix après la première année.',
          eteint: 'Désactivé : le prix de l’année 1 reste le même pendant cinq ans.',
          neutre: { priceByYear: [], recurringPriceByYear: [] },
          corps: () => h('div', { 'data-gap': 'evolution' }, priceEvolutionFields(a, set)),
        }),
      ) : null,

      h('div', { class: 'view-foot' },
        h('button', { class: 'btn btn-sm btn-danger', onClick: remove }, 'Supprimer cette offre')),
    ),
  )
}

/**
 * Un affinement qu'on allume, et qui seulement alors compte.
 *
 * Replié, un volet gardait ses valeurs actives : un délai de paiement à
 * soixante jours saisi un jour pesait sur la trésorerie pour toujours, sans que
 * rien à l'écran ne le dise. L'interrupteur tranche — éteint, les valeurs sont
 * mises de côté et remplacées par le cas neutre : comptant, sans attrition,
 * prix constant. Rallumé, elles reviennent telles qu'elles étaient.
 *
 * Un plan écrit avant cet interrupteur n'a pas de drapeau : on le déduit alors
 * de ses chiffres. Un délai déjà posé allume son bloc, sinon rien ne compterait
 * plus du jour au lendemain.
 */
function switchBlock({ a, cle, titre, sous, eteint, neutre, corps, refresh }) {
  const pose = Object.keys(neutre).some((k) => {
    const v = a[k], d = neutre[k]
    if (Array.isArray(d)) return Array.isArray(v) && v.some((x) => x !== undefined && x !== null && x !== '')
    return (Number(v) || 0) !== (Number(d) || 0)
  })
  const on = a.refine && a.refine[cle] !== undefined ? !!a.refine[cle] : pose

  const bascule = (v) => {
    store.update((sc) => {
      const act = sc.activities.find((x) => x.id === a.id)
      if (!act) return
      act.refine = { ...(act.refine || {}) }
      act.refineSaved = { ...(act.refineSaved || {}) }
      if (v) {
        const garde = act.refineSaved[cle]
        if (garde) for (const k of Object.keys(garde)) act[k] = garde[k]
      } else {
        const garde = {}
        for (const k of Object.keys(neutre)) garde[k] = act[k]
        act.refineSaved[cle] = garde
        for (const k of Object.keys(neutre)) act[k] = Array.isArray(neutre[k]) ? [] : neutre[k]
      }
      act.refine[cle] = v
    }, { label: v ? 'Réglage activé' : 'Réglage désactivé' })
    refresh()
  }

  // Chaque réglage a son repère, allumé ou non : une étape du dossier qui y
  // mène doit pouvoir l'entourer même quand l'interrupteur est éteint.
  return h('section', { class: `tuneblock ${on ? 'is-on' : ''}`, 'data-gap': `tune-${cle}` },
    h('div', { class: 'tuneblock-head' },
      enableToggle(on, bascule, `tune-${a.id}-${cle}`),
      h('div', { class: 'spacer' },
        h('div', { class: 'tuneblock-title' }, titre),
        h('div', { class: 'tuneblock-sub' }, sous),
        on ? null : h('div', { class: 'tuneblock-off' }, eteint || 'Désactivé : on prend l’hypothèse la plus simple.'),
      ),
    ),
    on ? h('div', { class: 'tuneblock-body' }, corps()) : null,
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
            numberField({ label: 'Croissance mensuelle', field: 'monthlyGrowth', value: v.monthlyGrowth, percent: true, hint: '10 % par mois triple le volume en un an.', garde: (x) => gardeCroissance(store.scenario, x), onInput: (x) => setVolumes({ monthlyGrowth: x }) }),
            numberField({ label: 'Plafond de capacité', field: 'startUnits', value: v.cap, suffix: voc.many, hint: "Ce que tu ne peux physiquement pas dépasser. Vide = pas de limite.", onInput: (x) => setVolumes({ cap: x }) }),
          ),
          // Ce qui affine vient après ce qui décide.
          //
          // Trois nombres suffisent à poser une courbe de ventes : quand ça
          // commence, combien au départ, à quelle vitesse ça monte — et
          // jusqu'où on peut aller. Le freinage et l'attrition sont des
          // réglages de second tour : ils ne servent qu'à celui qui a déjà une
          // courbe et la trouve trop belle. Ils attendent donc derrière un pli.
          refine('offre-volumes-fin', 'Affiner la courbe : freinage et attrition',
          h('div', { class: 'grid grid-2' },
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
          )),
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
      values: detail.volumes, startDate: store.result?.startDate, height: 150, largeur: 1180,
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
