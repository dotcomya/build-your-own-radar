/**
 * Le parcours guidé — onze questions, une à la fois.
 *
 * Un prévisionnel demande une soixantaine de chiffres. Les demander tous sur le
 * même écran, c'est ce que fait un tableur, et c'est précisément ce qui fait
 * abandonner. On en demande donc onze, une par écran, dans l'ordre où ils se
 * répondent — et Fizzy déduit le reste.
 *
 * Trois règles tenues bout à bout :
 *
 *  1. UNE question par écran. Jamais deux idées à la fois.
 *  2. Le vocabulaire du fondateur, pas celui du comptable. On demande « vous
 *     démarrez avec combien ? », pas « quel est votre plan de financement
 *     initial ». Le mot juste arrive plus tard, quand le chiffre est là.
 *  3. Chaque réponse produit immédiatement une conséquence visible. C'est ce
 *     qui distingue ce parcours d'un formulaire : on voit le modèle se
 *     construire sous soi.
 *
 * Rien n'est irréversible : on revient en arrière, et tout reste modifiable
 * ensuite dans les pages détaillées.
 */

import { h, euro, num, pct, toast } from '../dom.js'
import { sectorsByFamily, SECTORS, getSector, vocabulary } from '../../state/sectors.js'
import { newTeamMember, newOpex } from '../../state/schema.js'
import { compute } from '../../engine/engine.js'
import store from '../../state/store.js'

/** Le poste du fondateur dans l'équipe, quel que soit le mot employé. */
const ME = new RegExp('fondateur|dirigeant|g\u00E9rant|moi', 'i')

/** Où en est le parcours. Conservé entre deux rendus de la page. */
const flow = { index: 0, started: false }

export function resetSetup() { flow.index = 0; flow.started = false }

/* ──────────────────────────────── Les écrans ────────────────────────────── */

const STEPS = [
  {
    key: 'metier',
    question: 'Vous faites quoi ?',
    help: "Le métier commande la TVA, votre statut et les repères de marge. C'est le seul choix qui change tout le reste.",
    render: sectorPicker,
    ready: (s) => !!s?.meta?.sectorKey,
  },
  {
    key: 'nom',
    question: 'Ça s’appelle comment ?',
    help: 'Le nom de votre projet. Vous pourrez le changer quand vous voudrez.',
    render: (ctx) => field(ctx, {
      type: 'text', placeholder: 'Mon projet',
      value: (s) => s.meta.company || '',
      apply: (s, v) => { s.meta.company = v; if (v.trim()) s.meta.name = v.trim() },
    }),
    ready: () => true,
  },
  {
    key: 'offre',
    question: 'Vous vendez quoi ?',
    help: (s) => `Une ${vocabulary(s).one}, un forfait, un abonnement — dites-le comme vous le diriez à un client.`,
    render: (ctx) => field(ctx, {
      type: 'text', placeholder: (s) => vocabulary(s).one,
      value: (s) => (s.activities[0]?.name === 'À définir' ? '' : s.activities[0]?.name || ''),
      apply: (s, v) => { if (s.activities[0]) s.activities[0].name = v.trim() || 'Mon offre' },
    }),
    ready: () => true,
  },
  {
    key: 'prix',
    question: 'Vous le vendez combien ?',
    help: 'Hors taxes, le prix que le client voit sur la facture.',
    render: priceScreen,
    ready: (s) => (Number(s?.activities?.[0]?.unitPrice) || 0) > 0 || (Number(s?.activities?.[0]?.recurringPrice) || 0) > 0,
  },
  {
    key: 'cout',
    question: 'Ça vous coûte combien à produire ?',
    help: "Tout ce qui augmente quand vous en vendez un de plus : matières, sous-traitance, commission, livraison. Zéro est une réponse valable.",
    render: costScreen,
    ready: () => true,
  },
  {
    key: 'clients',
    question: 'Combien de clients le premier mois ?',
    help: "Pas une ambition : ce que vous pouvez livrer et facturer dès le début. C'est le chiffre le plus discuté d'un business plan.",
    render: clientsScreen,
    ready: (s) => (Number(s?.activities?.[0]?.volumes?.startUnits) || 0) > 0,
  },
  {
    key: 'croissance',
    question: 'Ça grandit à quelle vitesse ?',
    help: 'Fizzy freine automatiquement la courbe dans la durée — aucune croissance ne tient cinq ans au même rythme.',
    render: growthScreen,
    ready: () => true,
  },
  {
    key: 'salaire',
    question: 'Vous vous payez combien par mois ?',
    help: "Brut. Fizzy calcule les cotisations. Un plan où le fondateur ne se paie pas n'est pas prudent — il est faux.",
    render: salaryScreen,
    ready: () => true,
  },
  {
    key: 'frais',
    question: 'Vos frais tous les mois',
    help: 'Cochez ce qui vous concerne. Les montants sont des ordres de grandeur pour votre métier — corrigez-les.',
    render: costsScreen,
    ready: () => true,
  },
  {
    key: 'depart',
    question: 'Vous démarrez avec combien ?',
    help: "L'argent déjà disponible : votre apport, celui de vos associés. On verra plus tard s'il en manque.",
    render: cashScreen,
    ready: () => true,
  },
  {
    key: 'fin',
    question: 'Votre business plan est prêt',
    render: doneScreen,
    ready: () => true,
    last: true,
  },
]

