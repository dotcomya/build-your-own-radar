/**
 * « Ton modèle économique » — la brique dont tout le reste est fait.
 *
 * Un fondateur qui ouvre un prévisionnel ne sait généralement pas par où
 * commencer, parce qu'un tableur lui demande soixante chiffres à la fois. Cette
 * page n'en demande que quatre : ce que tu vends, à quel prix, ce que ça te
 * coûte, et si l'argent revient une fois ou tous les mois.
 *
 * Et à chaque frappe elle répond à la seule question qui compte à ce stade :
 * combien de clients il te faut pour vivre.
 */

import { h, euro, pct, num, numberField, textField } from '../dom.js'
import { vocabulary, getSector } from '../../state/sectors.js'
import { referenceYear } from '../../format.js'
import { STEPS, journey } from '../../engine/journey.js'
import { tutorial, stepBanner } from '../tutorial.js'
import store from '../../state/store.js'

/** Les trois moteurs de revenu, en langage de fondateur. */
const ENGINES = [
  {
    key: 'unitaire', label: 'À la vente', glyph: '◇',
    line: 'Vous facturez une prestation, un produit, une mission.',
    detail: "L'argent rentre une fois. Pour croître, il faut vendre à nouveau.",
    applies: (a) => (Number(a.unitPrice) || 0) > 0 && (Number(a.recurringPrice) || 0) === 0,
    apply(a) {
      if (!(Number(a.unitPrice) > 0)) a.unitPrice = 500
      a.recurringPrice = 0
      a.recurringCost = 0
      a.contractMonths = 0
    },
  },
  {
    key: 'abonnement', label: 'Par abonnement', glyph: '◉',
    line: 'Vos clients paient tous les mois tant qu’ils restent.',
    detail: "Chaque vente se répète. C'est le modèle le mieux valorisé, et le plus exigeant sur la rétention.",
    applies: (a) => (Number(a.recurringPrice) || 0) > 0 && (Number(a.unitPrice) || 0) === 0,
    apply(a) {
      if (!(Number(a.recurringPrice) > 0)) a.recurringPrice = 49
      a.unitPrice = 0
      a.unitCost = 0
      if (!(Number(a.contractMonths) > 0)) a.contractMonths = 12
      if (!(Number(a.churnMonthly) > 0)) a.churnMonthly = 0.03
    },
  },
  {
    key: 'mixte', label: 'Les deux', glyph: '◈',
    line: 'Un montant à la signature, puis un abonnement.',
    detail: "Installation puis maintenance, matériel puis service, forfait puis suivi.",
    applies: (a) => (Number(a.unitPrice) || 0) > 0 && (Number(a.recurringPrice) || 0) > 0,
    apply(a) {
      if (!(Number(a.unitPrice) > 0)) a.unitPrice = 900
      if (!(Number(a.recurringPrice) > 0)) a.recurringPrice = 49
      if (!(Number(a.contractMonths) > 0)) a.contractMonths = 12
    },
  },
]

export const engineOf = (a) => ENGINES.find((e) => e.applies(a)) || ENGINES[0]

export function renderModel(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  if (!s) return h('div', { class: 'content' }, h('p', {}, 'Aucun scénario.'))

  const a = s.activities?.[0]
  if (!a) return h('div', { class: 'content' }, h('p', {}, 'Aucune offre définie.'))

  const voc = vocabulary(s)
  const sector = getSector(s.meta?.sectorKey)
  const step = STEPS.find((x) => x.key === 'modele')
  const set = (patch, label) => store.update((sc) => Object.assign(sc.activities[0], patch), { label })

  return h('div', { class: 'content' },
    stepBanner('modele', journey(s, r), navigate),

    engineChooser(a, set, refresh),

    h('div', { class: 'grid grid-2 mt', style: { alignItems: 'start' } },
      priceCard(a, s, voc, set, refresh),
      verdictCard(a, s, r, voc, navigate),
    ),

    unitEconomics(a, s, r, voc),

    sector && sectorNote(sector, voc),

    tutorial(step, navigate),
  )
}

/* ───────────────────────── Le moteur de revenu ──────────────────────────── */

