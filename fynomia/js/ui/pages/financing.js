/** Financement : capital, emprunts, subventions, avances. */

import { h, euro, num, numberField, textField, selectField, monthField, helpButton, monthLabel, moduleShell, PLUS, MINUS } from '../dom.js'
import { uid } from '../../state/schema.js'
import { areaChart, YEAR_CATEGORIES, STATUS, A_PLAT } from '../charts.js'
import { tutorial, stepGuide } from '../tutorial.js'
import { journey } from '../../engine/journey.js'
import { todoPanel } from '../todo.js'
import { claim } from '../spotlight.js'
import store from '../../state/store.js'
import { gardePage } from '../garde.js'
import { chiffresDePage } from '../chiffres-pages.js'
import { banquierVerifie, tableauBanquier } from '../banquier.js'
import { memoire } from '../memoire.js'

/**
 * Les sources de financement.
 *
 * Chaque source avait sa carte, empilée sous la précédente : six blocs, la
 * plupart vides, et il fallait dérouler la page entière pour voir ce qu'on
 * avait réuni. Elles tiennent désormais dans une grille de tuiles — une par
 * source, avec son montant — et le détail s'ouvre sous celle qu'on choisit.
 */
// Les montants naissent à zéro. Activer « emprunt bancaire » ne doit pas
// inscrire 50 000 € dans le plan : personne n'a demandé cette somme, et un
// chiffre qu'on n'a pas choisi finit toujours par être pris pour vrai. Seuls
// les paramètres de structure — un taux, une durée — gardent une valeur
// courante, parce qu'ils décrivent la forme du produit, pas son montant.
const SOURCES = [
  {
    key: 'equityFounders', label: 'Apport des fondateurs', glyph: '\u25c8', level: 'easy',
    hint: "Ce que toi et tes associ\u00e9s mettez au capital. C'est l'apport que toute banque regarde en premier.",
    make: () => ({ id: uid('eqf'), month: 0, amount: 0 }),
    fields: [
      { k: 'amount', label: 'Montant', suffix: '\u20ac', type: 'number' },
      { k: 'month', label: 'Mois', type: 'month' },
    ],
  },
  {
    key: 'loans', label: 'Emprunt bancaire', glyph: '\u25ce', level: 'easy',
    hint: "Un pr\u00eat finance en g\u00e9n\u00e9ral les investissements durables, rarement le besoin en fonds de roulement.",
    make: () => ({ id: uid('loan'), label: 'Pr\u00eat bancaire', amount: 0, month: 0, rate: 0.04, months: 60, graceMonths: 0 }),
    fields: [
      { k: 'label', label: 'Intitul\u00e9', type: 'text' },
      { k: 'amount', label: 'Montant', suffix: '\u20ac', type: 'number' },
      { k: 'rate', label: 'Taux annuel', type: 'percent', step: 0.1 },
      { k: 'months', label: 'Dur\u00e9e', suffix: 'mois', type: 'number' },
      { k: 'month', label: 'D\u00e9blocage', type: 'month' },
    ],
    note: (l) => loanSummary(l),
  },
  {
    key: 'honourLoans', label: "Pr\u00eat d'honneur", glyph: '\u2726', level: 'easy',
    hint: "Un pr\u00eat \u00e0 taux z\u00e9ro et sans garantie, accord\u00e9 \u00e0 toi personnellement par un r\u00e9seau d'accompagnement. Tu l'apportes \u00e0 ton entreprise : il compte comme un apport, et c'est souvent lui qui d\u00e9clenche le pr\u00eat bancaire \u2014 Initiative France observe en moyenne 9,50 \u20ac de pr\u00eat bancaire pour 1 \u20ac de pr\u00eat d'honneur. Tu le rembourses sur tes revenus : Fynomia le d\u00e9duit de ce qui te reste, pas des comptes de l'entreprise.",
    make: () => ({ id: uid('hon'), label: "Pr\u00eat d'honneur", network: 'initiative', amount: 0, month: 0, months: 60, graceMonths: 6 }),
    fields: [
      { k: 'network', label: 'R\u00e9seau', type: 'select', options: () => Object.entries(HONOUR_NETWORKS).map(([value, n]) => ({ value, label: n.label })) },
      { k: 'amount', label: 'Montant', suffix: '\u20ac', type: 'number' },
      { k: 'months', label: 'Rembours\u00e9 sur', suffix: 'mois', type: 'number' },
      { k: 'graceMonths', label: 'Diff\u00e9r\u00e9', suffix: 'mois', type: 'number' },
      { k: 'month', label: 'Versement', type: 'month' },
    ],
    note: (l) => honourSummary(l),
  },
  {
    key: 'grants', label: 'Subvention', glyph: '\u25c7', level: 'easy',
    hint: "Une subvention est un produit d'exploitation : elle am\u00e9liore le r\u00e9sultat et vient en d\u00e9duction de l'assiette du cr\u00e9dit d'imp\u00f4t recherche.",
    make: () => ({ id: uid('grt'), label: 'Subvention', amount: 0, month: 0, months: 1 }),
    fields: [
      { k: 'label', label: 'Intitul\u00e9', type: 'text' },
      { k: 'amount', label: 'Montant', suffix: '\u20ac', type: 'number' },
      { k: 'month', label: 'Premier versement', type: 'month' },
      { k: 'months', label: '\u00c9tal\u00e9 sur', suffix: 'mois', type: 'number' },
    ],
  },
  {
    key: 'equityInvestors', label: 'Lev\u00e9e de fonds', glyph: '\u25b3', level: 'intermediate',
    hint: "Capital apport\u00e9 par des investisseurs ext\u00e9rieurs, en \u00e9change de parts.",
    make: () => ({ id: uid('eqi'), month: 6, amount: 0 }),
    fields: [
      { k: 'amount', label: 'Montant', suffix: '\u20ac', type: 'number' },
      { k: 'month', label: 'Mois', type: 'month' },
    ],
  },
  {
    key: 'shareholderLoans', label: "Compte courant d'associ\u00e9", glyph: '\u25a1', level: 'intermediate',
    hint: "De l'argent que tu pr\u00eates \u00e0 ta soci\u00e9t\u00e9 et qui te sera rendu. Ce n'est pas du capital : \u00e7a n'entre pas dans les fonds propres.",
    make: () => ({ id: uid('cca'), label: 'Compte courant', amount: 0, month: 0, repayMonth: '' }),
    fields: [
      { k: 'label', label: 'Intitul\u00e9', type: 'text' },
      { k: 'amount', label: 'Montant', suffix: '\u20ac', type: 'number' },
      { k: 'month', label: 'Versement', type: 'month' },
      { k: 'repayMonth', label: 'Remboursement', type: 'month', allowEmpty: true },
    ],
  },
  {
    key: 'advances', label: 'Avance remboursable', glyph: '\u25b7', level: 'advanced',
    hint: "Un pr\u00eat sans int\u00e9r\u00eat \u00e0 rembourser en cas de succ\u00e8s. Elle vient en d\u00e9duction de l'assiette du CIR, puis y est r\u00e9int\u00e9gr\u00e9e au fil des remboursements.",
    make: () => ({ id: uid('adv'), label: 'Avance remboursable', amount: 0, month: 0, repayStartMonth: 24, repayMonths: 24 }),
    fields: [
      { k: 'label', label: 'Intitul\u00e9', type: 'text' },
      { k: 'amount', label: 'Montant', suffix: '\u20ac', type: 'number' },
      { k: 'month', label: 'Versement', type: 'month' },
      { k: 'repayStartMonth', label: 'D\u00e9but du remboursement', type: 'month' },
      { k: 'repayMonths', label: '\u00c9tal\u00e9 sur', suffix: 'mois', type: 'number' },
    ],
  },
]