/* ─────────────────────────────── La page ────────────────────────────────── */

export function renderSetup(navigate, refresh) {
  const s = store.scenario
  const step = STEPS[Math.min(flow.index, STEPS.length - 1)]

  // Le premier écran crée le plan ; avant lui il n'y a rien à modifier.
  const ctx = { navigate, refresh, scenario: s, step }

  const go = (delta) => {
    const next = flow.index + delta
    if (next < 0) return
    if (next >= STEPS.length) { navigate('#/parcours'); return }
    flow.index = next
    refresh()
  }
  ctx.go = go

  const canNext = step.ready(s)

  return h('div', { class: 'setup' },
    h('div', { class: 'setup-bar' },
      h('div', { class: 'setup-bar-fill', style: { width: `${(flow.index / (STEPS.length - 1)) * 100}%` } }),
    ),

    h('div', { class: 'setup-top' },
      h('button', {
        class: 'setup-back', disabled: flow.index === 0,
        onClick: () => go(-1),
      }, '←'),
      h('span', { class: 'setup-count' }, `${flow.index + 1} / ${STEPS.length}`),
      h('button', {
        class: 'setup-skip',
        onClick: () => navigate(s ? '#/parcours' : '#/'),
      }, s ? 'Tout voir' : 'Annuler'),
    ),

    h('div', { class: 'setup-stage' },
      h('div', { class: `setup-card ${step.last ? 'is-last' : ''}` },
        h('h1', { class: 'setup-q' }, typeof step.question === 'function' ? step.question(s) : step.question),
        step.help ? h('p', { class: 'setup-help' }, typeof step.help === 'function' ? step.help(s) : step.help) : null,
        h('div', { class: 'setup-body' }, step.render(ctx)),
        !step.last ? h('div', { class: 'setup-actions' },
          h('button', {
            class: 'btn btn-primary btn-lg', disabled: !canNext, onClick: () => go(1),
          }, flow.index === STEPS.length - 2 ? 'Voir le résultat →' : 'Continuer →'),
          !canNext ? h('span', { class: 'setup-hint' }, 'Renseignez ce champ pour continuer') : null,
        ) : null,
      ),
      liveEcho(s, step),
    ),
  )
}

/**
 * L'écho.
 *
 * À droite de la question, ce que la réponse vient de produire. C'est la pièce
 * qui fait la différence avec un formulaire : on ne remplit pas des cases, on
 * regarde un modèle se construire.
 */
function liveEcho(s, step) {
  if (!s || step.key === 'metier' || step.last) return null
  const reached = (key) => STEPS.findIndex((x) => x.key === key) <= flow.index
  let r = null
  try { r = compute(s) } catch { return null }

  const a = s.activities[0] || {}
  const voc = vocabulary(s)
  const months = Math.max(1, Number(a.contractMonths) || 1)
  const perClient = (Number(a.unitPrice) || 0) - (Number(a.unitCost) || 0)
    + ((Number(a.recurringPrice) || 0) - (Number(a.recurringCost) || 0)) * months
  const y = 0
  const fixed = r.kpis.fixedCosts[y] || 0
  const need = fixed > 0 && perClient > 0 ? Math.ceil(fixed / perClient) : null

  const lines = []
  if (perClient > 0) lines.push({ k: `Un ${voc.client} rapporte`, v: euro(perClient) })
  if (r.pnl.revenue[0] > 0) lines.push({ k: "Chiffre d'affaires année 1", v: euro(r.pnl.revenue[0], { compact: true }) })
  if (fixed > 0) lines.push({ k: 'Charges fixes année 1', v: euro(fixed, { compact: true }) })
  if (need) lines.push({ k: 'Clients pour être à l’équilibre', v: `${num(need)}`, strong: true })
  if (reached('depart') && r.kpis.fundingNeed > 0) {
    lines.push({ k: 'Manque en trésorerie', v: euro(r.kpis.fundingNeed), bad: true })
  }
  if (!lines.length) return null

  return h('aside', { class: 'setup-echo' },
    h('span', { class: 'setup-echo-tag' }, 'Ce que ça donne'),
    ...lines.map((l) => h('div', { class: `setup-echo-row ${l.strong ? 'strong' : ''} ${l.bad ? 'bad' : ''}` },
      h('span', {}, l.k),
      h('span', { class: 'num' }, l.v),
    )),
  )
}