function engineChooser(a, set, refresh) {
  const active = engineOf(a)
  return h('section', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('h2', {}, "D'où vient l'argent ?"),
      h('p', { class: 'panel-sub' }, "Ce choix décide de la forme de la courbe. Il se change à tout moment : rien n'est perdu."),
    ),
    h('div', { class: 'engines' },
      ...ENGINES.map((e) => h('button', {
        class: `engine ${e.key === active.key ? 'active' : ''}`,
        onClick: () => {
          store.update((sc) => e.apply(sc.activities[0]), { label: `Modèle : ${e.label.toLowerCase()}` })
          refresh()
        },
      },
        h('span', { class: 'engine-glyph' }, e.glyph),
        h('span', { class: 'engine-label' }, e.label),
        h('span', { class: 'engine-line' }, e.line),
        h('span', { class: 'engine-detail' }, e.detail),
      )),
    ),
  )
}

/* ──────────────────────────── Prix et coût ──────────────────────────────── */

function priceCard(a, s, voc, set, refresh) {
  const engine = engineOf(a)
  const fields = []

  fields.push(textField({
    label: 'Ce que vous vendez', value: a.name,
    placeholder: `Ex. ${voc.one}`,
    hint: "Le nom employé devant un client.",
    onInput: (v) => set({ name: v }, 'Nom de l’offre'),
  }))

  if (engine.key !== 'abonnement') {
    fields.push(numberField({
      label: `Prix ${voc.unitArticle || 'd’une'} ${voc.one}`, value: a.unitPrice, field: 'unitPrice', suffix: '€',
      hint: 'Hors taxes. Le prix que le client voit sur la facture.',
      onInput: (v) => set({ unitPrice: v }, 'Prix'),
    }))
    fields.push(numberField({
      label: 'Ce que ça vous coûte', value: a.unitCost, field: 'unitCost', suffix: '€',
      hint: 'Tout ce qui augmente quand vous vendez une unité de plus : matières, sous-traitance, commission, livraison.',
      onInput: (v) => set({ unitCost: v }, 'Coût de revient'),
    }))
  }

  if (engine.key !== 'unitaire') {
    fields.push(numberField({
      label: 'Abonnement mensuel', value: a.recurringPrice, field: 'recurringPrice', suffix: '€/mois',
      hint: 'Ce que le client paie chaque mois tant qu’il reste.',
      onInput: (v) => set({ recurringPrice: v }, 'Abonnement'),
    }))
    fields.push(numberField({
      label: 'Coût mensuel du service', value: a.recurringCost, field: 'recurringCost', suffix: '€/mois',
      hint: 'Hébergement, support, licences : ce que coûte un abonné chaque mois.',
      onInput: (v) => set({ recurringCost: v }, 'Coût récurrent'),
    }))
    fields.push(numberField({
      label: 'Durée d’engagement', value: a.contractMonths, field: 'contractMonths', suffix: 'mois',
      hint: 'Douze mois est la norme. Sans engagement, mettez 1 et comptez sur l’attrition.',
      onInput: (v) => set({ contractMonths: v }, 'Durée de contrat'),
    }))
    fields.push(numberField({
      label: 'Attrition mensuelle', value: a.churnMonthly, field: 'churnMonthly', percent: true,
      hint: 'La part des abonnés qui partent chaque mois. 2 à 3 % est courant ; 5 % est alarmant.',
      onInput: (v) => set({ churnMonthly: v }, 'Attrition'),
    }))
  }

  return h('section', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('h2', {}, 'Vos quatre chiffres')),
    h('div', { class: 'panel-body stack' }, ...fields),
  )
}

/* ─────────────────── La réponse : combien de clients ? ──────────────────── */

/**
 * Le chiffre qui décide.
 *
 * Tant que le fondateur n'a pas saisi ses charges, on ne peut pas lui donner
 * son vrai point mort — mais on peut déjà lui donner sa marge unitaire, qui est
 * la moitié de la réponse, et lui dire ce qui manque pour l'autre moitié.
 */