/**
 * Les réseaux de prêt d'honneur, et ce qu'ils prêtent d'ordinaire.
 *
 * Les montants sont ceux que les réseaux publient ; ils varient d'une
 * plateforme locale à l'autre. Ils servent à situer une saisie, pas à la
 * borner.
 */
export const HONOUR_NETWORKS = {
  initiative: {
    label: 'Initiative France',
    repere: 'jusqu\u2019\u00e0 50 000 \u20ac, autour de 10 000 \u20ac en moyenne, rembours\u00e9 sur 2 \u00e0 5 ans',
    max: 50000,
  },
  reseau: {
    label: 'R\u00e9seau Entreprendre',
    repere: 'de 15 000 \u00e0 50 000 \u20ac, jusqu\u2019\u00e0 90 000 \u20ac dans certaines r\u00e9gions, rembours\u00e9 sur 5 ans avec un diff\u00e9r\u00e9, et un chef d\u2019entreprise qui t\u2019accompagne',
    max: 90000,
  },
  franceactive: {
    label: 'France Active',
    repere: 'pr\u00eats d\u2019honneur et garanties d\u2019emprunt, pour les cr\u00e9ateurs sans apport et les projets \u00e0 impact',
    max: 50000,
  },
  autre: {
    label: 'Autre r\u00e9seau',
    repere: 'plateformes r\u00e9gionales, fondations, r\u00e9seaux d\u2019\u00e9coles',
    max: 90000,
  },
}