/* ────────────────────────────── Les contrôles ───────────────────────────── */

/** Champ unique, grand, qui prend le focus et valide à la touche Entrée. */
function field(ctx, { type, placeholder, value, apply, suffix }) {
  const s = ctx.scenario
  const input = h('input', {
    class: 'setup-input', type: type === 'text' ? 'text' : 'text',
    inputmode: type === 'number' ? 'decimal' : null,
    value: String(value(s) ?? ''),
    placeholder: typeof placeholder === 'function' ? placeholder(s) : placeholder,
    onInput: (e) => {
      const raw = type === 'number' ? e.target.value.replace(',', '.') : e.target.value
      store.update((sc) => apply(sc, type === 'number' ? Number(raw) || 0 : raw), { label: ctx.step.question, silent: true })
      ctx.refresh()
    },
    onKeyDown: (e) => { if (e.key === 'Enter' && ctx.step.ready(store.scenario)) ctx.go(1) },
  })
  setTimeout(() => { input.focus(); input.select?.() }, 30)
  return h('div', { class: 'setup-field' }, input, suffix ? h('span', { class: 'setup-suffix' }, suffix) : null)
}

/** Choix parmi des options, en grandes cartes cliquables. */
function choice(ctx, options) {
  return h('div', { class: 'setup-choices' },
    ...options.map((o) => h('button', {
      class: `setup-choice ${o.active ? 'active' : ''}`,
      onClick: () => { o.pick(); ctx.refresh() },
    },
      h('span', { class: 'setup-choice-label' }, o.label),
      o.note ? h('span', { class: 'setup-choice-note' }, o.note) : null,
    )),
  )
}

/* ───────────────────────────── Écran : métier ───────────────────────────── */

function sectorPicker(ctx) {
  const current = store.scenario?.meta?.sectorKey
  return h('div', { class: 'setup-sectors' },
    ...sectorsByFamily().flatMap((family) => family.sectors.map((sector) => h('button', {
      class: `setup-sector ${current === sector.key ? 'active' : ''}`,
      onClick: () => {
        if (store.scenario && !store.scenario.meta.isDemo && store.scenario.meta.sectorKey) {
          // Changer de métier réécrit les hypothèses : on repart d'un plan neuf
          // plutôt que de mélanger deux jeux de valeurs par défaut.
          store.create({ template: sector.key, level: store.scenario.meta.level || 'easy', name: SECTORS[sector.key].label })
        } else {
          store.create({ template: sector.key, level: 'easy', name: SECTORS[sector.key].label })
        }
        ctx.refresh()
      },
    },
      h('span', { class: 'setup-sector-glyph' }, sector.glyph),
      h('span', { class: 'setup-sector-name' }, sector.label),
    ))),
    h('button', {
      class: `setup-sector ${current === null && store.scenario ? 'active' : ''}`,
      onClick: () => { store.create({ template: null, level: 'easy', name: 'Mon projet' }); ctx.refresh() },
    },
      h('span', { class: 'setup-sector-glyph' }, '＋'),
      h('span', { class: 'setup-sector-name' }, 'Autre chose'),
    ),
  )
}

/* ─────────────────────────── Écran : prix et coût ───────────────────────── */