function verdictCard(a, s, r, voc, navigate) {
  const price = Number(a.unitPrice) || 0
  const cost = Number(a.unitCost) || 0
  const rPrice = Number(a.recurringPrice) || 0
  const rCost = Number(a.recurringCost) || 0
  const months = Math.max(1, Number(a.contractMonths) || 1)

  const unitMargin = price - cost
  const monthlyMargin = rPrice - rCost
  const lifetime = unitMargin + monthlyMargin * months
  const marginRate = price + rPrice * months > 0 ? lifetime / (price + rPrice * months) : 0

  const y = r ? referenceYear(r) : 0
  const fixed = r ? (r.kpis.fixedCosts[y] || 0) : 0
  const clientsNeeded = lifetime > 0 && fixed > 0 ? Math.ceil(fixed / lifetime) : null

  const bad = lifetime <= 0

  return h('section', { class: `panel verdict-panel ${bad ? 'is-bad' : ''}` },
    h('div', { class: 'panel-head' },
      h('h2', {}, bad ? 'Vous vendez à perte' : 'Ce que rapporte un client'),
      h('p', { class: 'panel-sub' }, bad
        ? "Le coût dépasse le prix : aucun volume ne rattrapera ça."
        : `Sur toute la durée de la relation, marge comprise.`),
    ),
    h('div', { class: 'panel-body' },
      h('div', { class: 'model-figure' },
        h('span', { class: `model-figure-value num ${bad ? 'neg' : ''}` }, euro(lifetime)),
        h('span', { class: 'model-figure-unit' }, `par ${voc.client}`),
      ),
      h('div', { class: 'model-breakdown' },
        unitMargin !== 0 && breakdownRow('À la vente', euro(unitMargin), price > 0 ? pct(unitMargin / price, 0) : null),
        monthlyMargin !== 0 && breakdownRow('Chaque mois', `${euro(monthlyMargin)}/mois`, `× ${months} mois`),
        breakdownRow('Taux de marge', pct(marginRate, 0), null, true),
      ),

      clientsNeeded !== null
        ? h('div', { class: 'model-answer' },
            h('div', { class: 'model-answer-label' }, 'Pour couvrir vos charges, il vous faut'),
            h('div', { class: 'model-answer-value num' }, `${num(clientsNeeded)} ${clientsNeeded > 1 ? voc.many : voc.one}`),
            h('div', { class: 'model-answer-note' }, `Charges fixes de ${euro(fixed, { compact: true })} par an, divisées par ce que rapporte un ${voc.client}.`),
          )
        : h('div', { class: 'model-answer model-answer-todo' },
            h('div', { class: 'model-answer-label' }, 'Combien de clients pour vivre ?'),
            h('div', { class: 'model-answer-note' }, "Saisissez vos charges et votre rémunération : Fizzy donne le nombre exact."),
            h('button', { class: 'btn btn-sm mt', onClick: () => navigate('#/charges') }, 'Aller aux charges →'),
          ),
    ),
  )
}

const breakdownRow = (label, value, note, strong = false) => h('div', { class: `model-row ${strong ? 'strong' : ''}` },
  h('span', {}, label),
  h('span', { class: 'spacer' }),
  note ? h('span', { class: 'tiny muted' }, note) : null,
  h('span', { class: 'num' }, value),
)

/* ───────────────────── L'économie unitaire, en clair ────────────────────── */

function unitEconomics(a, s, r, voc) {
  const price = (Number(a.unitPrice) || 0) + (Number(a.recurringPrice) || 0) * Math.max(1, Number(a.contractMonths) || 1)
  const cost = (Number(a.unitCost) || 0) + (Number(a.recurringCost) || 0) * Math.max(1, Number(a.contractMonths) || 1)
  if (price <= 0) return null
  const margin = Math.max(0, price - cost)
  const marginPart = Math.max(0, Math.min(100, (margin / price) * 100))

  return h('section', { class: 'panel mt' },
    h('div', { class: 'panel-head' },
      h('h2', {}, 'Où part chaque euro'),
      h('p', { class: 'panel-sub' }, `Sur ${euro(price)} encaissés auprès d'un ${voc.client}, voilà ce qui reste pour payer tout le reste.`),
    ),
    h('div', { class: 'panel-body' },
      h('div', { class: 'split-bar' },
        h('span', { class: 'split-cost', style: { width: `${100 - marginPart}%` } }),
        h('span', { class: 'split-margin', style: { width: `${marginPart}%` } }),
      ),
      h('div', { class: 'split-legend' },
        h('span', {}, h('i', { class: 'swatch split-cost' }), `Coût de revient · ${euro(cost)}`),
        h('span', {}, h('i', { class: 'swatch split-margin' }), `Marge brute · ${euro(margin)}`),
      ),
      h('p', { class: 'tiny muted', style: { margin: '14px 0 0' } },
        "Cette marge doit couvrir les salaires, le loyer, le comptable, les impôts — et vous payer. C'est pour ça qu'une marge de 30 % n'est pas 30 % de bénéfice."),
    ),
  )
}

function sectorNote(sector, voc) {
  const range = sector.benchmarks?.grossMargin
  if (!range) return null
  return h('div', { class: 'note plain mt' },
    h('div', { class: 'note-title' }, `Dans ce métier : ${pct(range[0], 0)} à ${pct(range[1], 0)} de marge brute`),
    sector.vat?.note || `Ordre de grandeur observé en ${sector.label.toLowerCase()}. En dessous, il faut une raison ; au-dessus, il faut la démontrer.`,
  )
}