function honourSummary(l) {
  const amount = Number(l.amount) || 0
  const n = Math.max(1, Number(l.months) || 1)
  const grace = Math.max(0, Number(l.graceMonths) || 0)
  const reseau = HONOUR_NETWORKS[l.network] || HONOUR_NETWORKS.autre
  const base = amount > 0
    ? `Tu rembourses ${euro(amount / n)} par mois pendant ${n} mois${grace ? `, apr\u00e8s ${grace} mois de diff\u00e9r\u00e9` : ''}, sans int\u00e9r\u00eats, sur tes revenus.`
    : 'Indique le montant que tu vises.'
  return `${base} Rep\u00e8re ${reseau.label} : ${reseau.repere}.`
}

const LEVEL_RANK = { easy: 0, intermediate: 1, advanced: 2 }

export function renderFinancing(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  const f = s.financing
  const level = store.level

  const visible = SOURCES.filter((src) => LEVEL_RANK[src.level] <= LEVEL_RANK[level])
  const picked = memoire.financement.picked && visible.some((x) => x.key === memoire.financement.picked)
    ? memoire.financement.picked
    : (visible.find((src) => (f[src.key] || []).length > 0) || visible[0]).key
  memoire.financement.picked = picked
  const source = visible.find((x) => x.key === picked)

  const totalRaised = SOURCES.reduce((acc, src) => acc + sum(f[src.key]), 0)

  const add = (src) => {
    store.update((sc) => { (sc.financing[src.key] = sc.financing[src.key] || []).push(src.make()) }, { label: `Ajout : ${src.label}` })
    memoire.financement.picked = src.key
    refresh()
  }
  const drop = (key, id) => {
    store.update((sc) => { sc.financing[key] = sc.financing[key].filter((x) => x.id !== id) }, { label: 'Suppression' })
    refresh()
  }

  /**
   * Activer ou désactiver une source.
   *
   * La tuile est un interrupteur : une source sert, ou elle ne sert pas.
   * Désactiver ne jette rien — les lignes sont mises de côté dans le scénario
   * et reviennent telles quelles à la réactivation. Un emprunt qu'on éteint
   * pour voir l'effet sur la trésorerie ne doit pas coûter sa ressaisie.
   */
  const toggle = (src) => {
    const on = (f[src.key] || []).length > 0
    store.update((sc) => {
      const paused = (sc.financing.paused = sc.financing.paused || {})
      if (on) {
        paused[src.key] = sc.financing[src.key]
        sc.financing[src.key] = []
      } else {
        sc.financing[src.key] = (paused[src.key] || []).length ? paused[src.key] : [src.make()]
        delete paused[src.key]
      }
    }, { label: on ? `Sans ${src.label.toLowerCase()}` : `Avec ${src.label.toLowerCase()}` })
    if (!on) memoire.financement.picked = src.key
    refresh()
  }
  const setField = (key, id, patch, opts = {}) =>
    store.update((sc) => Object.assign(sc.financing[key].find((x) => x.id === id), patch), { label: 'Financement', ...(opts || {}) })

  const views = [
    { key: 'sources', label: 'Sources', count: SOURCES.reduce((a, src) => a + ((f[src.key] || []).length), 0) },
    r ? { key: 'tresorerie', label: 'Trésorerie', read: true } : null,
    r ? { key: 'plan', label: 'Plan de financement', read: true } : null,
  ]
  const want = claim('financement')
  if (want && want.view) memoire.financement.view = want.view
  const view = views.some((v) => v && v.key === memoire.financement.view) ? memoire.financement.view : 'sources'
  memoire.financement.view = view

  // Les chiffres de la page d'abord, en une ligne ; la zone de travail ensuite.
  const chiffres = chiffresDePage('financement', refresh, navigate)

  return h('div', { class: 'content' },

    moduleShell({
      no: '05', title: 'Financement',
      lede: "Ce que tu réunis, et ce qu’il manque au point bas de trésorerie.",
      figure: chiffres ? null : {
        value: euro(totalRaised, { compact: true }),
        note: r && r.kpis.fundingNeed > 0
          ? `réunis · il manque ${euro(r.kpis.fundingNeed)} avant ${monthLabel(r.kpis.cashLow.month, r.startDate)}`
          : 'réunis · trésorerie couverte',
      },
      guide: stepGuide('financement', journey(store.scenario, store.result), 'financement'),
      views, view, onPick: (k) => { memoire.financement.view = k; refresh() },
      actions: [view === 'sources' && source && (f[source.key] || []).length
        ? h('button', { class: 'btn btn-primary btn-sm', onClick: () => add(source) }, '＋ Une ligne de plus') : null],
    }),
    chiffres || gardePage('financement', navigate),

    view === 'sources' ? h('div', { class: 'view' },
      h('div', { class: 'sources', 'data-gap': 'sources' },
        h('div', { class: 'source source-cash' },
          h('span', { class: 'source-glyph' }, '●'),
          h('span', { class: 'source-name' }, 'Déjà en caisse'),
          (() => {
            const input = h('input', {
              class: 'num source-input', inputmode: 'decimal', value: String(f.openingCash ?? 0),
              'aria-label': 'Trésorerie de départ',
              onInput: (e) => store.update((sc) => { sc.financing.openingCash = Number(e.target.value.replace(',', '.')) || 0 }, { label: 'Trésorerie initiale', silent: true }),
            })
            return h('label', { class: 'source-money' }, input, h('span', {}, '€'))
          })(),
        ),
        // Chaque source s'ajoute et se retire depuis sa tuile : ouvrir le détail
        // pour supprimer une ligne obligeait à dérouler la page à chaque essai.
        ...visible.map((src) => {
          const items = f[src.key] || []
          const total = sum(items)
          const on = items.length > 0
          return h('div', {
            class: `source ${picked === src.key ? 'is-open' : ''} ${on ? 'is-on' : ''}`,
            role: 'button', tabindex: '0',
            onClick: () => { if (on) { memoire.financement.picked = src.key; refresh() } else toggle(src) },
            onKeydown: (e) => { if (e.key === 'Enter') { if (on) { memoire.financement.picked = src.key; refresh() } else toggle(src) } },
          },
            h('span', { class: 'source-glyph' }, src.glyph),
            h('span', { class: 'source-name' }, src.label),
            h('span', { class: 'source-value num' }, on ? euro(total, { compact: true }) : '—'),
            items.length > 1 ? h('span', { class: 'source-count' }, `${items.length} lignes`) : null,
            // Un seul bouton : « + » quand la source est éteinte, « − » quand
            // elle sert. Deux boutons demandaient de comprendre la différence
            // entre « ajouter une ligne » et « utiliser cette source ».
            h('span', { class: 'source-acts' },
              h('button', {
                class: `source-act ${on ? 'is-off' : 'is-on'}`,
                title: on ? `Ne pas utiliser : ${src.label.toLowerCase()}` : `Utiliser : ${src.label.toLowerCase()}`,
                'aria-label': on ? `Désactiver ${src.label}` : `Activer ${src.label}`,
                onClick: (e) => { e.stopPropagation(); toggle(src) },
                // Un « + » typographique flotte : sa boîte dépend de la police, et
                // dans un bouton rond il n'est jamais tout à fait au centre. Deux
                // traits dessinés le sont par construction, à toutes les tailles.
                html: on ? MINUS : PLUS,
              }),
            ),
          )
        }),
      ),
      source && (f[source.key] || []).length ? sourceDetail(source, f[source.key], r, { add, drop, setField }) : null,
      // Ce que le banquier recalculera de son côté, avec l'échéancier réel :
      // on le lit ici, là où l'on règle l'apport et le prêt.
      r ? h('div', { class: 'card mb' }, h('div', { class: 'card-body' }, banquierVerifie(r))) : null,
    ) : null,

    view === 'tresorerie' && r ? h('div', { class: 'view' },
      h('div', { class: 'grid grid-4 kpis mb' },
        tile('Financements réunis', euro(totalRaised, { compact: true }), 'Tous apports confondus'),
        tile('Besoin identifié', r.kpis.fundingNeed > 0 ? euro(r.kpis.fundingNeed, { compact: true }) : 'Couvert',
          r.kpis.fundingNeed > 0 ? `Point bas ${monthLabel(r.kpis.cashLow.month, r.startDate)}` : 'Trésorerie positive', 'tresorerie',
          r.kpis.fundingNeed > 0 ? 'neg' : 'pos'),
        tile('Fin année 1', euro(r.cash.yearEnd[0], { compact: true }), 'Solde au 12ᵉ mois', null, r.cash.yearEnd[0] >= 0 ? 'pos' : 'neg'),
        tile('Autonomie', r.kpis.runwayMonths === null ? '—' : `${num(r.kpis.runwayMonths, 0)} mois`, 'Au rythme actuel', 'runway',
          r.kpis.runwayMonths !== null && r.kpis.runwayMonths < 6 ? 'neg' : ''),
      ),
      h('div', { class: 'card' },
        h('div', { class: 'card-body' },
          areaChart({ values: r.cash.balance, startDate: r.startDate, color: r.kpis.fundingNeed > 0 ? STATUS.warn : STATUS.gain, ...A_PLAT }),
          r.kpis.fundingNeed > 0 ? h('div', { class: 'note warn mt' },
            h('div', { class: 'note-title' }, `Il manque ${euro(r.kpis.fundingNeed)}`),
            `Ton solde atteint son point bas en ${monthLabel(r.kpis.cashLow.month, r.startDate)}. Trois leviers : ajouter une source, négocier des acomptes clients plus élevés dans l'onglet Offre, ou décaler des recrutements et investissements.`) : null,
        ),
      ),
    ) : null,

    view === 'plan' && r ? h('div', { class: 'view' },
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', {}, 'Plan de financement'), helpButton('planFinancement')),
        h('div', { class: 'table-wrap' }, financingPlanTable(r)),
      ),
      h('div', { class: 'card mt' },
        h('div', { class: 'card-head' }, h('h2', {}, 'Les chiffres du banquier'), helpButton('caf')),
        h('div', { class: 'table-wrap' }, tableauBanquier(r)),
      ),
    ) : null,

    todoPanel('financement', store.scenario, navigate),

    tutorial('financement', navigate),
  )
}