function priceScreen(ctx) {
  const s = ctx.scenario
  const a = s.activities[0]
  const recurring = (Number(a.recurringPrice) || 0) > 0

  return h('div', {},
    choice(ctx, [
      {
        label: 'Une fois', note: 'Le client paie et c’est réglé', active: !recurring,
        pick: () => store.update((sc) => {
          const act = sc.activities[0]
          if (!(Number(act.unitPrice) > 0)) act.unitPrice = Number(act.recurringPrice) || 0
          act.recurringPrice = 0; act.recurringCost = 0; act.contractMonths = 0
        }, { label: 'Type de prix', silent: true }),
      },
      {
        label: 'Tous les mois', note: 'Un abonnement qui se répète', active: recurring,
        pick: () => store.update((sc) => {
          const act = sc.activities[0]
          if (!(Number(act.recurringPrice) > 0)) act.recurringPrice = Math.max(10, Math.round((Number(act.unitPrice) || 300) / 10))
          act.unitPrice = 0; act.unitCost = 0
          if (!(Number(act.contractMonths) > 0)) act.contractMonths = 12
          if (!(Number(act.churnMonthly) > 0)) act.churnMonthly = 0.03
        }, { label: 'Type de prix', silent: true }),
      },
    ]),
    field(ctx, {
      type: 'number', placeholder: recurring ? '49' : '500',
      suffix: recurring ? '€ par mois' : '€',
      value: (sc) => {
        const v = recurring ? sc.activities[0].recurringPrice : sc.activities[0].unitPrice
        return Number(v) > 0 ? v : ''
      },
      apply: (sc, v) => { if (recurring) sc.activities[0].recurringPrice = v; else sc.activities[0].unitPrice = v },
    }),
  )
}

function costScreen(ctx) {
  const a = ctx.scenario.activities[0]
  const recurring = (Number(a.recurringPrice) || 0) > 0
  return field(ctx, {
    type: 'number', placeholder: '0',
    suffix: recurring ? '€ par mois et par client' : '€',
    value: (sc) => {
      const v = recurring ? sc.activities[0].recurringCost : sc.activities[0].unitCost
      return Number(v) > 0 ? v : ''
    },
    apply: (sc, v) => { if (recurring) sc.activities[0].recurringCost = v; else sc.activities[0].unitCost = v },
  })
}

/* ───────────────────── Écran : clients et croissance ────────────────────── */

function clientsScreen(ctx) {
  const voc = vocabulary(ctx.scenario)
  return field(ctx, {
    type: 'number', placeholder: '3', suffix: voc.many,
    value: (sc) => {
      const v = sc.activities[0].volumes.startUnits
      return Number(v) > 0 ? v : ''
    },
    apply: (sc, v) => { sc.activities[0].volumes.startUnits = v },
  })
}

function growthScreen(ctx) {
  const g = Number(ctx.scenario.activities[0].volumes.monthlyGrowth) || 0
  const pick = (value) => store.update((sc) => { sc.activities[0].volumes.monthlyGrowth = value },
    { label: 'Croissance', silent: true })
  return choice(ctx, [
    { label: 'Doucement', note: '+3 % par mois — le bouche-à-oreille', active: g > 0 && g <= 0.04, pick: () => pick(0.03) },
    { label: 'Normalement', note: '+8 % par mois — vous prospectez', active: g > 0.04 && g <= 0.10, pick: () => pick(0.08) },
    { label: 'Vite', note: '+15 % par mois — il faudra le démontrer', active: g > 0.10, pick: () => pick(0.15) },
  ])
}

/* ──────────────────── Écran : rémunération et frais ─────────────────────── */

function salaryScreen(ctx) {
  const s = ctx.scenario
  const me = s.team?.find((m) => ME.test(m.role || ''))
  return h('div', {},
    field(ctx, {
      type: 'number', placeholder: '2 500', suffix: '€ brut par mois',
      value: (sc) => {
        const m = sc.team?.find((x) => ME.test(x.role || ''))
        return m && Number(m.monthlyGross) > 0 ? m.monthlyGross : ''
      },
      apply: (sc, v) => {
        let m = sc.team?.find((x) => ME.test(x.role || ''))
        if (!m) { m = newTeamMember({ role: 'Moi', contractType: 'cdi', monthlyGross: v }); sc.team.push(m) }
        m.monthlyGross = v
      },
    }),
    me && Number(me.monthlyGross) > 0
      ? h('p', { class: 'setup-note' }, `Coût réel pour l'entreprise : environ ${euro(Math.round(Number(me.monthlyGross) * 1.42))} par mois, cotisations comprises.`)
      : h('p', { class: 'setup-note' }, 'Laissez vide si vous ne vous versez rien la première année.'),
  )
}

/**
 * Les frais, sous forme de cases à cocher.
 *
 * Un tableau vide n'appelle aucune réponse ; une liste de ce qu'on oublie
 * habituellement en appelle une pour chaque ligne. Les montants proposés
 * viennent du métier choisi.
 */