/** Le d\u00e9tail d'une source : ses lignes, et rien d'autre \u00e0 l'\u00e9cran. */
function sourceDetail(src, items, r, { add, drop, setField }) {
  return h('div', { class: 'card mb' },
    h('div', { class: 'card-head' },
      h('h2', {}, src.label),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn btn-sm', onClick: () => add(src) }, '\uff0b Ajouter'),
    ),
    h('div', { class: 'card-body' },
      h('p', { class: 'muted small', style: { margin: '0 0 12px', maxWidth: '78ch' } }, src.hint),
      items.length === 0
        ? h('p', { class: 'muted small', style: { margin: 0 } }, 'Aucune ligne pour cette source.')
        : h('div', { class: 'stack' }, ...items.map((item) => h('div', { class: 'source-line' },
            h('div', { class: 'source-fields' },
              ...src.fields.map((fd) => {
                const common = { label: fd.label, value: item[fd.k] }
                if (fd.type === 'text') return textField({ ...common, onInput: (v, o) => setField(src.key, item.id, { [fd.k]: v }, o) })
                if (fd.type === 'month') return monthField({ ...common, startDate: r?.startDate, allowEmpty: !!fd.allowEmpty, onInput: (v) => setField(src.key, item.id, { [fd.k]: v }) })
                if (fd.type === 'percent') return numberField({ ...common, field: 'rate', percent: true, step: fd.step, onInput: (v) => setField(src.key, item.id, { [fd.k]: v }) })
                if (fd.type === 'select') return selectField({ ...common, options: fd.options(), onInput: (v) => setField(src.key, item.id, { [fd.k]: v }) })
                return numberField({ ...common, field: 'amount', suffix: fd.suffix, onInput: (v) => setField(src.key, item.id, { [fd.k]: v }) })
              }),
              h('button', { class: 'btn btn-sm btn-danger btn-sign', title: 'Retirer cette ligne', html: MINUS, onClick: () => drop(src.key, item.id) }),
            ),
            src.note && h('div', { class: 'tiny muted', style: { marginTop: '6px' } }, src.note(item)),
          ))),
      items.length > 0 && h('div', { class: 'note plain mt' }, 'Total : ', h('strong', {}, euro(sum(items)))),
    ),
  )
}

function financingPlanTable(r) {
  const p = r.fundingPlan
  const row = (label, key, cls) => h('tr', { class: cls || '' },
    h('td', {}, label), ...p.map((y) => h('td', { class: 'num' }, euro(y[key]))))
  return h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, `Année ${i + 1}`)))),
    h('tbody', {},
      h('tr', { class: 'section' }, h('td', { colspan: 6 }, 'Emplois')),
      row('Variation du besoin en fonds de roulement', 'bfrChange'),
      row('Investissements', 'capex'),
      row('Remboursements', 'repayment'),
      p.some((y) => y.draws > 0) ? row('Prélèvements de l’exploitant', 'draws') : null,
      row('Total des emplois', 'uses', 'total'),
      h('tr', { class: 'section' }, h('td', { colspan: 6 }, 'Ressources')),
      row('Apports en capital', 'equity'),
      p.some((y) => y.honour > 0) ? row('Prêts d’honneur', 'honour') : null,
      row('Emprunts', 'loans'),
      row('Subventions', 'grants'),
      row("Crédits d'impôt", 'credits'),
      row("Capacité d'autofinancement", 'caf'),
      row('Total des ressources', 'resources', 'total'),
      h('tr', { class: 'highlight' }, h('td', {}, 'Excédent de la période'), ...p.map((y) => h('td', { class: `num ${y.surplus < 0 ? 'neg' : 'pos'}` }, euro(y.surplus)))),
      h('tr', { class: 'total' }, h('td', {}, 'Excédent cumulé'), ...p.map((y) => h('td', { class: `num ${y.cumulative < 0 ? 'neg' : ''}` }, euro(y.cumulative)))),
    ),
  )
}

function loanSummary(l) {
  const principal = Number(l.amount) || 0
  const n = Math.max(1, Number(l.months) || 1)
  const rate = (Number(l.rate) || 0) / 12
  const payment = rate > 0 ? (principal * rate) / (1 - Math.pow(1 + rate, -n)) : principal / n
  const totalInterest = payment * n - principal
  return `Mensualité de ${euro(payment)} pendant ${n} mois, soit ${euro(totalInterest)} d'intérêts au total.`
}

function tile(label, value, sub, glossaryKey, tone) {
  return h('div', { class: `kpi ${tone || ''}` },
    h('span', { class: 'kpi-accent' }),
    h('div', { class: 'kpi-label' }, label, glossaryKey && helpButton(glossaryKey)),
    h('div', { class: 'kpi-value' }, value),
    h('div', { class: 'kpi-sub' }, sub),
  )
}

const sum = (arr) => (arr || []).reduce((a, x) => a + (Number(x.amount) || 0), 0)