function costsScreen(ctx) {
  const s = ctx.scenario
  const sector = getSector(s.meta.sectorKey)
  const shop = ['retail', 'personal'].includes(sector?.family) || sector?.key === 'restaurant'

  const suggestions = [
    { label: 'Comptable', amount: 200 },
    { label: 'Assurances', amount: 90 },
    { label: 'Banque et paiement', amount: 60 },
    { label: shop ? 'Local' : 'Bureau ou coworking', amount: shop ? 1400 : 300 },
    { label: 'Logiciels et téléphone', amount: 120 },
    { label: 'Déplacements', amount: 150 },
    { label: 'Publicité', amount: 300 },
  ]

  const has = (label) => (s.opex || []).find((o) => o.label === label)

  return h('div', { class: 'setup-costs' },
    ...suggestions.map((sug) => {
      const item = has(sug.label)
      return h('div', { class: `setup-cost ${item ? 'on' : ''}` },
        h('button', {
          class: 'setup-cost-toggle',
          onClick: () => {
            store.update((sc) => {
              const i = (sc.opex || []).findIndex((o) => o.label === sug.label)
              if (i >= 0) sc.opex.splice(i, 1)
              else sc.opex.push(newOpex({ label: sug.label, monthlyAmount: sug.amount }))
            }, { label: 'Frais', silent: true })
            ctx.refresh()
          },
        },
          h('span', { class: 'setup-cost-box' }, item ? '✓' : ''),
          h('span', { class: 'setup-cost-label' }, sug.label),
        ),
        item
          ? h('input', {
              class: 'setup-cost-amount num', value: String(item.monthlyAmount ?? ''),
              inputmode: 'decimal',
              onInput: (e) => {
                const v = Number(e.target.value.replace(',', '.')) || 0
                store.update((sc) => {
                  const o = sc.opex.find((x) => x.label === sug.label)
                  if (o) o.monthlyAmount = v
                }, { label: 'Frais', silent: true })
                ctx.refresh()
              },
            })
          : h('span', { class: 'setup-cost-hint num' }, `≈ ${euro(sug.amount)}`),
      )
    }),
  )
}

function cashScreen(ctx) {
  return h('div', {},
    field(ctx, {
      type: 'number', placeholder: '10 000', suffix: '€',
      value: (sc) => {
        const total = (sc.financing.equityFounders || []).reduce((a, x) => a + (Number(x.amount) || 0), 0)
        return total > 0 ? total : ''
      },
      apply: (sc, v) => { sc.financing.equityFounders = v > 0 ? [{ month: 0, amount: v }] : [] },
    }),
    h('p', { class: 'setup-note' }, "Si vous n'avez rien de côté, mettez zéro : Fizzy vous dira exactement combien il vous manque et à quelle date."),
  )
}

/* ──────────────────────────────── La fin ────────────────────────────────── */

function doneScreen(ctx) {
  const s = ctx.scenario
  let r = null
  try { r = compute(s) } catch { /* rien à montrer */ }
  if (!r) return h('p', {}, 'Le modèle n’a pas pu être calculé.')

  const k = r.kpis, p = r.pnl
  const y = k.firstProfitableYear !== null ? k.firstProfitableYear : 0

  return h('div', {},
    h('div', { class: 'setup-results' },
      resultRow("Chiffre d'affaires année 1", euro(p.revenue[0], { compact: true })),
      resultRow('Point mort', k.breakEven[0] ? euro(k.breakEven[0], { compact: true }) : '—'),
      resultRow('Premier exercice rentable',
        k.firstProfitableYear !== null ? `Année ${k.firstProfitableYear + 1}` : 'Au-delà de 5 ans',
        k.firstProfitableYear !== null ? 'ok' : 'warn'),
      resultRow(k.fundingNeed > 0 ? 'Il vous manque' : 'Trésorerie',
        k.fundingNeed > 0 ? euro(k.fundingNeed) : 'Jamais négative',
        k.fundingNeed > 0 ? 'warn' : 'ok'),
    ),
    h('p', { class: 'setup-note' },
      "Tout reste modifiable. Les pages détaillées ajoutent les délais de paiement, la TVA, les investissements, les crédits d'impôt — mais l'essentiel est déjà là."),
    h('div', { class: 'setup-actions' },
      h('button', {
        class: 'btn btn-primary btn-lg',
        onClick: () => { resetSetup(); ctx.navigate('#/parcours') },
      }, 'Voir mon business plan →'),
      h('button', {
        class: 'btn btn-lg',
        onClick: () => { resetSetup(); ctx.navigate('#/business-case') },
      }, 'Exporter le dossier'),
    ),
  )
}

const resultRow = (label, value, tone = '') => h('div', { class: `setup-result ${tone}` },
  h('span', { class: 'setup-result-label' }, label),
  h('span', { class: 'setup-result-value num' }, value),
)
